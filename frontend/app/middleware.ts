/**
 * @file middleware.ts  ← place at the root of /src
 * @description Next.js Edge Middleware — route protection via presence cookie.
 *
 * Reads `prosendia.session` (non-HttpOnly, set by JS after login).
 * The real HttpOnly auth cookies are scoped to the backend domain — invisible here.
 * This cookie is a UX hint only. Real security happens server-side on every API call.
 */

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/pricing", "/about", "/legal"] as const;

const AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
] as const;

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/billing",
  "/inbox",
  "/posts-comments",
  "/business-profile",
  "/analytics",
  "/accounts",
] as const;

function hasSession(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE_NAME);
}

function matchesRoutes(pathname: string, routes: readonly string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const authenticated = hasSession(request);

  // 1. Always accessible
  if (matchesRoutes(pathname, PUBLIC_ROUTES)) return NextResponse.next();

  // 2. Auth routes — redirect logged-in users to dashboard
  if (matchesRoutes(pathname, AUTH_ROUTES)) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected routes — redirect anonymous users to sign-in
  if (matchesRoutes(pathname, PROTECTED_PREFIXES)) {
    if (!authenticated) {
      const loginUrl = new URL("/sign-in", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\..*).*)"],
};
