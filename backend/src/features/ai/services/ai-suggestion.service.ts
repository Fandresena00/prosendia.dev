/**
 * @file features/ai/services/ai-suggestion.service.ts
 *
 * Generates a REPLY SUGGESTION for the human agent (the "Suggestion IA"
 * button in the inbox composer) — distinct from ReplyAiService, which sends
 * messages to the client on its own. A suggestion is only ever streamed into
 * the composer preview; the agent reviews, edits, or discards it before
 * anything is sent.
 *
 * Deliberately reuses the exact same building blocks as the automated
 * ReplyAI flow so the two can never drift apart:
 *   - PromptBuilderService.buildReplySystemPrompt() — same tone, language
 *     enforcement, anti-hallucination rules, blocked keywords/topics,
 *     reference images.
 *   - CreditService — same 1-credit-per-100-tokens billing model, using the
 *     CreditTransactionType.AI_SUGGESTION_CONSUME ledger type that already
 *     existed in the schema but had never been written until now.
 *   - The same primary-model → fallback-models retry chain as ReplyAiService,
 *     with one adjustment for streaming: once ANY chunk has been shown to
 *     the agent, a failure is surfaced as-is rather than silently retried
 *     with a different model (that would duplicate/contradict text already
 *     on screen).
 *
 * What's different from ReplyAiService: output is streamed
 * (OpenRouterClient.completeStream), max tokens is smaller (suggestions stay
 * short — the agent can always ask for another one), and the system prompt
 * gets one extra instruction block clarifying this is a draft for a human,
 * not an auto-send.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { CreditService } from '../../billing/services/credit.service.js';
import { OpenRouterClient, type ChatCompletionResult } from '../clients/openrouter.client.js';
import { AI_CONTEXT_CONFIG, REPLY_AI_FALLBACK_MODELS, REPLY_AI_MODEL } from '../config/ai-models.config.js';
import {
  PromptBuilderService,
  type BusinessContext,
  type ContextMessage,
  type ReferenceImage,
} from './prompt-builder.service.js';

export interface SuggestionResult {
  fullText:   string;
  tokensUsed: number;
  modelId:    string;
}

/** Suggestions stay short by design — the agent can ask again for a different draft. */
const SUGGESTION_MAX_TOKENS = 300;

const SUGGESTION_MODE_INSTRUCTIONS = [
  'MODE SUGGESTION — IMPORTANT :',
  "Ce texte ne sera PAS envoyé automatiquement : c'est une suggestion affichée à un agent humain, qui la relira avant de l'envoyer.",
  'Réponds UNIQUEMENT avec le message suggéré, prêt à être envoyé tel quel.',
  "N'ajoute aucun préambule (« Voici une suggestion » ou équivalent), aucune explication, aucun markdown, aucun guillemet.",
].join('\n');

@Injectable()
export class AiSuggestionService {
  private readonly logger = new Logger(AiSuggestionService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly openRouter:    OpenRouterClient,
    private readonly promptBuilder: PromptBuilderService,
    private readonly creditService: CreditService,
  ) {}

