import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly appSecret: string;

  constructor(configService: ConfigService) {
    this.appSecret = configService.getOrThrow<string>('facebookAppSecret');
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      throw new ForbiddenException('Missing webhook signature');
    }

    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error(
        'rawBody unavailable — ensure app is created with { rawBody: true }',
      );
      throw new ForbiddenException(
        'Cannot verify signature: raw body not available',
      );
    }

    const expectedHex = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');
    const expected = `sha256=${expectedHex}`;

    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expBuffer.length) {
      this.logger.warn('Signature length mismatch');
      throw new ForbiddenException('Invalid webhook signature');
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, expBuffer);
    if (!isValid) {
      this.logger.warn('HMAC signature mismatch');
      throw new ForbiddenException('Invalid webhook signature');
    }
    return true;
  }
}
