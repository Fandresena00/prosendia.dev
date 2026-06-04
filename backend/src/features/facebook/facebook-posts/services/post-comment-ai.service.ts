/**
 * @file features/facebook-posts/services/post-comment-ai.service.ts
 *
 * CHANGE: Intégration CreditService.
 *   - Vérifie les crédits AVANT l'appel IA (blocage si 0)
 *   - callModel() retourne maintenant { content, totalTokens, modelId }
 *   - Déduit les crédits APRÈS chaque appel réussi (public + DM privé)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import {
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../../../ai/config/ai-models.config.js';
import { CreditService } from '../../../billing/services/credit.service.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';
import {
  CommentPromptBuilderService,
  type CommentBusinessContext,
  type CommentReferenceImage,
  type DetectedLanguage,
} from './comment-prompt-builder.service.js';
import { FacebookPostsService } from './facebook-posts.service.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ModelConfig = { replyModelId: string; replyTemperature: number } | null;
type ModelResult = { content: string; totalTokens: number; modelId: string };

export interface ProcessCommentOptions {
  emitNew?: boolean;
}

@Injectable()
export class PostCommentAiService {
  private readonly logger = new Logger(PostCommentAiService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly openRouter:     OpenRouterClient,
    private readonly commentPrompts: CommentPromptBuilderService,
    private readonly fbPosts:        FacebookPostsService,
    private readonly sseEmitter:     PostsEventEmitter,
    private readonly creditService:  CreditService,
  ) {}

  // ─── Main entry ────────────────────────────────────────────────────────────

  async processNewComment(
    commentId: string,
    options:   ProcessCommentOptions = {},
  ): Promise<void> {
    const { emitNew = true } = options;

    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: {
            postAiConfig: true,
            businessProfile: {
              include: {
                aiConfig:      true,
                aiModelConfig: true,
                chatResources: {
                  where:   { isActive: true },
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
    const config   = post.postAiConfig;
    const bp       = post.businessProfile;
    const aiConfig = bp.aiConfig;

    if (config?.autoReply !== true) return;
    if (comment.isReplied) return;

    const spam = this.commentPrompts.scoreComment(comment.message);
    if (!spam.shouldReply) {
      this.logger.debug(`Comment ${commentId} skipped — score=${spam.score} (${spam.reason})`);
      return;
    }

    // ⭐ CREDIT CHECK — bloquer si solde épuisé
    const hasCredits = await this.creditService.hasCredits(bp.userId);
    if (!hasCredits) {
      this.logger.warn(`Comment AI blocked — no credits: user=${bp.userId} comment=${commentId}`);
      return;
    }

    if (emitNew) {
      this.sseEmitter.commentAdded(bp.userId, post.id, {
        id:              comment.id,
        postId:          comment.postId,
        externalId:      comment.externalId,
        authorId:        comment.authorId,
        authorName:      comment.authorName,
        authorAvatarUrl: comment.authorAvatarUrl,
        message:         comment.message,
        commentedAt:     comment.commentedAt.toISOString(),
        isReplied:       false,
        replyContent:    null,
        repliedAt:       null,
        repliedByAi:     null,
      });
    }

    const commentLang: DetectedLanguage =
      (config?.replyLanguage as DetectedLanguage | null) ??
      this.commentPrompts.detectLanguage(comment.message);

    const ctx: CommentBusinessContext = {
      businessName:    bp.name,
      businessType:    bp.businessType,
      description:     bp.description,
      tone:            config?.tone ?? aiConfig?.tone ?? 'FRIENDLY',
      responseStyle:   config?.responseStyle ?? aiConfig?.responseStyle ?? 'SHORT',
      replyLanguage:   config?.replyLanguage ?? aiConfig?.replyLanguage ?? null,
      systemPrompt:    aiConfig?.systemPrompt ?? null,
      blockedKeywords: (aiConfig?.blockedKeywords as string[]) ?? [],
      allowedTopics:   (aiConfig?.allowedTopics as string[]) ?? [],
    };

    const images: CommentReferenceImage[] = bp.chatResources.flatMap((r) =>
      r.images.map((img) => ({ url: img.url, description: img.description })),
    );

    const postCaption     = post.message ?? '';
    const publicMaxTokens = Math.min(config?.maxReplyTokens ?? aiConfig?.maxReplyTokens ?? 120, 120);

    const publicPrompt = this.commentPrompts.buildPublicCommentReplyPrompt(
      ctx, postCaption, config?.customInstructions ?? null, images, commentLang,
    );

    const publicResult = await this.callModel(
      [
        { role: 'system', content: publicPrompt },
        { role: 'user',   content: comment.message },
      ],
      publicMaxTokens,
      bp.aiModelConfig,
    );

    if (!publicResult) {
      this.logger.warn(`No public reply generated for comment=${commentId}`);
      return;
    }

    const publicSend = await this.fbPosts.replyToCommentPublic(commentId, publicResult.content, true);
    if (!publicSend.success) return;

    // ⭐ CREDIT DEDUCTION — réponse publique
    if (publicResult.totalTokens > 0) {
      await this.creditService
        .consumeCredits(bp.userId, publicResult.totalTokens, 'COMMENT_AI_CONSUME', publicResult.modelId, undefined, commentId)
        .catch((err: Error) =>
          this.logger.warn(`Credit deduction failed comment=${commentId}: ${err.message}`),
        );
    }

    this.sseEmitter.commentReplied(bp.userId, post.id, commentId, {
      content:     publicResult.content,
      repliedByAi: true,
    });

    this.logger.log(`AI replied to comment=${commentId}`);

    // Optional private DM
    const privateEnabled = (config as { privateReplyEnabled?: boolean } | null)?.privateReplyEnabled ?? false;
    if (!privateEnabled) return;

    const fixedTemplate = (config as { privateReplyMessage?: string } | null)
      ?.privateReplyMessage?.trim() ?? null;

    let dmResult: ModelResult | null = null;
    let dmText: string | null        = fixedTemplate;

    if (!dmText) {
      const dmPrompt = this.commentPrompts.buildPrivateDmReplyPrompt(
        ctx, postCaption, comment.message, config?.customInstructions ?? null, images, commentLang,
      );
      dmResult = await this.callModel(
        [
          { role: 'system', content: dmPrompt },
          { role: 'user',   content: 'Génère le message privé de bienvenue.' },
        ],
        150,
        bp.aiModelConfig,
      );
      dmText = dmResult?.content ?? null;
    }

    if (dmText) {
      await this.fbPosts.sendPrivateReplyToComment(commentId, dmText, true);

      // ⭐ CREDIT DEDUCTION — DM privé généré par IA
      if (dmResult && dmResult.totalTokens > 0) {
        await this.creditService
          .consumeCredits(bp.userId, dmResult.totalTokens, 'COMMENT_AI_CONSUME', dmResult.modelId, undefined, commentId)
          .catch(() => undefined);
      }

      this.logger.log(`AI sent private DM for comment=${commentId}`);
    }
  }

  // ─── Model call with fallback chain ────────────────────────────────────────

  /**
   * Appelle OpenRouter avec fallback automatique.
   * Retourne content + totalTokens + modelId pour la déduction de crédits.
   */
  private async callModel(
    messages:    ChatMessage[],
    maxTokens:   number,
    modelConfig: ModelConfig,
  ): Promise<ModelResult | null> {
    const primary     = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const temperature = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;
    const models      = [primary, ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primary)];

    for (const modelId of models) {
      try {
        const result = await this.openRouter.complete({ model: modelId, messages, maxTokens, temperature });
        if (result.content.trim()) {
          return {
            content:     result.content.trim(),
            totalTokens: (result.promptTokens ?? 0) + (result.replyTokens ?? 0),
            modelId:     result.model ?? modelId,
          };
        }
      } catch (err) {
        this.logger.warn(`Model ${modelId} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return null;
  }
}
