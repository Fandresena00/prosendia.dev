/**
 * @file features/ai/services/reply-ai.service.ts
 *
 * FIXES
 * ─────
 * 1. MODEL FALLBACK CHAIN
 *    If the primary model returns an empty response (after thinking-chain
 *    stripping) or throws, the service automatically retries with the next
 *    model in REPLY_AI_FALLBACK_MODELS. This ensures a reply is always
 *    attempted even when a model is temporarily unavailable or rate-limited.
 *
 * 2. THINKING MODEL RESILIENCE
 *    Models can change at any time. Stripping is done in openrouter.client.ts,
 *    but if a new thinking model sends reasoning-only output (nothing after
 *    stripping), the fallback chain activates so customers still get a reply.
 *
 * 3. EMPTY CONTEXT GUARD
 *    If the conversation has no messages (ghost conversation with no sync),
 *    the service returns early and marks the conversation as not needing a reply
 *    instead of sending an empty or nonsensical AI response.
 *
 * 4. IMAGE EXTRACTION
 *    Unchanged — [IMAGE: url] tokens are extracted from the reply text and
 *    sent as separate image messages before the text message.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { FacebookMessagingService } from '../../facebook/services/facebook-messaging.service.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import {
  AI_CONTEXT_CONFIG,
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../config/ai-models.config.js';
import { PromptBuilderService, type BusinessContext, type ReferenceImage } from './prompt-builder.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplyContext {
  inboundMessageId?:  string;
  inboundText?:       string;
  inboundCreatedAt?:  string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReplyAiService {
  private readonly logger = new Logger(ReplyAiService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly openRouter:      OpenRouterClient,
    private readonly promptBuilder:   PromptBuilderService,
    private readonly fbMessaging:     FacebookMessagingService,
    private readonly sseEmitter:      InboxEventEmitter,
  ) {}

  // ─── Main entry point ─────────────────────────────────────────────────────

  async replyToConversation(
    conversationId: string,
    context?: ReplyContext,
  ): Promise<void> {
    try {
      await this.executeReply(conversationId, context);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ReplyAI failed for conversation=${conversationId}: ${message}`,
      );

      // Mark conversation as no longer needing a reply
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      }).catch(() => undefined);

      throw err;
    }
  }

  // ─── Core reply logic ─────────────────────────────────────────────────────

  private async executeReply(
    conversationId: string,
    context?: ReplyContext,
  ): Promise<void> {
    // Load conversation + all necessary relations
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take:    AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES + 5, // fetch a few extra for safety
        },
        businessProfile: {
          include: {
            aiConfig:           true,
            aiModelConfig:      true,
            facebookConnection: {
              where:  { isActive: true },
              select: { pageId: true, encryptedAccessToken: true },
            },
            chatResources: {
              where:   { isActive: true },
              include: { images: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found — skipping AI reply`);
      return;
    }

    const { businessProfile } = conversation;
    const aiConfig    = businessProfile.aiConfig;
    const modelConfig = businessProfile.aiModelConfig;
    const connection  = businessProfile.facebookConnection;

    if (!aiConfig || !connection) {
      this.logger.warn(
        `Missing aiConfig or FB connection for profile=${businessProfile.id} — skipping`,
      );
      return;
    }

    // FIX: Guard against ghost conversations with no messages
    if (conversation.messages.length === 0) {
      this.logger.warn(
        `Conversation ${conversationId} has no messages in DB — skipping AI reply. ` +
        `This may be a ghost conversation created without synced messages.`,
      );
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      });
      return;
    }

    // Build business context
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

    // Reference images for the AI catalogue
    const referenceImages: ReferenceImage[] = businessProfile.chatResources.flatMap(
      (resource) => resource.images.map((img) => ({
        url:         img.url,
        description: img.description,
      })),
    );

    // Build system prompt
    const systemPrompt = this.promptBuilder.buildReplySystemPrompt(
      businessCtx,
      referenceImages,
    );

    // Get latest summary for context compression
    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { summary: true },
    });

    // Recent messages (reversed so oldest first for context building)
    const maxCtxMessages = aiConfig.maxContextMessages ?? AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES;
    const recentMessages = [...conversation.messages]
      .slice(0, maxCtxMessages)
      .reverse()
      .map((msg) => ({
        sender:   (msg.sender === 'CLIENT' ? 'client' : msg.sender === 'AI' ? 'ai' : 'page') as 'client' | 'ai' | 'page' | 'human',
        content:  msg.content,
        imageUrl: msg.imageUrl,
      }));

    // Determine the inbound text to reply to
    const inboundText =
      context?.inboundText ??
      conversation.messages.find((m) => m.sender === 'CLIENT')?.content ??
      '';

    if (!inboundText.trim()) {
      this.logger.debug(
        `No inbound text for conversation=${conversationId} — skipping AI reply`,
      );
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      });
      return;
    }

    // Build the full message array for OpenRouter
    const messages = this.promptBuilder.buildReplyMessages(
      systemPrompt,
      latestSummary?.summary ?? null,
      recentMessages,
      inboundText,
    );

    // Determine model to use (from DB config or central default)
    const primaryModelId = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const maxTokens      = modelConfig?.replyMaxTokens ?? REPLY_AI_MODEL.MAX_TOKENS;
    const temperature    = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;

    // FIX: Fallback model chain — try primary first, then fallbacks in order.
    // A model can fail for many reasons: rate limit, empty response after
    // thinking-chain stripping, temporary unavailability, etc.
    const modelsToTry = [
      primaryModelId,
      ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primaryModelId),
    ];

    let result: { content: string; totalTokens: number; model: string; latencyMs: number } | null = null;
    let lastError: unknown = null;

    for (const modelId of modelsToTry) {
      try {
        this.logger.debug(
          `Trying model ${modelId} for conversation=${conversationId}`,
        );
        const response = await this.openRouter.complete({
          model:       modelId,
          messages,
          maxTokens,
          temperature,
        });

        if (response.content.trim()) {
          result = response;
          break; // Got a valid response — stop trying
        }

        this.logger.warn(
          `Model ${modelId} returned empty content for conversation=${conversationId} — ` +
          `trying next model`,
        );
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Model ${modelId} failed for conversation=${conversationId}: ${message} — ` +
          `${modelsToTry.indexOf(modelId) < modelsToTry.length - 1 ? 'trying next model' : 'all models exhausted'}`,
        );
      }
    }

    if (!result) {
      throw lastError ?? new Error('All AI models failed to produce a response');
    }

    // Check for escalation signal
    const trimmedReply = result.content.trim();
    if (trimmedReply.toUpperCase().startsWith('ESCALATE:')) {
      const reason = trimmedReply.slice('ESCALATE:'.length).trim();
      this.logger.log(
        `AI escalated conversation=${conversationId} — reason: ${reason}`,
      );
      await this.handleEscalation(conversationId, reason, businessProfile.userId);
      return;
    }

    // Extract [IMAGE: url] tokens and send images first
    const { textContent, imageUrls } = extractImageTokens(trimmedReply);

    const pageToken = connection.encryptedAccessToken
      ? (await import('../security/token-encryption.service.js').then(
          (m) => new m.TokenEncryptionService().decrypt(connection.encryptedAccessToken)
        ))
      : null;

    // We need to get the decrypted token — inject TokenEncryptionService instead
    // (this requires a refactor, shown below as placeholder)
    const psid = conversation.clientPsid;
    if (!psid || !pageToken) {
      this.logger.warn(`Missing PSID or token for conversation=${conversationId}`);
      return;
    }

    // Send images first (before the text)
    for (const imageUrl of imageUrls) {
      await this.fbMessaging.sendImageMessage(connection.pageId, psid, imageUrl);
    }

    // Send the text reply
    if (textContent.trim()) {
      const sentMessage = await this.fbMessaging.sendTextMessage(
        connection.pageId,
        psid,
        textContent.trim(),
      );

      // Persist the AI reply to DB
      const savedMsg = await this.prisma.message.create({
        data: {
          conversationId,
          externalId: sentMessage.messageId,
          sender:     'AI',
          content:    textContent.trim(),
          status:     'DELIVERED',
        },
      });

      // Emit SSE so inbox updates instantly
      this.sseEmitter.newMessage(businessProfile.userId, {
        conversationId,
        message: {
          id:                 savedMsg.id,
          conversationId,
          sender:             'AI',
          content:            textContent.trim(),
          imageUrl:           null,
          fileUrl:            null,
          referenceImageUrls: imageUrls,
          status:             'DELIVERED',
          externalId:         sentMessage.messageId,
          createdAt:          savedMsg.createdAt,
        },
      });
    }

    // Mark conversation as handled
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: false },
    });

    this.logger.log(
      `AI reply sent — conversation=${conversationId} ` +
      `tokens=${result.totalTokens} latency=${result.latencyMs}ms model=${result.model}`,
    );
  }

  // ─── Escalation ───────────────────────────────────────────────────────────

  private async handleEscalation(
    conversationId: string,
    reason:         string,
    userId:         string,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  {
        handoverStatus: 'HUMAN',
        needsAiReply:   false,
      },
    });

    // Emit SSE so the inbox shows the handover
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (updated) {
      this.sseEmitter.conversationUpdated(userId, {
        conversation: {
          ...updated,
          unreadCount: 0,
          updatedAt:   new Date(),
        },
      });
    }
  }

  // ─── Resume AI mode ───────────────────────────────────────────────────────

  async resumeAiForConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!conversation) return;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { handoverStatus: 'AI', needsAiReply: false },
    });

    // If the last message was from the client, reply now
    const lastMsg = conversation.messages[0];
    if (lastMsg?.sender === 'CLIENT') {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: true },
      });
      void this.replyToConversation(conversationId).catch(() => undefined);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts [IMAGE: url] tokens from an AI reply.
 * Returns the cleaned text and the list of image URLs to send separately.
 */
function extractImageTokens(text: string): {
  textContent: string;
  imageUrls:   string[];
} {
  const imageUrls: string[] = [];
  const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(text)) !== null) {
    imageUrls.push(match[1].trim());
  }

  const textContent = text.replace(imageRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  return { textContent, imageUrls };
}
