/**
 * @file features/facebook/services/post-comment-ai.service.ts
 *
 * Orchestrates AI-powered comment handling:
 *
 * 1. SPAM FILTER: Scores incoming comments (heuristic, no AI tokens wasted).
 *    Only comments with score ≥ 60 get an AI reply.
 *
 * 2. PUBLIC COMMENT REPLY: Short 1-2 sentence reply, always redirects to DM.
 *    Configurable per-post via PostAiConfig.
 *
 * 3. PRIVATE REPLY: If `privateReplyEnabled` is true on the PostAiConfig,
 *    also sends a Facebook Private Reply (DM via comment_id) with more details.
 *    This is Facebook-allowed because it's a direct response to a comment.
 *
 * Called by:
 *   - WebhookService (when a new comment arrives via feed webhook)
 *   - FacebookPostsController (when manually triggered)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import {
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../../../ai/config/ai-models.config.js';
import {
  PromptBuilderService,
  type BusinessContext,
  type ReferenceImage,
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

  /**
   * Called when a new comment arrives on a post.
   * Decides whether to reply, and if so generates + sends the reply.
   */
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

    // Auto-reply must be enabled on both the global config and the post config
    if (!aiConfig?.autoReply || config?.autoReply === false) {
      this.logger.debug(`Auto-reply disabled for comment=${commentId}`);
      return;
    }

    // Already replied
    if (comment.isReplied) {
      this.logger.debug(`Comment ${commentId} already replied — skip`);
      return;
    }

    // ── Spam filter ──────────────────────────────────────────────────────────
    const spamResult = this.promptBuilder.scoreComment(comment.message);
    this.logger.debug(
      `Comment ${commentId} spam score: ${spamResult.score} (${spamResult.reason})`,
    );

    if (!spamResult.shouldReply) {
      this.logger.log(
        `Comment ${commentId} filtered as spam/noise (score=${spamResult.score}) — no reply`,
      );
      return;
    }

    // ── Build context ─────────────────────────────────────────────────────────
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

    // ── Generate public comment reply ─────────────────────────────────────────
    const publicReply = await this.generateCommentReply(
      businessCtx,
      postCaption,
      comment.message,
      config?.customInstructions ?? null,
      referenceImages,
      config?.maxReplyTokens ?? aiConfig?.maxReplyTokens ?? 150,
      businessProfile.aiModelConfig,
    );

    if (!publicReply) {
      this.logger.warn(
        `Failed to generate public reply for comment=${commentId}`,
      );
      return;
    }

    // Send public reply
    const publicResult = await this.fbPosts.replyToCommentPublic(
      commentId,
      publicReply,
      true, // repliedByAi
    );

    if (!publicResult.success) {
      this.logger.warn(`Failed to post public reply for comment=${commentId}`);
      return;
    }

    this.logger.log(`AI replied publicly to comment=${commentId}`);

    // ── Private reply (optional) ──────────────────────────────────────────────
    const privateEnabled =
      (config as { privateReplyEnabled?: boolean } | null)
        ?.privateReplyEnabled ?? false;

    if (privateEnabled) {
      const privateTemplate = (
        config as { privateReplyMessage?: string } | null
      )?.privateReplyMessage;

      const privateReplyText = privateTemplate?.trim()
        ? privateTemplate
        : await this.generatePrivateReply(
            businessCtx,
            postCaption,
            comment.message,
            config?.customInstructions ?? null,
            referenceImages,
            businessProfile.aiModelConfig,
          );

      if (privateReplyText) {
        const privateResult = await this.fbPosts.sendPrivateReplyToComment(
          commentId,
          privateReplyText,
          true,
        );

        if (privateResult.success) {
          this.logger.log(`AI sent private reply to comment=${commentId}`);
        }
      }
    }
  }

  // ─── Generate AI replies ─────────────────────────────────────────────────

  private async generateCommentReply(
    ctx: BusinessContext,
    postCaption: string,
    commentText: string,
    customInstructions: string | null,
    referenceImages: ReferenceImage[],
    maxTokens: number,
    modelConfig: { replyModelId: string; replyTemperature: number } | null,
  ): Promise<string | null> {
    const systemPrompt = this.promptBuilder.buildCommentReplySystemPrompt(
      ctx,
      postCaption,
      customInstructions,
      referenceImages,
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: commentText },
    ];

    return this.callWithFallback(
      messages,
      Math.min(maxTokens, 200),
      modelConfig,
    );
  }

  private async generatePrivateReply(
    ctx: BusinessContext,
    postCaption: string,
    commentText: string,
    customInstructions: string | null,
    referenceImages: ReferenceImage[],
    modelConfig: { replyModelId: string; replyTemperature: number } | null,
  ): Promise<string | null> {
    const systemPrompt = this.promptBuilder.buildPrivateReplyPrompt(
      ctx,
      postCaption,
      commentText,
      customInstructions,
      referenceImages,
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: commentText },
    ];

    return this.callWithFallback(messages, 300, modelConfig);
  }

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
