/**
 * @file features/facebook-posts/services/post-comment-ai.service.ts
 *
 * Orchestrates AI-powered comment handling for Facebook posts.
 *
 * PROMPT SEPARATION (fix applied)
 * ──────────────────────────────
 * Now uses CommentPromptBuilderService exclusively.
 * The old PromptBuilderService (inbox system) is no longer imported here,
 * preventing the "redirect to DM inside a DM" contamination bug.
 *
 * SSE EMISSION
 * ────────────
 * Emits PostsEventEmitter events so the frontend receives real-time updates:
 *   - comment:new     → when a comment is loaded for processing (before AI reply)
 *   - comment:replied → after a successful AI public reply
 *
 * FLOW
 * ────
 * 1. WebhookService receives a new comment → queues processNewComment
 * 2. processNewComment:
 *    a. Load comment + business context
 *    b. Spam filter
 *    c. Emit comment:new SSE (frontend sees comment immediately)
 *    d. Generate + send public reply
 *    e. Emit comment:replied SSE
 *    f. If privateReplyEnabled → generate + send private DM
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import { REPLY_AI_FALLBACK_MODELS, REPLY_AI_MODEL } from '../../../ai/config/ai-models.config.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';
import {
  CommentPromptBuilderService,
  type CommentBusinessContext,
  type CommentReferenceImage,
  type DetectedLanguage,
} from './comment-prompt-builder.service.js';
import { FacebookPostsService } from './facebook-posts.service.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ModelConfig  = { replyModelId: string; replyTemperature: number } | null;

@Injectable()
export class PostCommentAiService {
  private readonly logger = new Logger(PostCommentAiService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly openRouter:      OpenRouterClient,
    private readonly commentPrompts:  CommentPromptBuilderService, // NEW — separated
    private readonly fbPosts:         FacebookPostsService,
    private readonly sseEmitter:      PostsEventEmitter,           // NEW — real-time
  ) {}

  // ─── Main entry ───────────────────────────────────────────────────────────

  async processNewComment(commentId: string): Promise<void> {
    const comment = await this.prisma.postComment.findUnique({
      where:   { id: commentId },
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

    // Guards
    if (!aiConfig?.autoReply || config?.autoReply === false) return;
    if (comment.isReplied) return;

    // Spam filter
    const spam = this.commentPrompts.scoreComment(comment.message);
    if (!spam.shouldReply) {
      this.logger.debug(
        `Comment ${commentId} skipped — score=${spam.score} (${spam.reason})`,
      );
      return;
    }

    // ── Emit comment:new so the frontend sees it immediately ─────────────────
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

    // ── Build shared context ──────────────────────────────────────────────────
    const commentLang: DetectedLanguage =
      (config?.replyLanguage as DetectedLanguage | null) ??
      this.commentPrompts.detectLanguage(comment.message);

    const ctx: CommentBusinessContext = {
      businessName:    bp.name,
      businessType:    bp.businessType,
      description:     bp.description,
      tone:            config?.tone            ?? aiConfig.tone            ?? 'FRIENDLY',
      responseStyle:   config?.responseStyle   ?? aiConfig.responseStyle   ?? 'SHORT',
      replyLanguage:   config?.replyLanguage   ?? aiConfig.replyLanguage   ?? null,
      systemPrompt:    aiConfig.systemPrompt   ?? null,
      blockedKeywords: (aiConfig.blockedKeywords as string[]) ?? [],
      allowedTopics:   (aiConfig.allowedTopics  as string[]) ?? [],
    };

    const images: CommentReferenceImage[] = bp.chatResources.flatMap((r) =>
      r.images.map((img) => ({ url: img.url, description: img.description })),
    );

    const postCaption = post.message ?? '';

    // ── Public comment reply ──────────────────────────────────────────────────
    const publicMaxTokens = Math.min(
      config?.maxReplyTokens ?? aiConfig.maxReplyTokens ?? 120,
      120,
    );

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

    // ── Emit comment:replied SSE ──────────────────────────────────────────────
    this.sseEmitter.commentReplied(bp.userId, post.id, commentId, {
      content:     publicReply,
      repliedByAi: true,
    });

    this.logger.log(`AI replied publicly to comment=${commentId}`);

    // ── Private DM (optional) ─────────────────────────────────────────────────
    const privateEnabled =
      (config as { privateReplyEnabled?: boolean } | null)?.privateReplyEnabled ?? false;

    if (!privateEnabled) return;

    const fixedTemplate =
      (config as { privateReplyMessage?: string } | null)?.privateReplyMessage?.trim();

    let dmText: string | null = fixedTemplate ?? null;

    if (!dmText) {
      const dmPrompt = this.commentPrompts.buildPrivateDmReplyPrompt(
        ctx,
        postCaption,
        comment.message,
        config?.customInstructions ?? null,
        images,
        commentLang,
      );

      dmText = await this.callModel(
        [
          { role: 'system', content: dmPrompt },
          /**
           * Neutral trigger — NOT the comment text again.
           * Passing the comment as the user message caused the AI to
           * respond TO the comment rather than generate a welcoming opener.
           */
          { role: 'user', content: 'Génère le message privé de bienvenue.' },
        ],
        150, // DMs should be short — 2-3 sentences max
        bp.aiModelConfig,
      );
    }

    if (dmText) {
      await this.fbPosts.sendPrivateReplyToComment(commentId, dmText, true);
      this.logger.log(`AI sent private DM for comment=${commentId}`);
    }
  }

  // ─── Model call with fallback ─────────────────────────────────────────────

  private async callModel(
    messages:    ChatMessage[],
    maxTokens:   number,
    modelConfig: ModelConfig,
  ): Promise<string | null> {
    const primary     = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const temperature = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;

    const models = [
      primary,
      ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primary),
    ];

    for (const modelId of models) {
      try {
        const result = await this.openRouter.complete({
          model:       modelId,
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