  /**
   * @param onChunk called with each new visible chunk of the suggestion as it streams in.
   */
  async generateSuggestion(
    conversationId: string,
    userId:         string,
    onChunk:        (chunk: string) => void,
  ): Promise<SuggestionResult> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES + 5,
        },
        businessProfile: {
          include: {
            aiConfig: true,
            aiModelConfig: true,
            chatResources: {
              where: { isActive: true },
              include: { images: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const { businessProfile } = conversation;
    const aiConfig    = businessProfile.aiConfig;
    const modelConfig = businessProfile.aiModelConfig;

    if (!aiConfig) {
      throw new BadRequestException("Configuration IA manquante pour cette page.");
    }
    if (conversation.messages.length === 0 || !conversation.messages.some((m) => m.sender === 'CLIENT')) {
      throw new BadRequestException('Pas encore de message client dans cette conversation.');
    }

    const hasCredits = await this.creditService.hasCredits(userId);
    if (!hasCredits) {
      throw new ForbiddenException('Crédits insuffisants pour générer une suggestion.');
    }

    // Same BusinessContext shape as ReplyAiService — same rules apply to a suggestion.
    const businessCtx: BusinessContext = {
      businessName:        businessProfile.name,
      businessType:        businessProfile.businessType,
      description:         businessProfile.description,
      tone:                aiConfig.tone,
      responseStyle:       aiConfig.responseStyle,
      replyLanguage:       aiConfig.replyLanguage,
      systemPrompt:        aiConfig.systemPrompt,
      inboxInstructions:   aiConfig.inboxInstructions,
      personalizeGreeting: aiConfig.personalizeGreeting,
      blockedKeywords:     aiConfig.blockedKeywords as string[],
      allowedTopics:       aiConfig.allowedTopics as string[],
      escalationThreshold: aiConfig.escalationThreshold,
    };

    const referenceImages: ReferenceImage[] = businessProfile.chatResources.flatMap((resource) =>
      resource.images.map((img) => ({ url: img.url, description: img.description })),
    );

    const baseSystemPrompt = this.promptBuilder.buildReplySystemPrompt(businessCtx, referenceImages);
    const systemPrompt = `${baseSystemPrompt}\n\n${SUGGESTION_MODE_INSTRUCTIONS}`;

    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { summary: true },
    });

    const maxCtxMessages = aiConfig.maxContextMessages ?? AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES;
    const recentMessages: ContextMessage[] = [...conversation.messages]
      .slice(0, maxCtxMessages)
      .reverse()
      .map((msg) => ({
        sender: (msg.sender === 'CLIENT' ? 'client' : msg.sender === 'AI' ? 'ai' : msg.sender === 'PAGE' ? 'page' : 'human') as ContextMessage['sender'],
        content:  msg.content,
        imageUrl: msg.imageUrl,
      }));

    const inboundText = conversation.messages.find((m) => m.sender === 'CLIENT')?.content ?? '';

    const messages = this.promptBuilder.buildReplyMessages(
      systemPrompt,
      latestSummary?.summary ?? null,
      recentMessages,
      inboundText,
    );

    const primaryModelId = modelConfig?.replyModelId    ?? REPLY_AI_MODEL.MODEL_ID;
    const temperature    = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;
    const modelsToTry = [
      primaryModelId,
      ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primaryModelId),
    ];

    let result: ChatCompletionResult | null = null;
    let lastError: unknown = null;
    let anyChunkEmitted = false;

    for (const candidateModel of modelsToTry) {
      try {
        result = await this.openRouter.completeStream(
          { model: candidateModel, messages, maxTokens: SUGGESTION_MAX_TOKENS, temperature },
          (chunk) => {
            anyChunkEmitted = true;
            onChunk(chunk);
          },
        );
        break;
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (anyChunkEmitted) {
          // Text is already visible to the agent — retrying with another
          // model would append contradictory/duplicated content. Surface
          // the error as-is instead.
          this.logger.warn(`Suggestion stream failed mid-way for conv=${conversationId}: ${msg}`);
          break;
        }
        this.logger.warn(
          `Suggestion model ${candidateModel} failed for conv=${conversationId}: ${msg} — trying next`,
        );
      }
    }

    if (!result) {
      throw lastError instanceof Error ? lastError : new Error('Tous les modèles IA ont échoué.');
    }

    if (result.totalTokens > 0) {
      await this.creditService
        .consumeCredits(userId, result.totalTokens, 'AI_SUGGESTION_CONSUME', result.model, conversationId)
        .catch((err: Error) =>
          this.logger.warn(`Credit deduction failed conv=${conversationId}: ${err.message}`),
        );
    }

    return { fullText: result.content, tokensUsed: result.totalTokens, modelId: result.model };
  }
}
