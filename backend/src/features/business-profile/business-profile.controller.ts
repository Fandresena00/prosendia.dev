/**
 * @file features/business-profile/business-profile.controller.ts
 *
 * Routes:
 *   GET  /business-profiles           → list all profiles (switcher)
 *   GET  /business-profiles/:id       → get one profile with full AI config
 *   PUT  /business-profiles/:id       → update profile + AI config atomically
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.types.js';
import { BusinessProfileService } from './business-profile.service.js';
import type {
  BusinessProfileResponseDto,
  BusinessProfileSummaryDto,
} from './dto/business-profile.dto.js';
import { UpdateBusinessProfileDto } from './dto/business-profile.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('business-profiles')
export class BusinessProfileController {
  constructor(
    private readonly businessProfileService: BusinessProfileService,
  ) {}

  /**
   * GET /business-profiles
   * Returns lightweight summaries for all profiles — used by the switcher dropdown.
   */
  @Get()
  listProfiles(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BusinessProfileSummaryDto[]> {
    return this.businessProfileService.listForUser(user.sub);
  }

  /**
   * GET /business-profiles/:id
   * Returns the full profile with AI config and reference images.
   */
  @Get(':id')
  getProfile(
    @Param('id') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BusinessProfileResponseDto> {
    return this.businessProfileService.getForUser(profileId, user.sub);
  }

  /**
   * PUT /business-profiles/:id
   * Updates BusinessProfile + AiConfig atomically in a single request.
   * Returns the updated full profile.
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @Param('id') profileId: string,
    @Body() dto: UpdateBusinessProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BusinessProfileResponseDto> {
    return this.businessProfileService.updateForUser(profileId, user.sub, dto);
  }
}
