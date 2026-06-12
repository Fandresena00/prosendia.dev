/**
 * @file src/features/email/email.module.ts
 * @description Centralized email feature module — wraps Resend.
 * Import this module anywhere you need to send emails.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';

@Module({
  imports: [ConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
