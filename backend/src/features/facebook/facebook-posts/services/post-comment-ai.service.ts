/**
 * @file features/facebook-posts/services/post-comment-ai.service.ts
 *
 * CHANGES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * 1. MODEL SEPARATION — uses COMMENT_AI_MODEL / COMMENT_AI_FALLBACK_MODELS
 *    (features/ai/config/ai-models.config.ts) instead of REPLY_AI_MODEL,
 *    which is now reserved for the Messenger inbox. AiModelConfig may
 *    override via commentModelId/commentMaxTokens/commentTemperature.
 *
 * 2. FIX — "AI never replies to comments" (root cause #2):
 *    processNewComment() now accepts a `force` option. When true (manual
 *    "IA" button click via the controller), the spam-score filter
 *    (CommentPromptBuilderService.scoreComment) is BYPASSED. The base
 *    score in CommentPromptBuilderService was also raised (50 → 65) so
 *    normal comments pass the threshold by default — see that file's header.
 *
 * 3. FEEDBACK — processNewComment() returns a `ProcessCommentResult`
 *    instead of `void`, so the controller (manual trigger) and the worker
 *    (queue-based trigger) can report WHY no reply was sent.
 *
 * 4. NEW — Non-AI keyword rules & "reply to all" switch
 *    ────────────────────────────────────────────────────
 *    Some instructions are fully deterministic ("reply 'test' to any
 *    comment containing 'test'") and should NOT go through the LLM at
 *    all — faster, more reliable, and FREE (0 credits):
 *
 *      - PostAiConfig.keywordRules (KeywordRule[]):
 *          replyText SET   → fixed reply posted directly, 0 AI calls.
 *          replyText NULL  → bypasses the spam filter, AI replies as usual
 *                             (credits consumed) — for "this kind of
 *                             comment deserves attention" without
 *                             dictating exact wording.
 *      - PostAiConfig.replyToAllComments: bypasses the spam filter for
 *        EVERY comment on this post (AI still consumes credits per reply).
 *
 *    Both are evaluated BEFORE the spam-score check, so explicit user
 *    configuration always wins.
 *
 * 5. NEW — aiSkipped / aiSkipReason / aiSpamScore persistence + SSE
 *    `comment:ai_skipped` event, so the frontend can show "IA: pas de
 *    réponse (ressemble à du spam)" instead of looking broken.
 *
 * 6. NEW — generateFieldSuggestion(): powers the "✨ Suggestion IA" button
 *    in the post configuration panel (private DM message / custom
 *    instructions). Every call checks AND consumes credits
 *    (type 'AI_SUGGESTION_CONSUME').
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { OpenRouterClient } from '../../../ai/clients/openrouter.client.js';
import {
  COMMENT_AI_FALLBACK_MODELS,
  COMMENT_AI_MODEL,
} from '../../../ai/config/ai-models.config.js';
import { CreditService } from '../../../billing/services/credit.service.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';
import {
  CommentPromptBuilderService,
  type CommentBusinessContext,
  type CommentReferenceImage,
  type DetectedLanguage,
  type KeywordRule,
  type SuggestibleField,
} from './comment-prompt-builder.service.js';
import { FacebookPostsService } from './facebook-posts.service.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ModelConfig = {
  commentModelId?:     string | null;
  commentMaxTokens?:   number | null;
  commentTemperature?: number | null;
} | null;
type ModelResult = { content: string; totalTokens: number; modelId: string };

export interface ProcessCommentOptions {
  /** Emit `comment:new` over SSE before processing (default true). */
  emitNew?: boolean;
  /**
   * Bypass the spam-score filter. Use for explicit user-triggered replies
   * (the "IA" button) — the user has already decided this comment deserves
   * a reply, regardless of the heuristic score.
   */
  force?: boolean;
}

export type ProcessCommentSkipReason =
  | 'autoreply_disabled'
  | 'already_replied'
  | 'spam_filtered'
  | 'no_credits'
  | 'no_model_response'
  | 'comment_not_found';

export interface ProcessCommentResult {
  success: boolean;
  /** Present when success=false — machine-readable reason for the UI. */
  reason?: ProcessCommentSkipReason;
  /** Human-readable message (French) suitable for a toast. */
  message?: string;
  /** Spam score, included for debugging/manual-trigger feedback. */
  spamScore?: number;
  /** True when a non-AI keyword rule produced the reply (0 credits). */
  ruleMatched?: boolean;
}

export interface FieldSuggestionResult {
  suggestion:  string;
  creditsUsed: number;
}

