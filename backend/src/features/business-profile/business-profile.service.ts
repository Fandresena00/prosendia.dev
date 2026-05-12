/**
 * @file features/business-profile/business-profile.service.ts
 *
 * Manages BusinessProfile + AiConfig as a single unit.
 *
 * One PUT saves both the profile and its AI config atomically.
 * The AI layer reads the combined data to build prompts.
 *
 * Reference images (ChatResource + ChatResourceImage) are included
 * in the response so the frontend can show them in the editor,
 * and the AI can use their URLs to send images to clients.
 */

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  BusinessProfileResponseDto,
  BusinessProfileSummaryDto,
  UpdateBusinessProfileDto,
} from './dto/business-profile.dto.js';

@Injectable()
export class BusinessProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List all profiles for the user ──────────────────────────────────────

  /**
   * Returns lightweight summaries for the profile switcher dropdown.
   * Includes the connected Facebook page name for display.
   */
  async listForUser(userId: string): Promise<BusinessProfileSummaryDto[]> {
    const profiles = await this.prisma.businessProfile.findMany({
      where:   { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        facebookConnection: {
          select: { pageId: true, pageName: true, isActive: true },
        },
        aiConfig: {
          select: { autoReply: true },
        },
      },
    });

    return profiles.map((p) => ({
      id:               p.id,
      name:             p.name,
      businessType:     p.businessType,
      facebookPageId:   p.facebookConnection?.isActive ? p.facebookConnection.pageId : null,
      facebookPageName: p.facebookConnection?.isActive ? p.facebookConnection.pageName : null,
      autoReply:        p.aiConfig?.autoReply ?? false,
      updatedAt:        p.updatedAt,
    }));
  }

  // ─── Get one profile with full AI config ──────────────────────────────────

  async getForUser(
    profileId: string,
    userId:    string,
  ): Promise<BusinessProfileResponseDto> {
    const profile = await this.findOrThrow(profileId, userId);
    return this.toResponseDto(profile);
  }

  // ─── Update profile + AI config atomically ────────────────────────────────

  /**
   * Single endpoint that updates the BusinessProfile fields AND
   * the AiConfig in one database transaction.
   *
   * If AiConfig does not exist yet, it is created with defaults.
   * Unset fields are not touched (partial update).
   */
  async updateForUser(
    profileId: string,
    userId:    string,
    dto:       UpdateBusinessProfileDto,
  ): Promise<BusinessProfileResponseDto> {
    // Verify ownership
    await this.findOrThrow(profileId, userId);

    // ── Build BusinessProfile update data ──
    const profileData: Record<string, unknown> = {};
    if (dto.name         !== undefined) profileData.name         = dto.name;
    if (dto.businessType !== undefined) profileData.businessType = dto.businessType;
    if (dto.description  !== undefined) profileData.description  = dto.description;

    // ── Build AiConfig upsert data ──
    const aiConfigData: Record<string, unknown> = {};
    if (dto.tone                !== undefined) aiConfigData.tone                = dto.tone;
    if (dto.responseStyle       !== undefined) aiConfigData.responseStyle       = dto.responseStyle;
    if (dto.autoReply           !== undefined) aiConfigData.autoReply           = dto.autoReply;
    if (dto.aiInstructions      !== undefined) aiConfigData.systemPrompt        = dto.aiInstructions;
    if (dto.commentInstructions !== undefined) aiConfigData.commentInstructions = dto.commentInstructions;

    // ── Atomic transaction ──
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.businessProfile.update({
          where: { id: profileId },
          data:  profileData,
        });
      }

      if (Object.keys(aiConfigData).length > 0) {
        await tx.aiConfig.upsert({
          where:  { businessProfileId: profileId },
          create: { businessProfileId: profileId, ...aiConfigData },
          update: aiConfigData,
        });
      }
    });

    // Return the updated full profile
    const updated = await this.findOrThrow(profileId, userId);
    return this.toResponseDto(updated);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findOrThrow(profileId: string, userId: string) {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id: profileId, userId },
      include: {
        aiConfig: true,
        facebookConnection: {
          select: {
            pageId:    true,
            pageName:  true,
            isActive:  true,
          },
        },
        chatResources: {
          where:   { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id:          true,
                url:         true,
                description: true,
                sortOrder:   true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Business profile ${profileId} not found.`,
      );
    }

    return profile;
  }

  private toResponseDto(
    profile: Awaited<ReturnType<typeof this.findOrThrow>>,
  ): BusinessProfileResponseDto {
    const conn = profile.facebookConnection;

    return {
      id:           profile.id,
      name:         profile.name,
      businessType: profile.businessType,
      description:  profile.description,

      // AI config — fallback to defaults if no AiConfig row yet
      tone:                profile.aiConfig?.tone           ?? 'FRIENDLY',
      responseStyle:       profile.aiConfig?.responseStyle  ?? 'MIXED',
      autoReply:           profile.aiConfig?.autoReply      ?? false,
      aiInstructions:      profile.aiConfig?.systemPrompt   ?? null,
      commentInstructions: profile.aiConfig?.commentInstructions ?? null,

      // Facebook connection
      facebookPageId:   conn?.isActive ? conn.pageId   : null,
      facebookPageName: conn?.isActive ? conn.pageName : null,

      // Reference presets (used by AI to send images to clients)
      referencePresets: profile.chatResources.map((resource) => ({
        id:          resource.id,
        name:        resource.name,
        description: resource.description ?? '',
        images:      resource.images.map((img) => ({
          id:          img.id,
          url:         img.url,
          description: img.description,
          sortOrder:   img.sortOrder,
        })),
      })),

      updatedAt: profile.updatedAt,
    };
  }
}
