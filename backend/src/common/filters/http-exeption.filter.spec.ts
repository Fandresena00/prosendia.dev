/**
 * @file src/common/filters/http-exception.filter.spec.ts
 * @description Unit tests for HttpExceptionFilter and AllExceptionsFilter.
 */

import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ErrorEnvelope } from './http-exception.filter.js';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
} from './http-exception.filter.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function buildMockHost(url = '/api/test', method = 'GET') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  return {
    json,
    status,
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url, method }),
      }),
    } as any,
  };
}

// ─── HttpExceptionFilter ──────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('returns a normalized envelope for NotFoundException', () => {
    const { status, json, host } = buildMockHost();
    const exception = new NotFoundException('User not found');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const envelope: ErrorEnvelope = json.mock.calls[0][0];
    expect(envelope.success).toBe(false);
    expect(envelope.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(envelope.message).toBe('User not found');
    expect(envelope.path).toBe('/api/test');
    expect(envelope.timestamp).toBeDefined();
  });

  it('returns errors array for BadRequestException from class-validator', () => {
    const { status, json, host } = buildMockHost();
    // Simulate the shape NestJS produces for DTO validation failures
    const exception = new BadRequestException({
      message: [
        'email must be a valid email',
        'password must be at least 8 characters',
      ],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, host);

    const envelope: ErrorEnvelope = json.mock.calls[0][0];
    expect(envelope.message).toBe('Bad Request');
    expect(envelope.errors).toEqual([
      'email must be a valid email',
      'password must be at least 8 characters',
    ]);
  });

  it('returns 401 for UnauthorizedException', () => {
    const { status, json, host } = buildMockHost();
    const exception = new UnauthorizedException('Invalid token');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const envelope: ErrorEnvelope = json.mock.calls[0][0];
    expect(envelope.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(envelope.message).toBe('Invalid token');
  });

  it('logs warn for 4xx and error for 5xx', () => {
    const { host: host4xx } = buildMockHost();
    const { host: host5xx } = buildMockHost();

    filter.catch(new NotFoundException('not found'), host4xx);
    expect(filter['logger'].warn).toHaveBeenCalled();
    expect(filter['logger'].error).not.toHaveBeenCalled();

    jest.clearAllMocks();

    const internalError = {
      getStatus: () => HttpStatus.INTERNAL_SERVER_ERROR,
      getResponse: () => 'Internal error',
      stack: 'stack trace',
    } as any;
    filter.catch(internalError, host5xx);
    expect(filter['logger'].error).toHaveBeenCalled();
  });
});

// ─── AllExceptionsFilter ──────────────────────────────────────────────────────

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('returns 500 for any non-HTTP exception', () => {
    const { status, json, host } = buildMockHost('/api/users', 'POST');
    const error = new TypeError('Cannot read property of undefined');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const envelope: ErrorEnvelope = json.mock.calls[0][0];
    expect(envelope.success).toBe(false);
    expect(envelope.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    // Generic message — must NOT expose the real error to the client
    expect(envelope.message).not.toContain('Cannot read property');
  });

  it('logs the real error internally', () => {
    const { host } = buildMockHost();
    const error = new Error('DB connection lost');

    filter.catch(error, host);

    expect(filter['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled exception'),
      expect.stringContaining('DB connection lost'),
    );
  });

  it('handles non-Error thrown values (string, object, null)', () => {
    const { host } = buildMockHost();

    // Should not throw
    expect(() => filter.catch('something went wrong', host)).not.toThrow();
    expect(() => filter.catch(null, host)).not.toThrow();
    expect(() => filter.catch({ code: 'UNKNOWN' }, host)).not.toThrow();
  });
});
