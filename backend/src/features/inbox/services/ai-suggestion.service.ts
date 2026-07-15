/**
 * @file features/inbox/services/ai-suggestion.service.ts
 *
 * Generates a REPLY SUGGESTION for the human agent — distinct from the
 * automated ReplyAI flow (AiQueueProducer / the AI reply worker), which
 * sends messages on its own. A suggestion is only ever written into the
 * composer; the agent reviews and sends it (or edits it, or discards it).
 *
 * Streams tokens as they arrive from OpenRouter so InboxWsGateway can relay
 * them to the client in near-real-time (`ai_suggestion_chunk` events).
 *
 * Credits: reuses the existing 1 credit = 100 OpenRouter tokens model and
 * the AI_SUGGESTION_CONSUME ledger type already defined in the Prisma schema
 * (CreditTransactionType.AI_SUGGESTION_CONSUME) — this service is the first
 * thing to actually write that transaction type.
 *
 * ASSUMPTION FLAGGED: the exact OpenRouter call signature (base URL, headers,
 * default model fallback) mirrors the patterns referenced elsewhere in the
 * codebase (ai-models.config.ts, AiModelConfig fields). If your existing
 * ReplyAI/CommentAI services already wrap OpenRouter behind a shared client
 * (e.g. an OpenRouterClient), swap the `callOpenRouterStreaming` method below
 * to delegate to it instead of calling fetch() directly — the rest of this
 * service (context building, credits, streaming callback) stays the same.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service.js';

export interface SuggestionResult {
  fullText:    string;
  tokensUsed:  number;
  modelId:     string;
}

/** Fallbacks — mirror the @default values on AiModelConfig in schema.prisma. */
const DEFAULT_MODEL_ID     = 'anthropic/claude-3.5-haiku';
const DEFAULT_MAX_TOKENS   = 300; // suggestions stay short — agent will refine
const DEFAULT_TEMPERATURE  = 0.7;
const DEFAULT_CONTEXT_SIZE = 8;

/** Credit conversion — matches the platform-wide "1 credit = 100 tokens" model. */
const TOKENS_PER_CREDIT = 100;

