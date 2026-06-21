// middleware.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_ACCESS_COOKIE = "vendeo_admin_access_token";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Page de login publique
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/")) {
    const hasSession = req.cookies.has(ADMIN_ACCESS_COOKIE);
    if (!hasSession) {
      const loginUrl = new URL("/", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
