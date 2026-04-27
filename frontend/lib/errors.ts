/**
 * @file src/lib/errors.ts
 */

// ─── HTTP errors ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /**
   * @param validationErrors  Field-level messages from class-validator
   *                          (populated on 400 from NestJS ValidationPipe)
   */
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly validationErrors?: string[],
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** Human-readable summary: first validation error if available, otherwise message */
  get displayMessage(): string {
    return this.validationErrors?.[0] ?? this.message;
  }
}

/**
 * Refresh token genuinely invalid/expired.
 * The ONLY situation that justifies a forced logout.
 */
export class AuthenticationError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** Network-level failure — NEVER triggers a logout. */
export class NetworkError extends Error {
  constructor(message = "Network unavailable. Please check your connection.") {
    super(message);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const isAuthenticationError = (e: unknown): e is AuthenticationError =>
  e instanceof AuthenticationError;

export const isNetworkError = (e: unknown): e is NetworkError =>
  e instanceof NetworkError;
