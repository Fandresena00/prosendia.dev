/**
 * @file src/lib/api-client.ts
 *
 * FIX 1 — NestJS validation errors (parseResponse)
 * ──────────────────────────────────────────────────
 * NestJS ValidationPipe returns: { message: string[], error: "Bad Request", statusCode: 400 }
 * The previous parseResponse only checked `data.errors` (our custom format), not `data.message`.
 * Result: validation messages like "businessProfileId should not be empty" were lost,
 * and the displayed error fell back to the generic "Bad Request" string.
 *
 * Fix: check both `data.errors` and `data.message` (array form) for validation errors.
 *
 * FIX 2 — parseResponse message extraction order
 * ───────────────────────────────────────────────
 * The previous code filtered out "Bad Request" from `data.error` but didn't
 * suppress it as the final fallback. Now the first validation error is always
 * surfaced as the primary message.
 */

import { env } from "./env";
import { ApiError, AuthenticationError, NetworkError } from "./errors";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";

export interface ApiClientOptions extends RequestInit {
  skipRefresh?: boolean;
}

interface NestErrorEnvelope {
  message?: string | string[];
  error?:   string;
  errors?:  string[];
  code?:    string;
}

const MAX_RETRIES        = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown): void {
  for (const { resolve, reject } of pendingQueue) {
    if (error) reject(error);
    else resolve();
  }
  pendingQueue = [];
}

async function fetchWithRetry(
  url:     string,
  options: ApiClientOptions,
  attempt = 0,
): Promise<Response> {
  try {
    const headers: Record<string, string> = {};
    if (typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }
    Object.assign(headers, options.headers);

    return await fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw new NetworkError();
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: (NestErrorEnvelope & Record<string, unknown>) | null = null;
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text) as NestErrorEnvelope & Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (response.ok) return data as T;

  // ── FIX: Handle NestJS validation error format ─────────────────────────────
  // NestJS ValidationPipe:  { message: string[], error: "Bad Request", statusCode: 400 }
  // Our custom API format:  { errors: string[], message: string, code?: string }
  const rawErrors: unknown[] =
    Array.isArray(data?.errors) && (data.errors as unknown[]).length > 0
      ? (data.errors as unknown[])
      : Array.isArray(data?.message) && (data.message as unknown[]).length > 0
      ? (data.message as unknown[])              // ← NestJS ValidationPipe format
      : [];

  const validationErrors: string[] | undefined =
    rawErrors.length > 0
      ? rawErrors.filter((e): e is string => typeof e === "string")
      : undefined;

  // Message priority:
  //  1. First validation error (most specific)
  //  2. message field if it's a non-generic string
  //  3. error field (e.g. "Unauthorized")
  //  4. Plain text body
  //  5. Generic fallback
  const message =
    validationErrors?.[0] ??
    (typeof data?.message === "string" && data.message !== "Bad Request"
      ? data.message
      : undefined) ??
    (typeof data?.error === "string" && data.error !== "Bad Request"
      ? data.error
      : undefined) ??
    (text.trim().length > 0 && !text.trim().startsWith("{")
      ? text.trim()
      : undefined) ??
    `Request failed with status ${response.status}`;

  throw new ApiError(
    response.status,
    message,
    typeof data?.code === "string" ? data.code : undefined,
    validationErrors,
  );
}

async function silentRefresh(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${env.API_URL}/auth/refresh`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
    });
  } catch {
    throw new NetworkError("Cannot reach server to refresh session.");
  }

  if (response.status === 401 || response.status === 403) {
    clearSessionCookie();
    throw new AuthenticationError();
  }
  if (!response.ok) {
    throw new NetworkError(`Refresh endpoint returned ${response.status}.`);
  }
  setSessionCookie();
}

async function executeRequest<T>(
  url:     string,
  options: ApiClientOptions,
): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return parseResponse<T>(response);
}

export async function apiClient<T>(
  path:    string,
  options: ApiClientOptions = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${env.API_URL}${path}`;

  try {
    return await executeRequest<T>(url, options);
  } catch (error) {
    if (error instanceof NetworkError) throw error;

    if (
      options.skipRefresh ||
      !(error instanceof ApiError) ||
      !error.isUnauthorized
    ) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        pendingQueue.push({
          resolve: () => executeRequest<T>(url, options).then(resolve).catch(reject),
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      await silentRefresh();
      processQueue(null);
      return await executeRequest<T>(url, options);
    } catch (refreshError) {
      processQueue(refreshError);
      if (refreshError instanceof NetworkError) throw refreshError;
      throw refreshError instanceof AuthenticationError
        ? refreshError
        : new AuthenticationError();
    } finally {
      isRefreshing = false;
    }
  }
}
