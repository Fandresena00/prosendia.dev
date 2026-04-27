/**
 * @file src/common/guards/throttler-behind-proxy.guard.ts
 * @description Rate limiter guard that correctly extracts the real client IP
 * when the app runs behind a reverse proxy (Nginx, Cloudflare, AWS ALB, etc.).
 *
 * Problem: the standard ThrottlerGuard uses req.ip, which is the proxy's IP
 * when running behind a reverse proxy. This groups ALL clients under a single
 * rate-limit bucket, making the throttler useless.
 *
 * Solution: read the real IP from:
 *   1. req.ips[0]              — Express's parsed X-Forwarded-For
 *                                (requires trust proxy = 1 in main.ts)
 *   2. x-forwarded-for[0]     — Raw header fallback
 *   3. req.ip                  — Last resort (direct connection / localhost)
 *
 * Prerequisites:
 *   app.getHttpAdapter().getInstance().set('trust proxy', 1)  ← in main.ts
 *
 * Registration: via APP_GUARD in AppModule (participates in NestJS DI).
 */

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // req.ips is populated by Express when trust proxy is enabled.
    // The leftmost entry is the original client IP.
    if (req.ips.length > 0) {
      return req.ips[0];
    }

    // Fallback: parse the raw X-Forwarded-For header
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const firstIp = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0];
      const trimmed = firstIp?.trim();
      if (trimmed) return trimmed;
    }

    // Last resort: direct connection IP
    // Behind a proxy this will be the proxy IP — signals a misconfiguration
    return req.ip ?? 'unknown';
  }
}
