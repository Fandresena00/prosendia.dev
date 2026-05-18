/**
 * @file features/facebook-posts/services/post-comment-ai.service.ts
 *
 * Orchestrates AI-powered comment handling.
 *
 * FIXES
 * ─────
 * 1. PROMPT SEPARATION: The public comment reply and the private DM reply are
 *    now fully decoupled. The DM prompt no longer receives the comment text as
 *    the user message (which caused the AI to reproduce the comment content
 *    as a numbered list or detailed tutorial).
 *
 * 2. LANGUAGE CONSISTENCY: Added explicit single-language enforcement rule.
 *    The AI was mixing Malagasy and French in the same response (e.g. Malagasy
 *    header + French numbered list). New rule: detect once, use throughout.
 *
 * 3. DM TOKEN LIMIT: Reduced from 300 to 150 tokens. The DM should be a short
 *    warm welcome (2-3 sentences), not a full tutorial.
 *
 * 4. COMMENT REPLY TOKEN LIMIT: Hard-capped at 120 tokens (was 200). Public
 *    comments must be 1-2 sentences + DM invite only.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import {
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../../../ai/config/ai-models.config.js';
import {
  BusinessContext,
  PromptBuilderService,
  ReferenceImage,
} from '../../../ai/services/prompt-builder.service.js';
import { FacebookPostsService } from './facebook-posts.service.js';

@Injectable()
export class PostCommentAiService {
  private readonly logger = new Logger(PostCommentAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterClient,
    private readonly promptBuilder: PromptBuilderService,
    private readonly fbPosts: FacebookPostsService,
  ) {}

  // ─── Main entry: process a new comment ───────────────────────────────────

  async processNewComment(commentId: string): Promise<void> {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: {
            postAiConfig: true,
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
        },
      },
    });

    if (!comment) {
      this.logger.warn(`Comment ${commentId} not found`);
      return;
    }

    const { post } = comment;
    const config = post.postAiConfig;
    const { businessProfile } = post;
    const aiConfig = businessProfile.aiConfig;

    if (!aiConfig?.autoReply || config?.autoReply === false) {
      this.logger.debug(`Auto-reply disabled for comment=${commentId}`);
      return;
    }

    if (comment.isReplied) {
      this.logger.debug(`Comment ${commentId} already replied — skip`);
      return;
    }

    // Spam filter
    const spamResult = this.promptBuilder.scoreComment(comment.message);
    if (!spamResult.shouldReply) {
      this.logger.log(
        `Comment ${commentId} filtered (score=${spamResult.score}) — no reply`,
      );
      return;
    }

    // Build context
    const businessCtx: BusinessContext = {
      businessName: businessProfile.name,
      businessType: businessProfile.businessType,
      description: businessProfile.description,
      tone: config?.tone ?? aiConfig?.tone ?? 'FRIENDLY',
      responseStyle:
        config?.responseStyle ?? aiConfig?.responseStyle ?? 'SHORT',
      replyLanguage: config?.replyLanguage ?? aiConfig?.replyLanguage ?? null,
      systemPrompt: aiConfig?.systemPrompt ?? null,
      inboxInstructions: null,
      personalizeGreeting: aiConfig?.personalizeGreeting ?? true,
      blockedKeywords: (aiConfig?.blockedKeywords as string[]) ?? [],
      allowedTopics: (aiConfig?.allowedTopics as string[]) ?? [],
      escalationThreshold: aiConfig?.escalationThreshold ?? 0.6,
    };

    const referenceImages: ReferenceImage[] =
      businessProfile.chatResources.flatMap((r) =>
        r.images.map((img) => ({ url: img.url, description: img.description })),
      );

    const postCaption = post.message ?? '';

    // ── Public comment reply ──────────────────────────────────────────────────
    // Max 120 tokens: 1-2 sentences + DM invite only.
    const publicMaxTokens = Math.min(
      config?.maxReplyTokens ?? aiConfig?.maxReplyTokens ?? 120,
      120,
    );

    const systemPromptComment =
      this.promptBuilder.buildCommentReplySystemPrompt(
        businessCtx,
        postCaption,
        config?.customInstructions ?? null,
        referenceImages,
      );

    const publicReply = await this.callWithFallback(
      [
        { role: 'system' as const, content: systemPromptComment },
        { role: 'user' as const, content: comment.message },
      ],
      publicMaxTokens,
      businessProfile.aiModelConfig,
    );

    if (!publicReply) {
      this.logger.warn(
        `Failed to generate public reply for comment=${commentId}`,
      );
      return;
    }

    const publicResult = await this.fbPosts.replyToCommentPublic(
      commentId,
      publicReply,
      true,
    );

    if (!publicResult.success) {
      this.logger.warn(`Failed to post public reply for comment=${commentId}`);
      return;
    }

    this.logger.log(`AI replied publicly to comment=${commentId}`);

    // ── Private DM reply (optional) ───────────────────────────────────────────
    // FIX: completely separate prompt + do NOT pass commentText as user message
    // to avoid reproducing the comment content as a numbered list/tutorial.
    const privateEnabled =
      (config as { privateReplyEnabled?: boolean } | null)
        ?.privateReplyEnabled ?? false;

    if (privateEnabled) {
      const privateTemplate = (
        config as { privateReplyMessage?: string } | null
      )?.privateReplyMessage;

      let privateReplyText: string | null = null;

      if (privateTemplate?.trim()) {
        privateReplyText = privateTemplate.trim();
      } else {
        // FIX: separate DM prompt, neutral user trigger (not the comment text)
        const systemPromptDm = this.buildDmReplySystemPrompt(
          businessCtx,
          postCaption,
          comment.message,
          config?.customInstructions ?? null,
          referenceImages,
        );

        privateReplyText = await this.callWithFallback(
          [
            { role: 'system' as const, content: systemPromptDm },
            // FIX: neutral trigger — NOT the comment text again.
            // Passing commentText here caused the AI to respond TO the comment
            // instead of generating a welcoming DM.
            {
              role: 'user' as const,
              content: 'Génère le message privé de bienvenue.',
            },
          ],
          150, // FIX: was 300 — DM should be 2-3 sentences, not a tutorial
          businessProfile.aiModelConfig,
        );
      }

      if (privateReplyText) {
        const privateResult = await this.fbPosts.sendPrivateReplyToComment(
          commentId,
          privateReplyText,
          true,
        );
        if (privateResult.success) {
          this.logger.log(`AI sent private DM to comment=${commentId}`);
        }
      }
    }
  }

  // ─── Private DM system prompt ─────────────────────────────────────────────

  /**
   * Builds a system prompt specifically for the PRIVATE DM reply.
   *
   * KEY DIFFERENCES from comment reply prompt:
   * - The DM is a private conversation opener, not a public response
   * - Slightly more detailed (2-3 sentences vs 1-2)
   * - Still redirects to the conversation for details (not the public post)
   * - STRICT: one language only, no mid-response language switching
   *
   * FIX for language mixing: explicit "use ONE language for the ENTIRE response"
   * instruction. The old prompt said "detect language" but not "stay in it".
   */
  private buildDmReplySystemPrompt(
    ctx: BusinessContext,
    postCaption: string,
    commentText: string,
    customInstructions: string | null,
    referenceImages: ReferenceImage[],
  ): string {
    const sections: string[] = [];

    // Identity
    sections.push(
      `Tu es l'assistant de "${ctx.businessName}".` +
        (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (ctx.systemPrompt?.trim()) {
      sections.push(ctx.systemPrompt.trim());
    }

    // Context (brief, no reproduction of comment)
    sections.push(
      'CONTEXTE:\n' +
        `Post Facebook: ${postCaption.slice(0, 150)}\n` +
        'Un client a commenté ce post et tu lui envoies un MESSAGE PRIVÉ de bienvenue.',
    );

    // DM rules — short and welcoming
    sections.push(
      'RÈGLES DU MESSAGE PRIVÉ:\n' +
        '- 2 à 3 phrases MAXIMUM. Message chaleureux et court.\n' +
        '- Accueille le client, montre que tu as vu son commentaire.\n' +
        "- Propose de l'aider dans cette conversation.\n" +
        '- Ne reproduis PAS les étapes, listes ou tutoriels du post.\n' +
        "- Ne commence JAMAIS par «Bonjour» suivi d'une liste numérotée.\n" +
        '- Ne fournis PAS de prix, stock ou détails ici — invite à poser la question.\n' +
        "- JAMAIS d'inventions.",
    );

    // Language — STRICT single-language rule
    if (ctx.replyLanguage) {
      const langLabel =
        ctx.replyLanguage === 'mg'
          ? 'malgache'
          : ctx.replyLanguage === 'fr'
            ? 'français'
            : ctx.replyLanguage;
      sections.push(
        `LANGUE: Rédige ENTIÈREMENT en ${langLabel}. Aucun mot dans une autre langue.`,
      );
    } else {
      // FIX: detect from comment, then use ONE language throughout
      const commentLang = this.detectCommentLanguage(commentText);
      if (commentLang === 'mg') {
        sections.push(
          'LANGUE: Le client a écrit en malgache.\n' +
            'Réponds ENTIÈREMENT en malgache. Tu peux utiliser des termes techniques en français ' +
            "UNIQUEMENT si aucun équivalent malgache n'existe (ex: «site web», «commande»).\n" +
            'Ne bascule PAS vers le français pour les phrases entières.\n' +
            'Format: texte simple, pas de listes numérotées.',
        );
      } else {
        sections.push(
          'LANGUE: Le client a écrit en français.\n' +
            'Réponds ENTIÈREMENT en français. Pas de malgache.\n' +
            'Format: texte simple, pas de listes numérotées.',
        );
      }
    }

    if (customInstructions?.trim()) {
      sections.push(customInstructions.trim());
    }

    if (referenceImages.length > 0) {
      sections.push(
        'Produits/services disponibles:\n' +
          referenceImages.map((img) => `- ${img.description}`).join('\n'),
      );
    }

    sections.push(
      'FORMAT: Texte brut uniquement. Commence directement. Aucune liste.',
    );

    return sections.join('\n\n');
  }

  /**
   * Heuristic language detection for the private DM prompt.
   * Returns 'mg' for Malagasy, 'fr' for French (default).
   */
  private detectCommentLanguage(text: string): 'mg' | 'fr' {
    const lower = text.toLowerCase();
    const mgWords = [
      'mba',
      'azafady',
      'vidiny',
      'firy',
      'misy',
      'tena',
      'ity',
      'izy',
      'manao',
      'misoatra',
      'manahoana',
      'omeo',
      'hividiana',
      'mila',
      'ny',
    ];
    const mgScore = mgWords.filter((w) => lower.includes(w)).length;
    return mgScore >= 2 ? 'mg' : 'fr';
  }

  // ─── AI call with fallback ────────────────────────────────────────────────

  private async callWithFallback(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    modelConfig: { replyModelId: string; replyTemperature: number } | null,
  ): Promise<string | null> {
    const primaryModelId = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const temperature =
      modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;

    const modelsToTry = [
      primaryModelId,
      ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primaryModelId),
    ];

    for (const modelId of modelsToTry) {
      try {
        const result = await this.openRouter.complete({
          model: modelId,
          messages,
          maxTokens,
          temperature,
        });
        if (result.content.trim()) return result.content.trim();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Comment reply model ${modelId} failed: ${msg}`);
      }
    }

    return null;
  }
}
