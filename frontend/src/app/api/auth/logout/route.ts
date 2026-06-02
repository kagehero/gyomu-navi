import { NextResponse } from "next/server";
import { getClearCookieOptions, getCookieName } from "@/lib/auth/tokens";

export const runtime = "nodejs";

export async function POST() {
  const c = getClearCookieOptions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), "", {
    maxAge: 0,
    path: c.path,
    sameSite: c.sameSite,
    secure: c.secure,
  });
  return res;
}