@Injectable()
export class AiSuggestionService {
  private readonly logger = new Logger(AiSuggestionService.name);
  private readonly openRouterApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openRouterApiKey = this.config.getOrThrow<string>('openRouterApiKey');
  }

  /**
   * Generates a suggested reply for the given conversation, streaming text
   * chunks via onChunk as they arrive. Throws on ownership failure, missing
   * credits, or an OpenRouter error — the caller (InboxWsGateway) is
   * responsible for turning that into an `ai_suggestion_error` event.
   */
  async generateSuggestion(
    conversationId: string,
    userId:         string,
    onChunk:        (chunk: string) => void,
  ): Promise<SuggestionResult> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
      include: {
        businessProfile: {
          include: { aiConfig: true, aiModelConfig: true },
        },
      },
    });
    if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found.`);

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    if (!user || user.creditBalance <= 0) {
      throw new ForbiddenException('Crédits insuffisants pour générer une suggestion.');
    }

    const aiConfig      = conv.businessProfile.aiConfig;
    const modelConfig    = conv.businessProfile.aiModelConfig;
    const modelId        = modelConfig?.replyModelId    ?? DEFAULT_MODEL_ID;
    const maxTokens       = Math.min(modelConfig?.replyMaxTokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS);
    const temperature    = modelConfig?.replyTemperature ?? DEFAULT_TEMPERATURE;
    const contextSize    = aiConfig?.maxContextMessages   ?? DEFAULT_CONTEXT_SIZE;

    const recentMessages = await this.prisma.message.findMany({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      take:    contextSize,
      select:  { sender: true, content: true, imageUrl: true, fileUrl: true },
    });
    const transcript = [...recentMessages].reverse();

    if (transcript.length === 0 || !transcript.some((m) => m.sender === 'CLIENT')) {
      throw new BadRequestException('Pas encore de message client dans cette conversation.');
    }

    const systemPrompt = this.buildSystemPrompt(
      conv.businessProfile.name,
      aiConfig,
    );
    const userPrompt = this.buildTranscriptPrompt(transcript);

    const { fullText, tokensUsed } = await this.callOpenRouterStreaming({
      modelId,
      maxTokens,
      temperature,
      systemPrompt,
      userPrompt,
      onChunk,
    });

    await this.consumeCredits(userId, conversationId, tokensUsed, modelId);

    return { fullText, tokensUsed, modelId };
  }

  // ─── Prompt building ────────────────────────────────────────────────────────

  private buildSystemPrompt(
    businessName: string,
    aiConfig: {
      tone: string;
      responseStyle: string;
      systemPrompt: string | null;
      inboxInstructions: string | null;
      replyLanguage: string | null;
    } | null,
  ): string {
    const tone     = aiConfig?.tone          ?? 'FRIENDLY';
    const style    = aiConfig?.responseStyle ?? 'MIXED';
    const language = aiConfig?.replyLanguage ?? 'fr (ou mg si le client écrit en malgache)';

    const parts = [
      aiConfig?.systemPrompt?.trim() ||
        `Tu es l'assistant qui aide un agent humain de « ${businessName} » à répondre à ses clients sur Messenger.`,
      aiConfig?.inboxInstructions?.trim() ?? '',
      `Ton : ${tone.toLowerCase()}. Style de réponse : ${style.toLowerCase()}. Langue de réponse : ${language}.`,
      'IMPORTANT : tu écris une SUGGESTION pour un agent humain, pas une réponse envoyée automatiquement.',
      'Réponds UNIQUEMENT avec le texte du message suggéré, prêt à être envoyé tel quel.',
      "N'ajoute aucun préambule (pas de « Voici une suggestion » ni de guillemets), aucune explication, aucun markdown.",
      'Reste concis — une à trois phrases, sauf si la question du client exige clairement plus de détail.',
    ];

    return parts.filter(Boolean).join('\n\n');
  }

  private buildTranscriptPrompt(
    messages: Array<{ sender: string; content: string | null; imageUrl: string | null; fileUrl: string | null }>,
  ): string {
    const lines = messages.map((m) => {
      const speaker = m.sender === 'CLIENT' ? 'Client' : m.sender === 'AI' ? 'Assistant (IA)' : 'Page';
      const text = m.content?.trim() || (m.imageUrl ? '[a envoyé une photo]' : m.fileUrl ? '[a envoyé un fichier]' : '[message vide]');
      return `${speaker} : ${text}`;
    });
    lines.push('---');
    lines.push('Propose la prochaine réponse de la Page au dernier message du client ci-dessus.');
    return lines.join('\n');
  }

  // ─── OpenRouter streaming call ──────────────────────────────────────────────

  private async callOpenRouterStreaming(params: {
    modelId:      string;
    maxTokens:    number;
    temperature:  number;
    systemPrompt: string;
    userPrompt:   string;
    onChunk:      (chunk: string) => void;
  }): Promise<{ fullText: string; tokensUsed: number }> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.modelId,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenRouter error ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer     = '';
    let fullText   = '';
    let tokensUsed = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const json = JSON.parse(payload);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            params.onChunk(delta);
          }
          if (json.usage?.total_tokens) {
            tokensUsed = json.usage.total_tokens;
          }
        } catch {
          // Partial/malformed SSE line — skip, next chunk will complete it
        }
      }
    }

    // Fallback if the model/provider didn't return usage in the stream.
    if (tokensUsed === 0) {
      tokensUsed = Math.ceil(fullText.length / 4); // rough ~4 chars/token estimate
    }

    return { fullText: fullText.trim(), tokensUsed };
  }

  // ─── Credits ──────────────────────────────────────────────────────────────

  private async consumeCredits(
    userId: string,
    conversationId: string,
    tokensUsed: number,
    modelId: string,
  ): Promise<void> {
    const credits = Math.max(1, Math.ceil(tokensUsed / TOKENS_PER_CREDIT));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data:  { creditBalance: { decrement: credits } },
      }),
      this.prisma.creditLedger.create({
        data: {
          userId,
          type: 'AI_SUGGESTION_CONSUME',
          amount: -credits,
          tokensUsed,
          modelId,
          conversationId,
          description: 'Suggestion de réponse IA (inbox)',
        },
      }),
    ]).catch((err: unknown) => {
      // Never fail the whole request just because the credit write failed —
      // the suggestion was already streamed to the agent. Log loudly instead.
      this.logger.error(
        `Failed to record AI_SUGGESTION_CONSUME for user=${userId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}
