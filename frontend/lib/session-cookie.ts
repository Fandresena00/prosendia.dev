/**
 * @file src/lib/session-cookie.ts
 * @description Presence flag cookie for Next.js Edge Middleware redirect logic.
 *
 * The real auth cookies (HttpOnly, set by the backend) are invisible to
 * middleware — they're scoped to the backend domain. This non-HttpOnly cookie
 * is the only session signal readable by the Edge runtime.
 *
 * It contains NO sensitive data — value is always "1".
 * If forged, the user sees a protected page but every API call returns 401.
 */

export const SESSION_COOKIE_NAME = "vendeo.session" as const;

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

/**
 * True if the presence-flag cookie exists in the browser.
 * This is a UX hint only: it means "session potentially valid".
 */
export function hasSessionCookie(): boolean {
  if (!isBrowser()) return false;
  // `document.cookie` is a single string "a=1; b=2; ..."
  return document.cookie
    .split(";")
    .map((p) => p.trim())
    .some((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
}

export function setSessionCookie(): void {
  if (!isBrowser()) return;
  document.cookie = [
    `${SESSION_COOKIE_NAME}=1`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

export function clearSessionCookie(): void {
  if (!isBrowser()) return;
  document.cookie = [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}
