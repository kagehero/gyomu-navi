import type { NextRequest } from "next/server";
import { getCookieName, verifyUserToken } from "./tokens";

export function getAuthedUserIdFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get(getCookieName())?.value;
  if (!token) return null;
  try {
    return verifyUserToken(token).sub;
  } catch {
    return null;
  }
}