/** Safely parses PostAiConfig.keywordRules (Prisma Json) into KeywordRule[]. */
function parseKeywordRules(raw: unknown): KeywordRule[] {
  if (!Array.isArray(raw)) return [];

  const rules: KeywordRule[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.keyword !== 'string' || !r.keyword.trim()) continue;

    rules.push({
      id:               typeof r.id === 'string' ? r.id : '',
      keyword:          r.keyword,
      matchType:        r.matchType === 'exact' ? 'exact' : 'contains',
      replyText:        typeof r.replyText === 'string' && r.replyText.trim() ? r.replyText : null,
      sendPrivateReply: Boolean(r.sendPrivateReply),
      privateReplyText: typeof r.privateReplyText === 'string' && r.privateReplyText.trim()
        ? r.privateReplyText
        : null,
    });
  }
  return rules;
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
  ): Promise<ProcessCommentResult> {
    const { emitNew = true, force = false } = options;

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
      return {
        success: false,
        reason:  'comment_not_found',
        message: 'Commentaire introuvable.',
      };
    }

    const { post } = comment;
    const config   = post.postAiConfig;
    const bp       = post.businessProfile;
    const aiConfig = bp.aiConfig;

    // FIX: previously this silently returned `void` — the manual "IA"
    // button gave the user zero feedback when autoReply was off.
    if (config?.autoReply !== true) {
      this.logger.debug(`Comment ${commentId} skipped — autoReply is off for post=${post.id}`);
      return {
        success: false,
        reason:  'autoreply_disabled',
        message: "Les réponses automatiques IA sont désactivées pour ce post. " +
                 "Activez-les dans l'onglet Configuration IA.",
      };
    }

    if (comment.isReplied) {
      return {
        success: false,
        reason:  'already_replied',
        message: 'Ce commentaire a déjà une réponse.',
      };
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

    // ── NEW: deterministic, non-AI keyword rules ───────────────────────────
    // Evaluated BEFORE the spam filter so explicit user configuration
    // always wins, regardless of how "spammy" the comment looks.
    const rules       = parseKeywordRules(config.keywordRules);
    const matchedRule = this.commentPrompts.findMatchingKeywordRule(rules, comment.message);

    if (matchedRule?.replyText) {
      // Fixed reply — ZERO AI calls, ZERO credits consumed.
      return this.handleFixedRuleReply(comment.id, post.id, bp.userId, matchedRule);
    }

    let ruleContext: string | undefined;
    if (matchedRule) {
      // replyText is null → bypass spam filter, AI generates the reply.
      ruleContext =
        `Ce commentaire correspond au mot-clé configuré « ${matchedRule.keyword} ». ` +
        "Le propriétaire de la page veut qu'on y réponde même s'il pourrait " +
        'sembler peu prioritaire — traite-le normalement.';
    }

    const bypassSpamFilter =
      force || config.replyToAllComments === true || matchedRule !== null;

    const spam = this.commentPrompts.scoreComment(comment.message);
    if (!spam.shouldReply && !bypassSpamFilter) {
      this.logger.debug(`Comment ${commentId} skipped — score=${spam.score} (${spam.reason})`);

      await this.markAiSkipped(commentId, 'spam_filtered', spam.score);

      const message =
        `Ce commentaire ressemble à du spam ou n'apporte pas assez de ` +
        `contexte pour une réponse automatique (score ${spam.score}/100). ` +
        `L'IA n'a pas répondu. Vous pouvez forcer une réponse avec le bouton IA.`;

      this.sseEmitter.commentAiSkipped(bp.userId, post.id, commentId, {
        reason:    'spam_filtered',
        spamScore: spam.score,
        message,
      });

      return {
        success:   false,
        reason:    'spam_filtered',
        spamScore: spam.score,
        message,
      };
    }
    if (!spam.shouldReply && bypassSpamFilter) {
      this.logger.debug(
        `Comment ${commentId} — spam score=${spam.score} below threshold, ` +
        'bypassed by configuration (force / replyToAllComments / keyword rule)',
      );
    }

    // ⭐ CREDIT CHECK — bloquer si solde épuisé
    const hasCredits = await this.creditService.hasCredits(bp.userId);
    if (!hasCredits) {
      this.logger.warn(`Comment AI blocked — no credits: user=${bp.userId} comment=${commentId}`);
      return {
        success: false,
        reason:  'no_credits',
        message: 'Crédits IA épuisés. Rechargez votre abonnement pour ' +
                 'continuer à utiliser les réponses automatiques.',
      };
    }

    const commentLang: DetectedLanguage =
      (config.replyLanguage as DetectedLanguage | null) ??
      this.commentPrompts.detectLanguage(comment.message);

    const ctx: CommentBusinessContext = {
      businessName:    bp.name,
      businessType:    bp.businessType,
      description:     bp.description,
      tone:            config.tone ?? aiConfig?.tone ?? 'FRIENDLY',
      responseStyle:   config.responseStyle ?? aiConfig?.responseStyle ?? 'SHORT',
      replyLanguage:   config.replyLanguage ?? aiConfig?.replyLanguage ?? null,
      systemPrompt:    aiConfig?.systemPrompt ?? null,
      blockedKeywords: (aiConfig?.blockedKeywords as string[]) ?? [],
      allowedTopics:   (aiConfig?.allowedTopics as string[]) ?? [],
    };

    const images: CommentReferenceImage[] = bp.chatResources.flatMap((r) =>
      r.images.map((img) => ({ url: img.url, description: img.description })),
    );

    // Point 7: postCaption may legitimately be empty (photo-only post).
    // The prompt builder promotes customInstructions to the primary
    // context when there's no caption.
    const postCaption     = post.message ?? '';
    const publicMaxTokens = Math.min(config.maxReplyTokens ?? aiConfig?.maxReplyTokens ?? 120, 120);

    const publicPrompt = this.commentPrompts.buildPublicCommentReplyPrompt(
      ctx, postCaption, config.customInstructions ?? null, images, commentLang, ruleContext,
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
      return {
        success: false,
        reason:  'no_model_response',
        message: "L'IA n'a pas pu générer de réponse (tous les modèles ont " +
                 'échoué). Réessayez dans quelques instants.',
      };
    }

    const publicSend = await this.fbPosts.replyToCommentPublic(commentId, publicResult.content, true);
    if (!publicSend.success) {
      return {
        success: false,
        reason:  'no_model_response',
        message: 'La réponse a été générée mais Facebook a refusé sa publication.',
      };
    }

    // ⭐ CREDIT DEDUCTION — réponse publique
    if (publicResult.totalTokens > 0) {
      await this.creditService
        .consumeCredits(bp.userId, publicResult.totalTokens, 'COMMENT_AI_CONSUME', publicResult.modelId, undefined, commentId)
        .catch((err: Error) =>
          this.logger.warn(`Credit deduction failed comment=${commentId}: ${err.message}`),
        );
    }

    await this.clearAiSkipped(commentId);

    this.sseEmitter.commentReplied(bp.userId, post.id, commentId, {
      content:     publicResult.content,
      repliedByAi: true,
    });

    this.logger.log(`AI replied to comment=${commentId}`);

    // Optional private DM
    const privateEnabled = config.privateReplyEnabled ?? false;
    if (!privateEnabled) {
      return { success: true, message: 'Réponse publique envoyée.' };
    }

    const fixedTemplate = config.privateReplyMessage?.trim() ?? null;

    let dmResult: ModelResult | null = null;
    let dmText: string | null        = fixedTemplate;

    if (!dmText) {
      const dmPrompt = this.commentPrompts.buildPrivateDmReplyPrompt(
        ctx, postCaption, comment.message, config.customInstructions ?? null, images, commentLang, ruleContext,
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

    return { success: true, message: 'Réponse publique et message privé envoyés.' };
  }

  // ─── Fixed (non-AI) keyword-rule reply ────────────────────────────────────

  /**
   * Posts a FIXED reply configured via PostAiConfig.keywordRules.
   * No OpenRouter call, no credit consumption — purely deterministic.
   */
  private async handleFixedRuleReply(
    commentId: string,
    postId:    string,
    userId:    string,
    rule:      KeywordRule,
  ): Promise<ProcessCommentResult> {
    const text = rule.replyText!.trim();

    const send = await this.fbPosts.replyToCommentPublic(commentId, text, true);
    if (!send.success) {
      return {
        success:     false,
        reason:      'no_model_response',
        message:     'Règle configurée déclenchée, mais Facebook a refusé la publication de la réponse.',
        ruleMatched: true,
      };
    }

    await this.clearAiSkipped(commentId);

    // repliedByAi=false: this is a deterministic rule, not an AI-generated reply.
    this.sseEmitter.commentReplied(userId, postId, commentId, {
      content:     text,
      repliedByAi: false,
    });

    this.logger.log(`Keyword rule "${rule.keyword}" replied to comment=${commentId} (0 credits)`);

    // Optional private reply for this rule
    if (rule.sendPrivateReply) {
      const dmText = rule.privateReplyText?.trim();
      if (dmText) {
        await this.fbPosts.sendPrivateReplyToComment(commentId, dmText, true).catch(() => undefined);
      }
      // Note: if rule.privateReplyText is empty, we deliberately do NOT
      // fall back to AI generation here — a matched keyword rule without a
      // private template means "no private message for this rule".
      // (AI-generated DMs remain available via PostAiConfig.privateReplyMessage
      // / privateReplyEnabled on the normal AI path.)
    }

    return {
      success:     true,
      ruleMatched: true,
      message:     `Réponse automatique envoyée via la règle "${rule.keyword}" (0 crédit utilisé).`,
    };
  }

  // ─── AI suggestion for config form fields ─────────────────────────────────

  /**
   * Generates an AI suggestion for a single PostAiConfig field
   * (`privateReplyMessage` or `customInstructions`), taking the current
   * field content into account so the suggestion refines/extends it
   * rather than starting from scratch.
   *
   * Consumes credits like any other AI call (type 'AI_SUGGESTION_CONSUME'),
   * per "toute utilisation IA consomme du crédit, même les suggestions".
   */
  async generateFieldSuggestion(
    postId:       string,
    field:        SuggestibleField,
    currentValue: string,
    userId:       string,
  ): Promise<FieldSuggestionResult> {
    const post = await this.prisma.facebookPost.findFirst({
      where: { id: postId, businessProfile: { userId } },
      include: {
        postAiConfig: true,
        businessProfile: {
          include: { aiConfig: true, aiModelConfig: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post ${postId} introuvable pour cet utilisateur.`);
    }

    const bp       = post.businessProfile;
    const config   = post.postAiConfig;
    const aiConfig = bp.aiConfig;

    // ⭐ CREDIT CHECK — suggestions consomment aussi des crédits
    const hasCredits = await this.creditService.hasCredits(userId);
    if (!hasCredits) {
      throw new NotFoundException(
        'Crédits IA épuisés. Rechargez votre abonnement pour utiliser les suggestions IA.',
      );
    }

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

    const prompt = this.commentPrompts.buildFieldSuggestionPrompt(
      ctx,
      field,
      currentValue,
      post.message ?? '',
    );

    const result = await this.callModel(
      [
        { role: 'system', content: prompt },
        { role: 'user',   content: 'Génère le contenu du champ.' },
      ],
      220,
      bp.aiModelConfig,
    );

    if (!result) {
      throw new NotFoundException(
        "L'IA n'a pas pu générer de suggestion (tous les modèles ont échoué). Réessayez.",
      );
    }

    let creditsUsed = 0;
    if (result.totalTokens > 0) {
      const deduction = await this.creditService
        .consumeCredits(userId, result.totalTokens, 'AI_SUGGESTION_CONSUME', result.modelId, undefined, postId)
        .catch((err: Error) => {
          this.logger.warn(`Credit deduction failed for suggestion post=${postId}: ${err.message}`);
          return null;
        });
      creditsUsed = deduction?.creditsDeducted ?? 0;
    }

    // Strip accidental surrounding quotes the model sometimes adds.
    const cleaned = result.content.trim().replace(/^["“]+|["”]+$/g, '').trim();

    return { suggestion: cleaned, creditsUsed };
  }

  // ─── aiSkipped persistence ──────────────────────────────────────────────────

  /**
   * Records that the AI evaluated this comment and chose NOT to reply.
   * Surfaced to the frontend via ApiComment.aiSkipped/aiSkipReason/spamScore
   * so the UI can show "IA: pas de réponse (ressemble à du spam)" instead
   * of appearing broken.
   */
  private async markAiSkipped(commentId: string, reason: string, spamScore: number): Promise<void> {
    await this.prisma.postComment.update({
      where: { id: commentId },
      data:  { aiSkipped: true, aiSkipReason: reason, aiSpamScore: spamScore },
    }).catch((err: unknown) =>
      this.logger.warn(`Failed to mark aiSkipped for comment=${commentId}: ${String(err)}`),
    );
  }

  /** Clears a previous aiSkipped flag once a reply is actually sent. */
  private async clearAiSkipped(commentId: string): Promise<void> {
    await this.prisma.postComment.update({
      where: { id: commentId },
      data:  { aiSkipped: false, aiSkipReason: null },
    }).catch(() => undefined);
  }

  // ─── Model call with fallback chain ────────────────────────────────────────

  /**
   * Appelle OpenRouter avec fallback automatique.
   * Retourne content + totalTokens + modelId pour la déduction de crédits.
   *
   * Uses COMMENT_AI_MODEL / COMMENT_AI_FALLBACK_MODELS by default — these
   * are SEPARATE from REPLY_AI_MODEL (Messenger inbox). A business profile
   * may override via AiModelConfig.commentModelId / commentMaxTokens /
   * commentTemperature; falls back to the comment defaults when unset.
   */
  private async callModel(
    messages:    ChatMessage[],
    maxTokens:   number,
    modelConfig: ModelConfig,
  ): Promise<ModelResult | null> {
    const primary     = modelConfig?.commentModelId ?? COMMENT_AI_MODEL.MODEL_ID;
    const temperature = modelConfig?.commentTemperature ?? COMMENT_AI_MODEL.TEMPERATURE;
    const effectiveMaxTokens = modelConfig?.commentMaxTokens ?? maxTokens;
    const models      = [primary, ...COMMENT_AI_FALLBACK_MODELS.filter((m) => m !== primary)];

    for (const modelId of models) {
      try {
        const result = await this.openRouter.complete({
          model: modelId,
          messages,
          maxTokens: effectiveMaxTokens,
          temperature,
        });
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
