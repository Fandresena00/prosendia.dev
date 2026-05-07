/**
 * @file features/ai/services/reply-ai.service.ts
 *
 * Orchestrates customer-facing AI replies for Facebook Messenger conversations.
 *
 * CHANGES:
 *   - Model ID, max tokens, and temperature now fall back to REPLY_AI_MODEL
 *     constants from ai-models.config.ts instead of inlined magic strings.
 *   - MAX_CONTEXT_MESSAGES falls back to AI_CONTEXT_CONFIG constant.
 *   - Variable names made more explicit throughout (modelId → replyModelId, etc.).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookMessagingService } from '../../facebook/services/facebook-messaging.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import { AI_CONTEXT_CONFIG, REPLY_AI_MODEL } from '../config/ai-models.config.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import {
  PromptBuilderService,
  type BusinessContext,
  type ContextMessage,
  type ReferenceImage,
} from './prompt-builder.service.js';

// ─── Internal types ───────────────────────────────────────────────────────────

interface ParsedAiReply {
  replyText:        string;
  imageUrls:        string[];
  shouldEscalate:   boolean;
  escalationReason: string | null;
}

interface ReplyJobTrigger {
  inboundMessageId?:  string;
  inboundText?:       string;
  inboundCreatedAt?:  string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReplyAiService {
  private readonly logger = new Logger(ReplyAiService.name);

  constructor(
    private readonly prisma:            PrismaService,
    private readonly openRouterClient:  OpenRouterClient,
    private readonly promptBuilder:     PromptBuilderService,
    private readonly facebookMessaging: FacebookMessagingService,
    private readonly sseEmitter:        InboxEventEmitter,
    private readonly aiJobQueue:        AiQueueProducer,
  ) {}

  // ─── Entry point (called by AiReplyWorker) ────────────────────────────────

  async replyToConversation(
    conversationId: string,
    trigger?: ReplyJobTrigger,
  ): Promise<void> {
    try {
      await this.executeReply(conversationId, trigger);
    } catch (err) {
      this.logger.error(
        `ReplyAI failed for conversation=${conversationId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.clearNeedsReplyFlag(conversationId);
      throw err; // Re-throw so the queue worker marks the job FAILED for retry
    }
  }

  // ─── Human → AI mode switch ───────────────────────────────────────────────

  /**
   * Called when a human agent switches back to AI mode via POST /ai/conversations/:id/resume.
   *
   * 1. Sets handoverStatus = AI
   * 2. If the last message is from the CLIENT (unanswered) → enqueues an ai.reply job
   * 3. Emits SSE conversation_updated so the inbox UI updates the mode badge immediately
   */
  async resumeAiForConversation(
    conversationId: string,
    userId:         string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conversation) return;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { handoverStatus: 'AI', humanTookOverAt: null },
    });

    const mostRecentMessage = await this.prisma.message.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    // Only enqueue a reply if the last message is from the client (still unanswered)
    if (mostRecentMessage?.sender === 'CLIENT') {
      this.logger.log(
        `Resuming AI for conversation=${conversationId} — last message is from CLIENT, enqueueing reply`,
      );
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: true },
      });
      await this.aiJobQueue.enqueueAiReply({
        conversationId,
        inboundMessageId:  mostRecentMessage.id,
        businessProfileId: conversation.businessProfileId,
        userId,
      });
    } else {
      this.logger.log(
        `Resuming AI for conversation=${conversationId} — last message is not CLIENT, no reply needed`,
      );
    }

    // Emit SSE so the inbox UI updates the conversation mode badge immediately
    const businessProfile = await this.prisma.businessProfile.findUnique({
      where:  { id: conversation.businessProfileId },
      select: { userId: true },
    });
    if (businessProfile) {
      this.sseEmitter.conversationUpdated(businessProfile.userId, {
        conversation: {
          id:                conversation.id,
          businessProfileId: conversation.businessProfileId,
          externalId:        conversation.externalId,
          clientPsid:        conversation.clientPsid,
          clientName:        conversation.clientName,
          clientAvatarUrl:   conversation.clientAvatarUrl,
          lastMessage:       conversation.lastMessage,
          lastMessageAt:     conversation.lastMessageAt,
          handoverStatus:    'AI',
          unreadCount:       0,
          updatedAt:         new Date(),
        },
      });
    }
  }

  // ─── Core reply execution ─────────────────────────────────────────────────

  private async executeReply(
    conversationId: string,
    trigger?: ReplyJobTrigger,
  ): Promise<void> {

    // ── 1. Load the conversation with all related config ───────────────────
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
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
    });

    if (!conversation)                                       return;
    if (conversation.handoverStatus !== 'AI')               return;
    if (!conversation.businessProfile.aiConfig?.autoReply)  return;

    const aiConfig    = conversation.businessProfile.aiConfig;
    const modelConfig = conversation.businessProfile.aiModelConfig;

    // ── 2. Resolve the inbound message to reply to ─────────────────────────
    // Prefer the text from the job trigger (already available in memory).
    // Fall back to a DB lookup if the trigger has no text (e.g. image-only message).
    const inboundMessage = trigger?.inboundText?.trim()
      ? {
          id:        trigger.inboundMessageId ?? `trigger-${Date.now()}`,
          content:   trigger.inboundText.trim(),
          createdAt: trigger.inboundCreatedAt
            ? new Date(trigger.inboundCreatedAt)
            : new Date(),
        }
      : await this.prisma.message.findFirst({
          where:   { conversationId, sender: 'CLIENT' },
          orderBy: { createdAt: 'desc' },
        });

    // Nothing to reply to (e.g. image-only message with no caption)
    if (!inboundMessage?.content) {
      await this.clearNeedsReplyFlag(conversationId);
      return;
    }

    // ── 3. Apply the configured reply delay ────────────────────────────────
    const replyDelayMs = (aiConfig.replyDelaySeconds ?? 0) * 1_000;
    if (replyDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, replyDelayMs));

    // ── 4. Blocked keyword check — escalate immediately if matched ─────────
    const blockedKeywords = (aiConfig.blockedKeywords as string[]) ?? [];
    const lowercaseInbound = inboundMessage.content.toLowerCase();
    const matchedKeyword = blockedKeywords.find(
      (keyword) => lowercaseInbound.includes(keyword.toLowerCase()),
    );
    if (matchedKeyword) {
      await this.escalateToHuman(
        conversationId,
        inboundMessage.id,
        `Blocked keyword matched: "${matchedKeyword}"`,
        modelConfig?.replyModelId ?? REPLY_AI_MODEL.MODEL_ID,
      );
      return;
    }

    // ── 5. Build reference images from active ChatResources ───────────────
    const referenceImages: ReferenceImage[] = conversation.businessProfile.chatResources
      .flatMap((resource) =>
        resource.images.map((image) => ({ url: image.url, description: image.description })),
      );

    // ── 6. Build the business context object for the prompt ────────────────
    const businessContext: BusinessContext = {
      businessName:        conversation.businessProfile.name,
      businessType:        conversation.businessProfile.businessType,
      description:         conversation.businessProfile.description,
      tone:                aiConfig.tone,
      responseStyle:       aiConfig.responseStyle,
      replyLanguage:       aiConfig.replyLanguage,
      systemPrompt:        aiConfig.systemPrompt,
      inboxInstructions:   aiConfig.inboxInstructions,
      personalizeGreeting: aiConfig.personalizeGreeting,
      blockedKeywords,
      allowedTopics:       (aiConfig.allowedTopics as string[]) ?? [],
      escalationThreshold: aiConfig.escalationThreshold ?? 0.6,
    };

    const replySystemPrompt = this.promptBuilder.buildReplySystemPrompt(
      businessContext,
      referenceImages,
    );

    // ── 7. Load latest conversation summary + recent message context ────────
    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { summary: true },
    });

    const maxContextMessages = aiConfig.maxContextMessages ?? AI_CONTEXT_CONFIG.MAX_CONTEXT_MESSAGES;
    const recentMessagesRaw = await this.prisma.message.findMany({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      take:    maxContextMessages + 1, // +1 so we can exclude the inbound message itself
    });

    const contextMessages: ContextMessage[] = recentMessagesRaw
      .reverse()
      .filter((msg) => msg.id !== inboundMessage.id)
      .slice(-maxContextMessages)
      .map((msg) => ({
        sender:   this.mapSenderToContextRole(msg.sender),
        content:  msg.content,
        imageUrl: msg.imageUrl,
      }));

    // ── 8. Assemble the full prompt message array ──────────────────────────
    const promptMessages = this.promptBuilder.buildReplyMessages(
      replySystemPrompt,
      latestSummary?.summary ?? null,
      contextMessages,
      inboundMessage.content,
    );

    // ── 9. Call the Reply AI model via OpenRouter ──────────────────────────
    // Fallback order: DB model config → AI_MODELS constants
    const replyModelId    = modelConfig?.replyModelId     ?? REPLY_AI_MODEL.MODEL_ID;
    const replyMaxTokens  = modelConfig?.replyMaxTokens   ?? REPLY_AI_MODEL.MAX_TOKENS;
    const replyTemperature = modelConfig?.replyTemperature ?? REPLY_AI_MODEL.TEMPERATURE;

    const replyStartTime = Date.now();
    const openRouterResult = await this.openRouterClient.complete({
      model:       replyModelId,
      messages:    promptMessages,
      maxTokens:   replyMaxTokens,
      temperature: replyTemperature,
    });
    const replyLatencyMs = Date.now() - replyStartTime;

    // ── 10. Parse the raw AI output ────────────────────────────────────────
    const parsedReply = this.parseRawAiReply(openRouterResult.content);

    if (parsedReply.shouldEscalate) {
      await this.persistAiReplyLog({
        conversationId,
        inboundMessageId: inboundMessage.id,
        decision:         'ESCALATED',
        modelId:          openRouterResult.model,
        promptTokens:     openRouterResult.promptTokens,
        replyTokens:      openRouterResult.replyTokens,
        latencyMs:        replyLatencyMs,
        escalationReason: parsedReply.escalationReason,
      });
      await this.escalateToHuman(
        conversationId,
        inboundMessage.id,
        parsedReply.escalationReason ?? 'AI decided to escalate',
        openRouterResult.model,
      );
      return;
    }

    // ── 11. Resolve business profile userId for Facebook API calls ─────────
    const businessProfile = await this.prisma.businessProfile.findUnique({
      where:  { id: conversation.businessProfileId },
      select: { userId: true },
    });
    if (!businessProfile || !conversation.clientPsid) {
      await this.clearNeedsReplyFlag(conversationId);
      return;
    }

    // ── 12. Send any image URLs extracted from the AI reply ────────────────
    for (const imageUrl of parsedReply.imageUrls) {
      try {
        const sentImageResult = await this.facebookMessaging.sendImageMessage(
          conversation.businessProfileId,
          businessProfile.userId,
          conversation.clientPsid,
          imageUrl,
        );
        const savedImageMessage = await this.prisma.message.findUnique({
          where: { externalId: sentImageResult.messageId },
        });
        if (savedImageMessage) {
          await this.prisma.message.update({
            where: { id: savedImageMessage.id },
            data:  { sender: 'AI', aiModel: openRouterResult.model, aiTokensUsed: openRouterResult.totalTokens },
          });
          this.sseEmitter.newMessage(businessProfile.userId, {
            conversationId,
            message: {
              id:                 savedImageMessage.id,
              conversationId,
              sender:             'AI',
              content:            savedImageMessage.content,
              imageUrl:           savedImageMessage.imageUrl,
              fileUrl:            savedImageMessage.fileUrl,
              referenceImageUrls: [],
              status:             savedImageMessage.status,
              externalId:         savedImageMessage.externalId,
              createdAt:          savedImageMessage.createdAt,
            },
          });
        }
      } catch (imageErr) {
        this.logger.warn(
          `Failed to send AI image message to conv=${conversationId}: ${(imageErr as Error).message}`,
        );
      }
    }

    // ── 13. Send the text reply ────────────────────────────────────────────
    if (parsedReply.replyText.trim()) {
      const sentTextResult = await this.facebookMessaging.sendMessage(
        conversation.businessProfileId,
        businessProfile.userId,
        conversation.clientPsid,
        parsedReply.replyText.trim(),
      );
      await this.prisma.message.updateMany({
        where: { externalId: sentTextResult.messageId },
        data:  { sender: 'AI', aiModel: openRouterResult.model, aiTokensUsed: openRouterResult.totalTokens },
      });
      const savedTextMessage = await this.prisma.message.findUnique({
        where: { externalId: sentTextResult.messageId },
      });
      if (savedTextMessage) {
        this.sseEmitter.newMessage(businessProfile.userId, {
          conversationId,
          message: {
            id:                 savedTextMessage.id,
            conversationId,
            sender:             'AI',
            content:            savedTextMessage.content,
            imageUrl:           savedTextMessage.imageUrl,
            fileUrl:            savedTextMessage.fileUrl,
            referenceImageUrls: [],
            status:             savedTextMessage.status,
            externalId:         savedTextMessage.externalId,
            createdAt:          savedTextMessage.createdAt,
          },
        });
      }
    }

    // ── 14. Persist the audit log entry ────────────────────────────────────
    await this.persistAiReplyLog({
      conversationId,
      inboundMessageId: inboundMessage.id,
      decision:         'REPLIED',
      modelId:          openRouterResult.model,
      promptTokens:     openRouterResult.promptTokens,
      replyTokens:      openRouterResult.replyTokens,
      latencyMs:        replyLatencyMs,
      replyText:        parsedReply.replyText.trim() || null,
    });

    // ── 15. Clear the needsAiReply flag ────────────────────────────────────
    await this.clearNeedsReplyFlag(conversationId);

    // ── 16. Enqueue DataAI summarisation job (background, non-blocking) ────
    await this.aiJobQueue.enqueueAiSummarize({
      conversationId,
      businessProfileId: conversation.businessProfileId,
    });

    this.logger.log(
      `AI reply sent — conversation=${conversationId} ` +
      `tokens=${openRouterResult.totalTokens} latency=${replyLatencyMs}ms model=${openRouterResult.model}`,
    );
  }

  // ─── Escalation ───────────────────────────────────────────────────────────

  private async escalateToHuman(
    conversationId:    string,
    inboundMessageId:  string,
    escalationReason:  string,
    aiModelId:         string,
  ): Promise<void> {
    const updatedConversation = await this.prisma.conversation.update({
      where:   { id: conversationId },
      data:    { handoverStatus: 'HUMAN', humanTookOverAt: new Date(), needsAiReply: false },
      include: { businessProfile: { select: { userId: true } } },
    });

    this.logger.log(
      `Conversation=${conversationId} escalated to HUMAN — reason: ${escalationReason}`,
    );

    this.sseEmitter.conversationUpdated(updatedConversation.businessProfile.userId, {
      conversation: {
        id:                updatedConversation.id,
        businessProfileId: updatedConversation.businessProfileId,
        externalId:        updatedConversation.externalId,
        clientPsid:        updatedConversation.clientPsid,
        clientName:        updatedConversation.clientName,
        clientAvatarUrl:   updatedConversation.clientAvatarUrl,
        lastMessage:       updatedConversation.lastMessage,
        lastMessageAt:     updatedConversation.lastMessageAt,
        handoverStatus:    'HUMAN',
        unreadCount:       1,
        updatedAt:         updatedConversation.updatedAt,
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Parses the raw AI model output.
   * Handles two response formats:
   *   "ESCALATE: <reason>"      → escalation signal
   *   "[IMAGE: https://...]"    → embedded image reference (extracted and removed)
   */
  private parseRawAiReply(rawOutput: string): ParsedAiReply {
    const trimmedOutput = rawOutput.trim();

    if (trimmedOutput.toUpperCase().startsWith('ESCALATE:')) {
      return {
        replyText:        '',
        imageUrls:        [],
        shouldEscalate:   true,
        escalationReason: trimmedOutput.slice('ESCALATE:'.length).trim() || 'AI escalation',
      };
    }

    const imageTagPattern = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
    const extractedImageUrls: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = imageTagPattern.exec(trimmedOutput)) !== null) {
      extractedImageUrls.push(match[1].trim());
    }

    return {
      replyText:        trimmedOutput.replace(imageTagPattern, '').trim(),
      imageUrls:        extractedImageUrls,
      shouldEscalate:   false,
      escalationReason: null,
    };
  }

  private async persistAiReplyLog(data: {
    conversationId:    string;
    inboundMessageId?: string;
    decision:          string;
    modelId:           string;
    promptTokens?:     number;
    replyTokens?:      number;
    latencyMs?:        number;
    replyText?:        string | null;
    escalationReason?: string | null;
    errorMessage?:     string | null;
  }): Promise<void> {
    await this.prisma.aiReplyLog.create({
      data: {
        conversationId:   data.conversationId,
        inboundMessageId: data.inboundMessageId ?? null,
        decision:         data.decision as never,
        modelId:          data.modelId,
        promptTokens:     data.promptTokens     ?? 0,
        replyTokens:      data.replyTokens      ?? 0,
        latencyMs:        data.latencyMs         ?? 0,
        replyText:        data.replyText         ?? null,
        escalationReason: data.escalationReason  ?? null,
        errorMessage:     data.errorMessage      ?? null,
      },
    });
  }

  private async clearNeedsReplyFlag(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: false },
    });
  }

  private mapSenderToContextRole(dbSender: string): ContextMessage['sender'] {
    if (dbSender === 'CLIENT') return 'client';
    if (dbSender === 'AI')     return 'ai';
    if (dbSender === 'PAGE')   return 'page';
    return 'human';
  }
}
