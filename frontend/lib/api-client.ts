/**
 * @file src/lib/api-client.ts
 */

import { env } from "./env";
import { ApiError, AuthenticationError, NetworkError } from "./errors";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";

export interface ApiClientOptions extends RequestInit {
  skipRefresh?: boolean;
}

interface NestErrorEnvelope {
  message?: string;
  error?: string;
  errors?: string[];
  code?: string;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> =
  [];

function processQueue(error: unknown): void {
  for (const { resolve, reject } of pendingQueue) {
    if (error) reject(error);
    else resolve();
  }
  pendingQueue = [];
}

async function fetchWithRetry(
  url: string,
  options: ApiClientOptions,
  attempt = 0,
): Promise<Response> {
  try {
    const headers: Record<string, string> = {};

    // On ne définit Content-Type que si le corps est une chaîne JSON
    // (pour FormData, fetch le fera automatiquement avec la boundary)
    if (typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    // Fusionne avec les headers éventuels passés dans options
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
  // Read body ONCE — reused in both success and error branches
  const text = await response.text();

  let data: (NestErrorEnvelope & Record<string, unknown>) | null = null;
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text) as NestErrorEnvelope & Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (response.ok) {
    return data as T;
  }

  // Extract specific class-validator messages from `errors` array
  const validationErrors: string[] | undefined =
    Array.isArray(data?.errors) && data.errors.length > 0
      ? (data.errors as string[])
      : undefined;

  // Priority: specific validation error > meaningful message > generic label > fallback
  const message =
    validationErrors?.[0] ??
    (typeof data?.message === "string" && data.message !== "Bad Request"
      ? data.message
      : undefined) ??
    (typeof data?.error === "string" ? data.error : undefined) ??
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
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
  url: string,
  options: ApiClientOptions,
): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return parseResponse<T>(response);
}

export async function apiClient<T>(
  path: string,
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
          resolve: () =>
            executeRequest<T>(url, options).then(resolve).catch(reject),
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
