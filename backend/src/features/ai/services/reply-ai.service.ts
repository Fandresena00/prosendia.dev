/**
 * @file features/ai/services/reply-ai.service.ts  [queue-integrated version]
 *
 * Changes from previous version:
 *   - DataAI is no longer called directly (fire-and-forget removed)
 *   - After a successful reply, enqueues ai.summarize via AiQueueProducer
 *   - resumeAiForConversation() enqueues ai.reply via queue instead of calling directly
 *   - All other logic is unchanged
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookMessagingService } from '../../facebook/services/facebook-messaging.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import {
  PromptBuilderService,
  type BusinessContext,
  type ContextMessage,
  type ReferenceImage,
} from './prompt-builder.service.js';

// ─── Internal types ───────────────────────────────────────────────────────────

interface ParsedAiReply {
  text:             string;
  imageUrls:        string[];
  shouldEscalate:   boolean;
  escalationReason: string | null;
}

interface ReplyTrigger {
  inboundMessageId?: string;
  inboundText?: string;
  inboundCreatedAt?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReplyAiService {
  private readonly logger = new Logger(ReplyAiService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly openRouter:  OpenRouterClient,
    private readonly builder:     PromptBuilderService,
    private readonly messaging:   FacebookMessagingService,
    private readonly emitter:     InboxEventEmitter,
    // Queue producer replaces the direct DataAiService call
    private readonly aiQueue:     AiQueueProducer,
  ) {}

  // ─── Entry point (called by AiReplyWorker) ────────────────────────────────

  async replyToConversation(conversationId: string, trigger?: ReplyTrigger): Promise<void> {
    try {
      await this.doReply(conversationId, trigger);
    } catch (err) {
      this.logger.error(
        `ReplyAI failed for conv ${conversationId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.clearNeedsReply(conversationId);
      // Re-throw so the queue worker can mark the job as FAILED and retry
      throw err;
    }
  }

  // ─── Human → AI switch ────────────────────────────────────────────────────

  /**
   * Called when a human agent switches back to AI mode via POST /ai/conversations/:id/resume.
   *
   * Behaviour:
   *   1. Switch handoverStatus to AI
   *   2. Fetch the last message
   *   3. If last message is from CLIENT (unanswered) → enqueue ai.reply job
   *   4. Emit SSE conversation_updated
   */
  async resumeAiForConversation(
    conversationId: string,
    userId:         string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conversation) return;

    // Switch to AI mode
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { handoverStatus: 'AI', humanTookOverAt: null },
    });

    // Fetch the most recent message
    const lastMessage = await this.prisma.message.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    // Only enqueue a reply if the last message is from the client (unanswered)
    if (lastMessage?.sender === 'CLIENT') {
      this.logger.log(
        `Resuming AI for conv ${conversationId} — last msg is CLIENT, enqueueing reply`,
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { needsAiReply: true },
      });

      await this.aiQueue.enqueueAiReply({
        conversationId,
        inboundMessageId:  lastMessage.id,
        businessProfileId: conversation.businessProfileId,
        userId,
      });
    } else {
      this.logger.log(
        `Resuming AI for conv ${conversationId} — last msg is not CLIENT, no reply needed`,
      );
    }

    // Emit SSE so the inbox UI updates the mode badge immediately
    const profile = await this.prisma.businessProfile.findUnique({
      where:  { id: conversation.businessProfileId },
      select: { userId: true },
    });

    if (profile) {
      this.emitter.conversationUpdated(profile.userId, {
        conversation: {
          id:               conversation.id,
          businessProfileId: conversation.businessProfileId,
          externalId:       conversation.externalId,
          clientPsid:       conversation.clientPsid,
          clientName:       conversation.clientName,
          clientAvatarUrl:  conversation.clientAvatarUrl,
          lastMessage:      conversation.lastMessage,
          lastMessageAt:    conversation.lastMessageAt,
          handoverStatus:   'AI',
          unreadCount:      0,
          updatedAt:        new Date(),
        },
      });
    }
  }

  // ─── Core reply logic ──────────────────────────────────────────────────────

  private async doReply(conversationId: string, trigger?: ReplyTrigger): Promise<void> {
    // ── 1. Load conversation with full config ──────────────────────────────
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

    if (!conversation)                              return;
    if (conversation.handoverStatus !== 'AI')       return;
    if (!conversation.businessProfile.aiConfig?.autoReply) return;

    const aiConfig    = conversation.businessProfile.aiConfig;
    const modelConfig = conversation.businessProfile.aiModelConfig;

    // ── 2. Find the inbound message ────────────────────────────────────────
    const storedInbound = await this.prisma.message.findFirst({
      where:   { conversationId, sender: 'CLIENT' },
      orderBy: { createdAt: 'desc' },
    });
    const inboundMessage = trigger?.inboundText?.trim()
      ? {
          id: trigger.inboundMessageId ?? `fb-${Date.now()}`,
          content: trigger.inboundText.trim(),
          createdAt: trigger.inboundCreatedAt ? new Date(trigger.inboundCreatedAt) : new Date(),
        }
      : storedInbound;

    if (!inboundMessage?.content) {
      await this.clearNeedsReply(conversationId);
      return;
    }

    // ── 3. Apply reply delay ───────────────────────────────────────────────
    const delayMs = (aiConfig.replyDelaySeconds ?? 0) * 1000;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    // ── 4. Blocked keyword check ───────────────────────────────────────────
    const blocked   = (aiConfig.blockedKeywords as string[]) ?? [];
    const lowerText = inboundMessage.content.toLowerCase();
    const hitKeyword = blocked.find((kw) => lowerText.includes(kw.toLowerCase()));

    if (hitKeyword) {
      await this.escalate(
        conversationId,
        inboundMessage.id,
        `Blocked keyword: "${hitKeyword}"`,
        modelConfig?.replyModelId ?? 'none',
      );
      return;
    }

    // ── 5. Build reference images ──────────────────────────────────────────
    const referenceImages: ReferenceImage[] = conversation.businessProfile.chatResources
      .flatMap((r) => r.images.map((img) => ({ url: img.url, description: img.description })));

    // ── 6. Build business context ──────────────────────────────────────────
    const ctx: BusinessContext = {
      businessName:        conversation.businessProfile.name,
      businessType:        conversation.businessProfile.businessType,
      description:         conversation.businessProfile.description,
      tone:                aiConfig.tone,
      responseStyle:       aiConfig.responseStyle,
      replyLanguage:       aiConfig.replyLanguage,
      systemPrompt:        aiConfig.systemPrompt,
      inboxInstructions:   aiConfig.inboxInstructions,
      personalizeGreeting: aiConfig.personalizeGreeting,
      blockedKeywords:     blocked,
      allowedTopics:       (aiConfig.allowedTopics as string[]) ?? [],
      escalationThreshold: aiConfig.escalationThreshold ?? 0.6,
    };

    const systemPrompt = this.builder.buildReplySystemPrompt(ctx, referenceImages);

    // ── 7. Load summary + recent messages ──────────────────────────────────
    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { summary: true },
    });

    const maxMsgs   = aiConfig.maxContextMessages ?? 8;
    const recentRaw = await this.prisma.message.findMany({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      take:    maxMsgs + 1,
    });

    const contextMsgs: ContextMessage[] = recentRaw
      .reverse()
      .filter((m) => m.id !== inboundMessage.id)
      .slice(-maxMsgs)
      .map((m) => ({
        sender:   this.mapSender(m.sender),
        content:  m.content,
        imageUrl: m.imageUrl,
      }));

    // ── 8. Build prompt messages ───────────────────────────────────────────
    const messages = this.builder.buildReplyMessages(
      systemPrompt,
      latestSummary?.summary ?? null,
      contextMsgs,
      inboundMessage.content,
    );

    // ── 9. Call OpenRouter ─────────────────────────────────────────────────
    const modelId     = modelConfig?.replyModelId    ?? 'anthropic/claude-3.5-haiku';
    const maxTokens   = modelConfig?.replyMaxTokens  ?? aiConfig.maxReplyTokens ?? 400;
    const temperature = modelConfig?.replyTemperature ?? 0.7;

    const start = Date.now();

    const result = await this.openRouter.complete({
      model: modelId,
      messages,
      maxTokens,
      temperature,
    });

    const latencyMs = Date.now() - start;

    // ── 10. Parse and dispatch ─────────────────────────────────────────────
    const parsed = this.parseReply(result.content);

    if (parsed.shouldEscalate) {
      await this.persistLog({
        conversationId,
        inboundMessageId: inboundMessage.id,
        decision:         'ESCALATED',
        modelId:          result.model,
        promptTokens:     result.promptTokens,
        replyTokens:      result.replyTokens,
        latencyMs,
        escalationReason: parsed.escalationReason,
      });
      await this.escalate(
        conversationId,
        inboundMessage.id,
        parsed.escalationReason ?? 'AI decided escalation',
        result.model,
      );
      return;
    }

    // ── 11. Send images ────────────────────────────────────────────────────
    const profile = await this.prisma.businessProfile.findUnique({
      where:  { id: conversation.businessProfileId },
      select: { userId: true },
    });
    if (!profile || !conversation.clientPsid) {
      await this.clearNeedsReply(conversationId);
      return;
    }

    for (const imageUrl of parsed.imageUrls) {
      try {
        const sentImage = await this.messaging.sendImageMessage(
          conversation.businessProfileId,
          profile.userId,
          conversation.clientPsid,
          imageUrl,
        );
        const imageMessage = await this.prisma.message.findUnique({
          where: { externalId: sentImage.messageId },
        });
        if (imageMessage) {
          await this.prisma.message.update({
            where: { id: imageMessage.id },
            data:  { sender: 'AI', aiModel: result.model, aiTokensUsed: result.totalTokens },
          });
          this.emitter.newMessage(profile.userId, {
            conversationId,
            message: {
              id: imageMessage.id,
              conversationId,
              sender: 'AI',
              content: imageMessage.content,
              imageUrl: imageMessage.imageUrl,
              fileUrl: imageMessage.fileUrl,
              referenceImageUrls: [],
              status: imageMessage.status,
              externalId: imageMessage.externalId,
              createdAt: imageMessage.createdAt,
            },
          });
        }
      } catch (imgErr) {
        this.logger.warn(`Failed to send image message: ${(imgErr as Error).message}`);
      }
    }

    // ── 12. Send text reply ────────────────────────────────────────────────
    if (parsed.text.trim()) {
      const sentMessage = await this.messaging.sendMessage(
        conversation.businessProfileId,
        profile.userId,
        conversation.clientPsid,
        parsed.text.trim(),
      );

      await this.prisma.message.updateMany({
        where: { externalId: sentMessage.messageId },
        data:  { sender: 'AI', aiModel: result.model, aiTokensUsed: result.totalTokens },
      });
      const replyMessage = await this.prisma.message.findUnique({
        where: { externalId: sentMessage.messageId },
      });
      if (replyMessage) {
        this.emitter.newMessage(profile.userId, {
          conversationId,
          message: {
            id: replyMessage.id,
            conversationId,
            sender: 'AI',
            content: replyMessage.content,
            imageUrl: replyMessage.imageUrl,
            fileUrl: replyMessage.fileUrl,
            referenceImageUrls: [],
            status: replyMessage.status,
            externalId: replyMessage.externalId,
            createdAt: replyMessage.createdAt,
          },
        });
      }
    }

    // ── 13. Persist audit log ──────────────────────────────────────────────
    await this.persistLog({
      conversationId,
      inboundMessageId: inboundMessage.id,
      decision:         'REPLIED',
      modelId:          result.model,
      promptTokens:     result.promptTokens,
      replyTokens:      result.replyTokens,
      latencyMs,
      replyText:        parsed.text.trim() || null,
    });

    // ── 14. Clear flag ─────────────────────────────────────────────────────
    await this.clearNeedsReply(conversationId);

    // ── 15. Enqueue DataAI summary via queue (replaces fire-and-forget) ────
    await this.aiQueue.enqueueAiSummarize({
      conversationId,
      businessProfileId: conversation.businessProfileId,
    });

    this.logger.log(
      `AI reply sent — conv=${conversationId} ` +
      `${result.totalTokens}t ${latencyMs}ms model=${result.model}`,
    );
  }

  // ─── Escalation ───────────────────────────────────────────────────────────

  private async escalate(
    conversationId:   string,
    inboundMessageId: string,
    reason:           string,
    modelId:          string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.update({
      where:   { id: conversationId },
      data:    { handoverStatus: 'HUMAN', humanTookOverAt: new Date(), needsAiReply: false },
      include: { businessProfile: { select: { userId: true } } },
    });

    this.logger.log(`Conv ${conversationId} escalated → HUMAN: ${reason}`);

    this.emitter.conversationUpdated(conversation.businessProfile.userId, {
      conversation: {
        id:               conversation.id,
        businessProfileId: conversation.businessProfileId,
        externalId:       conversation.externalId,
        clientPsid:       conversation.clientPsid,
        clientName:       conversation.clientName,
        clientAvatarUrl:  conversation.clientAvatarUrl,
        lastMessage:      conversation.lastMessage,
        lastMessageAt:    conversation.lastMessageAt,
        handoverStatus:   'HUMAN',
        unreadCount:      1,
        updatedAt:        conversation.updatedAt,
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseReply(raw: string): ParsedAiReply {
    const trimmed = raw.trim();

    if (trimmed.toUpperCase().startsWith('ESCALATE:')) {
      return {
        text:             '',
        imageUrls:        [],
        shouldEscalate:   true,
        escalationReason: trimmed.slice('ESCALATE:'.length).trim() || 'AI escalation',
      };
    }

    const imagePattern = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
    const imageUrls:    string[] = [];
    let match: RegExpExecArray | null;

    while ((match = imagePattern.exec(trimmed)) !== null) {
      imageUrls.push(match[1].trim());
    }

    return {
      text:             trimmed.replace(imagePattern, '').trim(),
      imageUrls,
      shouldEscalate:   false,
      escalationReason: null,
    };
  }

  private async persistLog(data: {
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
        conversationId:    data.conversationId,
        inboundMessageId:  data.inboundMessageId ?? null,
        decision:          data.decision as never,
        modelId:           data.modelId,
        promptTokens:      data.promptTokens ?? 0,
        replyTokens:       data.replyTokens  ?? 0,
        latencyMs:         data.latencyMs    ?? 0,
        replyText:         data.replyText    ?? null,
        escalationReason:  data.escalationReason ?? null,
        errorMessage:      data.errorMessage     ?? null,
      },
    });
  }

  private async clearNeedsReply(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: false },
    });
  }

  private mapSender(sender: string): ContextMessage['sender'] {
    if (sender === 'CLIENT') return 'client';
    if (sender === 'AI')     return 'ai';
    if (sender === 'PAGE')   return 'page';
    return 'human';
  }
}
