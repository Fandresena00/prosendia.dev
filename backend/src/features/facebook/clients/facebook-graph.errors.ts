export interface FacebookApiErrorData {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export class FacebookApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | undefined,
    message: string,
    public readonly fbtrace_id?: string,
  ) {
    super(message);
    this.name = 'FacebookApiError';
    Object.setPrototypeOf(this, FacebookApiError.prototype);
  }

  get isRetryable(): boolean {
    return false;
  }
}

export class FacebookTokenError extends FacebookApiError {
  constructor(message: string, subcode?: number, fbtrace_id?: string) {
    super(190, subcode, message, fbtrace_id);
    this.name = 'FacebookTokenError';
    Object.setPrototypeOf(this, FacebookTokenError.prototype);
  }
}

export class FacebookPermissionError extends FacebookApiError {
  constructor(message: string, fbtrace_id?: string) {
    super(200, undefined, message, fbtrace_id);
    this.name = 'FacebookPermissionError';
    Object.setPrototypeOf(this, FacebookPermissionError.prototype);
  }
}

export class FacebookRateLimitError extends FacebookApiError {
  constructor(code: number, message: string, fbtrace_id?: string) {
    super(code, undefined, message, fbtrace_id);
    this.name = 'FacebookRateLimitError';
    Object.setPrototypeOf(this, FacebookRateLimitError.prototype);
  }

  get isRetryable(): boolean {
    return true;
  }
}

export class FacebookTemporaryError extends FacebookApiError {
  constructor(message: string, code = 2, fbtrace_id?: string) {
    super(code, undefined, message, fbtrace_id);
    this.name = 'FacebookTemporaryError';
    Object.setPrototypeOf(this, FacebookTemporaryError.prototype);
  }

  get isRetryable(): boolean {
    return true;
  }
}

export function mapGraphApiError(err: FacebookApiErrorData): FacebookApiError {
  const { code, error_subcode, message, fbtrace_id } = err;
  if (code === 190)
    return new FacebookTokenError(message, error_subcode, fbtrace_id);
  if (code === 200) return new FacebookPermissionError(message, fbtrace_id);
  if (code === 4 || code === 17 || code === 32)
    return new FacebookRateLimitError(code, message, fbtrace_id);
  if (code === 2) return new FacebookTemporaryError(message, code, fbtrace_id);
  return new FacebookApiError(code, error_subcode, message, fbtrace_id);
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof FacebookApiError) return error.isRetryable;
  return false;
}
