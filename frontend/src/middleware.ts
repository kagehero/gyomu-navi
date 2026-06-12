import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DASHBOARD_ONLY_HIDDEN_PREFIXES, isDashboardOnlyRelease } from "@/lib/releaseMode";

export function middleware(request: NextRequest) {
  // Automated scanners send bogus Server Action POSTs (e.g. Next-Action: x).
  // This app uses Route Handlers only — reject early to avoid Next.js error noise.
  if (request.method === "POST" && request.headers.has("next-action")) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isDashboardOnlyRelease()) {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  for (const prefix of DASHBOARD_ONLY_HIDDEN_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/reports/:path*",
    "/attendance/:path*",
    "/notices/:path*",
    "/master/:path*",
    "/profile/:path*",
    "/login",
    "/register",
  ],
};
