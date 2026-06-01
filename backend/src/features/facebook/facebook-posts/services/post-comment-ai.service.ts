/**
 * @file features/facebook-posts/services/post-comment-ai.service.ts
 *
 * Generates and sends AI replies to Facebook post comments.
 *
 * Entry point: processNewComment(commentId, options)
 *
 * Called from two paths:
 *   - Webhook path (emitNew: true, default): comment just arrived via webhook.
 *     Emits comment:new SSE before processing so the frontend sees it immediately.
 *   - Scheduler fallback (emitNew: false): comment already in DB and visible.
 *     Skips comment:new, only emits comment:replied after AI replies.
 *
 * AI gate: the post-level PostAiConfig.autoReply flag is the ONLY gate.
 *   The global AiConfig.autoReply has no effect on post comments —
 *   each post's AI is independently controlled via the "Add post" UI.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import {
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../../../ai/config/ai-models.config.js';
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

export interface ProcessCommentOptions {
  /**
   * Whether to emit comment:new SSE before processing.
   * True for webhook path (comment is genuinely new).
   * False for scheduler fallback (comment already visible in the UI).
   */
  emitNew?: boolean;
}

@Injectable()
export class PostCommentAiService {
  private readonly logger = new Logger(PostCommentAiService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly openRouter:      OpenRouterClient,
    private readonly commentPrompts:  CommentPromptBuilderService,
    private readonly fbPosts:         FacebookPostsService,
    private readonly sseEmitter:      PostsEventEmitter,
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

    // Gate: AI only runs when the POST-LEVEL autoReply is explicitly enabled.
    // The global AiConfig.autoReply does not control post comment AI.
    if (config?.autoReply !== true) return;

    if (comment.isReplied) return;

    // Spam filter — skip low-value comments.
    const spam = this.commentPrompts.scoreComment(comment.message);
    if (!spam.shouldReply) {
      this.logger.debug(
        `Comment ${commentId} skipped — score=${spam.score} (${spam.reason})`,
      );
      return;
    }

    // Emit comment:new only for the webhook path (genuinely new comment).
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

    // Build prompt context.
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

    const postCaption = post.message ?? '';
    const publicMaxTokens = Math.min(
      config?.maxReplyTokens ?? aiConfig?.maxReplyTokens ?? 120,
      120,
    );

    // Generate and send the public comment reply.
    const publicPrompt = this.commentPrompts.buildPublicCommentReplyPrompt(
      ctx, postCaption, config?.customInstructions ?? null, images, commentLang,
    );

    const publicReply = await this.callModel(
      [
        { role: 'system', content: publicPrompt },
        { role: 'user',   content: comment.message },
      ],
      publicMaxTokens,
      bp.aiModelConfig,
    );

    if (!publicReply) {
      this.logger.warn(`No public reply generated for comment=${commentId}`);
      return;
    }

    const publicResult = await this.fbPosts.replyToCommentPublic(
      commentId, publicReply, true,
    );
    if (!publicResult.success) return;

    // Emit comment:replied so the frontend updates the comment inline
    // without a page refresh — this fires on both webhook and scheduler paths.
    this.sseEmitter.commentReplied(bp.userId, post.id, commentId, {
      content:      publicReply,
      repliedByAi:  true,
    });

    this.logger.log(`AI replied to comment=${commentId}`);

    // Optional private DM reply.
    const privateEnabled =
      (config as { privateReplyEnabled?: boolean } | null)?.privateReplyEnabled ?? false;

    if (!privateEnabled) return;

    const fixedTemplate = (config as { privateReplyMessage?: string } | null)
      ?.privateReplyMessage?.trim() ?? null;

    let dmText: string | null = fixedTemplate;

    if (!dmText) {
      const dmPrompt = this.commentPrompts.buildPrivateDmReplyPrompt(
        ctx, postCaption, comment.message, config?.customInstructions ?? null, images, commentLang,
      );
      dmText = await this.callModel(
        [
          { role: 'system', content: dmPrompt },
          { role: 'user',   content: 'Génère le message privé de bienvenue.' },
        ],
        150,
        bp.aiModelConfig,
      );
    }

    if (dmText) {
      await this.fbPosts.sendPrivateReplyToComment(commentId, dmText, true);
      this.logger.log(`AI sent private DM for comment=${commentId}`);
    }
  }

  // ─── Model call with fallback chain ────────────────────────────────────────

  private async callModel(
    messages:    ChatMessage[],
    maxTokens:   number,
    modelConfig: ModelConfig,
  ): Promise<string | null> {
    const primary     = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const temperature = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;
    const models      = [primary, ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primary)];

    for (const modelId of models) {
      try {
        const result = await this.openRouter.complete({
          model: modelId,
          messages,
          maxTokens,
          temperature,
        });
        if (result.content.trim()) return result.content.trim();
      } catch (err) {
        this.logger.warn(
          `Model ${modelId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return null;
  }
}
