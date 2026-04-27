/**
 * @file src/common/filters/http-exception.filter.ts
 * @description Global exception filter — two complementary filters:
 *
 * 1. HttpExceptionFilter  — catches NestJS HttpExceptions (4xx / 5xx)
 * 2. AllExceptionsFilter  — catches EVERYTHING else (unhandled DB errors,
 *    type errors, etc.) and wraps them in a 500 envelope so the client
 *    never receives a raw Node.js stack trace.
 *
 * Both normalize errors into the same JSON envelope:
 * {
 *   "success": false,
 *   "statusCode": 422,
 *   "message": "Validation failed",
 *   "errors": ["email must be a valid email"],  ← validation errors only
 *   "path": "/api/users",
 *   "timestamp": "2025-04-20T10:00:00.000Z"
 * }
 *
 * Registration: via APP_FILTER in AppModule (NestJS DI).
 * NEVER register via app.useGlobalFilters() — that bypasses DI and loses
 * access to injected services (logger, config, etc.).
 *
 * Order matters: register AllExceptionsFilter FIRST (outer), then
 * HttpExceptionFilter (inner). NestJS applies them last-registered-first.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// ─── Shared types ─────────────────────────────────────────────────────────────

/** Shape of NestJS class-validator error responses */
interface ValidationErrorBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

/** Normalized error envelope sent to API consumers */
export interface ErrorEnvelope {
  success: false;
  statusCode: number;
  message: string;
  /** Present only for validation errors (status 422 / 400 from class-validator) */
  errors?: string[];
  path: string;
  timestamp: string;
}

// ─── Shared envelope builder ──────────────────────────────────────────────────

function buildEnvelope(
  status: number,
  exceptionResponse: string | object,
  path: string,
): ErrorEnvelope {
  const timestamp = new Date().toISOString();

  // Plain string (e.g. throw new HttpException('Not found', 404))
  if (typeof exceptionResponse === 'string') {
    return {
      success: false,
      statusCode: status,
      message: exceptionResponse,
      path,
      timestamp,
    };
  }

  const body = exceptionResponse as ValidationErrorBody;

  // class-validator produces an array of constraint messages
  if (Array.isArray(body.message)) {
    return {
      success: false,
      statusCode: status,
      message: body.error ?? 'Validation failed',
      errors: body.message,
      path,
      timestamp,
    };
  }

  return {
    success: false,
    statusCode: status,
    message: body.message ?? 'An error occurred',
    path,
    timestamp,
  };
}

// ─── HttpExceptionFilter ──────────────────────────────────────────────────────

/**
 * Catches NestJS HttpExceptions only (BadRequestException, NotFoundException,
 * UnauthorizedException, etc.). Translates them to the ErrorEnvelope shape.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const envelope = buildEnvelope(
      status,
      exception.getResponse(),
      request.url,
    );

    // 5xx → error (includes stack for debugging); 4xx → warn
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${status}: ${envelope.message}`,
      );
    }

    response.status(status).json(envelope);
  }
}

// ─── AllExceptionsFilter ──────────────────────────────────────────────────────

/**
 * Catch-all for errors that are NOT HttpExceptions:
 *   - Unhandled Prisma errors that escaped the service layer
 *   - Third-party library errors
 *   - Programming errors (TypeError, ReferenceError…)
 *
 * Always returns 500 Internal Server Error.
 * The error message is NEVER forwarded to the client in production
 * to avoid leaking implementation details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Always log the real error for internal debugging
    this.logger.error(
      `[${request.method}] ${request.url} → Unhandled exception`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const envelope: ErrorEnvelope = {
      success: false,
      statusCode: status,
      // Generic message — never expose internal details to the client
      message: 'An unexpected error occurred. Please try again later.',
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(envelope);
  }
}
