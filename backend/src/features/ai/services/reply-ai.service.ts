/**
 * @file features/ai/services/reply-ai.service.ts
 *
 * CHANGE: Intégration CreditService.
 *   - Vérifie les crédits AVANT l'appel OpenRouter (blocage si 0)
 *   - Déduit les crédits APRÈS chaque réponse réussie
 *   - Les réponses de fallback (erreur modèle) ne consomment pas de crédits
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { FacebookMessagingService } from '../../facebook/services/facebook-messaging.service.js';
import { CreditService } from '../../billing/services/credit.service.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import {
  AI_CONTEXT_CONFIG,
  REPLY_AI_FALLBACK_MODELS,
  REPLY_AI_MODEL,
} from '../config/ai-models.config.js';
import {
  PromptBuilderService,
  type BusinessContext,
  type ReferenceImage,
} from './prompt-builder.service.js';

export interface ReplyContext {
  inboundMessageId?: string;
  inboundText?: string;
  inboundCreatedAt?: string;
}

@Injectable()
export class ReplyAiService {
  private readonly logger = new Logger(ReplyAiService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly openRouter:      OpenRouterClient,
    private readonly promptBuilder:   PromptBuilderService,
    private readonly fbMessaging:     FacebookMessagingService,
    private readonly sseEmitter:      InboxEventEmitter,
    private readonly creditService:   CreditService,
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
      this.logger.error(`ReplyAI failed for conversation=${conversationId}: ${message}`);
      await this.prisma.conversation
        .update({ where: { id: conversationId }, data: { needsAiReply: false } })
        .catch(() => undefined);
      throw err;
    }
  }

  // ─── Core reply logic ─────────────────────────────────────────────────────

  private async executeReply(
    conversationId: string,
    context?: ReplyContext,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES + 5,
        },
        businessProfile: {
          include: {
            aiConfig: true,
            aiModelConfig: true,
            facebookConnection: {
              where: { isActive: true },
              select: { pageId: true, encryptedAccessToken: true },
            },
            chatResources: {
              where: { isActive: true },
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
    const aiConfig     = businessProfile.aiConfig;
    const modelConfig  = businessProfile.aiModelConfig;
    const connection   = businessProfile.facebookConnection;
    const userId       = businessProfile.userId;

    if (!aiConfig || !connection) {
      this.logger.warn(`Missing aiConfig or FB connection for profile=${businessProfile.id} — skipping`);
      return;
    }

    if (conversation.messages.length === 0) {
      this.logger.warn(`Conversation ${conversationId} has no messages — skipping`);
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      });
      return;
    }

    // ⭐ CREDIT CHECK — bloquer si solde épuisé
    const hasCredits = await this.creditService.hasCredits(userId);
    if (!hasCredits) {
      this.logger.warn(
        `AI reply blocked — no credits: user=${userId} conv=${conversationId}`,
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

    const referenceImages: ReferenceImage[] =
      businessProfile.chatResources.flatMap((resource) =>
        resource.images.map((img) => ({ url: img.url, description: img.description })),
      );

    const systemPrompt = this.promptBuilder.buildReplySystemPrompt(businessCtx, referenceImages);

    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { summary: true },
    });

    const maxCtxMessages =
      aiConfig.maxContextMessages ?? AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES;
    const recentMessages = [...conversation.messages]
      .slice(0, maxCtxMessages)
      .reverse()
      .map((msg) => ({
        sender: (msg.sender === 'CLIENT' ? 'client' : msg.sender === 'AI' ? 'ai' : 'page') as
          'client' | 'ai' | 'page' | 'human',
        content:  msg.content,
        imageUrl: msg.imageUrl,
      }));

    const inboundText =
      context?.inboundText ??
      conversation.messages.find((m) => m.sender === 'CLIENT')?.content ??
      '';

    if (!inboundText.trim()) {
      this.logger.debug(`No inbound text for conversation=${conversationId} — skipping`);
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      });
      return;
    }

    const messages = this.promptBuilder.buildReplyMessages(
      systemPrompt,
      latestSummary?.summary ?? null,
      recentMessages,
      inboundText,
    );

    const primaryModelId = modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID;
    const maxTokens      = modelConfig?.replyMaxTokens ?? REPLY_AI_MODEL.MAX_TOKENS;
    const temperature    = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;

    const modelsToTry = [
      primaryModelId,
      ...REPLY_AI_FALLBACK_MODELS.filter((m) => m !== primaryModelId),
    ];

    let result: {
      content: string;
      promptTokens: number;
      replyTokens: number;
      totalTokens: number;
      model: string;
      latencyMs: number;
    } | null = null;

    for (const modelId of modelsToTry) {
      try {
        this.logger.debug(`Trying model ${modelId} for conversation=${conversationId}`);
        const response = await this.openRouter.complete({ model: modelId, messages, maxTokens, temperature });
        if (response.content.trim()) {
          result = response;
          break;
        }
        this.logger.warn(`Model ${modelId} returned empty content — trying next`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Model ${modelId} failed: ${msg} — ${modelsToTry.indexOf(modelId) < modelsToTry.length - 1 ? 'trying next' : 'all exhausted'}`);
      }
    }

    if (!result) {
      this.logger.error(`All models exhausted for conversation=${conversationId}. Sending fallback.`);

      const psid = conversation.clientPsid;
      if (psid && connection.encryptedAccessToken) {
        const fallbackText = normalizeReplyText(
          businessProfile.aiConfig?.replyLanguage === 'fr'
            ? 'Merci pour votre message. Notre equipe vous repond tres vite.'
            : 'Thanks for your message. Our team will reply shortly.',
        );
        const sentMessage = await this.fbMessaging.sendTextMessageInternal(
          connection.pageId, psid, fallbackText, connection.encryptedAccessToken,
        );
        await this.prisma.message.create({
          data: {
            conversationId,
            externalId: sentMessage.messageId,
            sender:     'AI',
            content:    fallbackText,
            status:     'DELIVERED',
          },
        });
      }
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: false },
      });
      return;
    }

    // ⭐ CREDIT DEDUCTION — déduire après réponse réussie
    const totalTokens = (result.promptTokens ?? 0) + (result.replyTokens ?? 0);
    if (totalTokens > 0) {
      await this.creditService
        .consumeCredits(userId, totalTokens, 'AI_REPLY_CONSUME', result.model, conversationId)
        .catch((err: Error) =>
          this.logger.warn(`Credit deduction failed conv=${conversationId}: ${err.message}`),
        );
    }

    const trimmedReply = result.content.trim();

    // Escalation check
    if (trimmedReply.toUpperCase().startsWith('ESCALATE:')) {
      const reason = trimmedReply.slice('ESCALATE:'.length).trim();
      this.logger.log(`AI escalated conversation=${conversationId} — reason: ${reason}`);
      await this.handleEscalation(conversationId, reason, userId);
      return;
    }

    const { textContent, imageUrls } = extractImageTokens(trimmedReply);
    const psid = conversation.clientPsid;

    if (!psid || !connection.encryptedAccessToken) {
      this.logger.warn(`Missing PSID or token for conversation=${conversationId}`);
      return;
    }

    for (const imageUrl of imageUrls) {
      await this.fbMessaging.sendImageMessageInternal(
        connection.pageId, psid, imageUrl, connection.encryptedAccessToken,
      );
    }

    const normalizedText = normalizeReplyText(textContent);
    if (normalizedText) {
      const sentMessage = await this.fbMessaging.sendTextMessageInternal(
        connection.pageId, psid, normalizedText, connection.encryptedAccessToken,
      );

      const savedMsg = await this.prisma.message.create({
        data: {
          conversationId,
          externalId: sentMessage.messageId,
          sender:     'AI',
          content:    normalizedText,
          status:     'DELIVERED',
        },
      });

      this.sseEmitter.newMessage(userId, {
        conversationId,
        message: {
          id:                 savedMsg.id,
          conversationId,
          sender:             'AI',
          content:            normalizedText,
          imageUrl:           null,
          fileUrl:            null,
          referenceImageUrls: imageUrls,
          status:             'DELIVERED',
          externalId:         sentMessage.messageId,
          createdAt:          savedMsg.createdAt,
        },
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: false },
    });

    this.logger.log(
      `AI reply sent — conversation=${conversationId} tokens=${result.totalTokens} latency=${result.latencyMs}ms model=${result.model}`,
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
      data:  { handoverStatus: 'HUMAN', needsAiReply: false },
    });

    const updated = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (updated) {
      this.sseEmitter.conversationUpdated(userId, {
        conversation: { ...updated, unreadCount: 0, updatedAt: new Date() },
      });
    }
  }

  // ─── Resume AI mode ───────────────────────────────────────────────────────

  async resumeAiForConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where:   { id: conversationId, businessProfile: { userId } },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!conversation) return;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { handoverStatus: 'AI', needsAiReply: false },
    });

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

function extractImageTokens(text: string): { textContent: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(text)) !== null) {
    imageUrls.push(match[1].trim());
  }

  const textContent = text
    .replace(imageRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { textContent, imageUrls };
}

function normalizeReplyText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s-\s+/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
