/**
 * @file features/business-profile/business-profile.module.ts
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BusinessProfileController } from './business-profile.controller.js';
import { BusinessProfileService } from './business-profile.service.js';

@Module({
  imports:     [PrismaModule],
  controllers: [BusinessProfileController],
  providers:   [BusinessProfileService],
  exports:     [BusinessProfileService],
})
export class BusinessProfileModule {}
