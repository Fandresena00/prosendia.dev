/**
 * @file features/inbox/services/conversation.service.ts
 *
 * Read-side for conversations: list, get, mark read.
 * Write-side (send, handover) is in MessageService.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  buildPaginationMeta,
  PaginatedResponseDto,
} from '../../facebook/dto/shared/pagination.dto.js';
import type {
  ConversationResponseDto,
  ListConversationsQueryDto,
} from '../dto/inbox.dto.js';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async listForUser(
    userId: string,
    query: ListConversationsQueryDto,
  ): Promise<PaginatedResponseDto<ConversationResponseDto>> {
    const { businessProfileId, search, page = 1, pageSize = 30 } = query;
    const skip = (page - 1) * pageSize;

    // Build where — scope to the user's profiles
    const where: Record<string, unknown> = {
      businessProfile: { userId },
      ...(businessProfileId ? { businessProfileId } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { clientName: { contains: search, mode: 'insensitive' } },
              { lastMessage: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              messages: {
                where: { status: { not: 'READ' }, sender: 'CLIENT' },
              },
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations.map((c) => this.toDto(c)),
      pagination: buildPaginationMeta(page, pageSize, total),
    };
  }

  // ── Get single ────────────────────────────────────────────────────────────

  async getForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationResponseDto> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
      include: {
        _count: {
          select: {
            messages: { where: { status: { not: 'READ' }, sender: 'CLIENT' } },
          },
        },
      },
    });
    if (!conv)
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    return this.toDto(conv);
  }

  // ── Mark all messages read ────────────────────────────────────────────────

  async markRead(conversationId: string, userId: string): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conv)
      throw new NotFoundException(`Conversation ${conversationId} not found.`);

    await this.prisma.message.updateMany({
      where: { conversationId, sender: 'CLIENT', status: { not: 'READ' } },
      data: { status: 'READ' },
    });
  }

  // ── Set handover status ───────────────────────────────────────────────────

  async setHandover(
    conversationId: string,
    userId: string,
    status: 'AI' | 'HUMAN' | 'RESOLVED',
  ): Promise<ConversationResponseDto> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conv)
      throw new NotFoundException(`Conversation ${conversationId} not found.`);

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        handoverStatus: status,
        humanTookOverAt: status === 'HUMAN' ? new Date() : undefined,
      },
      include: {
        _count: {
          select: {
            messages: { where: { status: { not: 'READ' }, sender: 'CLIENT' } },
          },
        },
      },
    });

    return this.toDto(updated);
  }

  // ── Mapper ────────────────────────────────────────────────────────────────

  private toDto(conv: any): ConversationResponseDto {
    return {
      id: conv.id,
      businessProfileId: conv.businessProfileId,
      externalId: conv.externalId,
      clientPsid: conv.clientPsid,
      clientName: conv.clientName,
      clientAvatarUrl: conv.clientAvatarUrl,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      handoverStatus: conv.handoverStatus,
      unreadCount: conv._count?.messages ?? 0,
      updatedAt: conv.updatedAt,
    };
  }
}
