import jwt from "jsonwebtoken";

const COOKIE_NAME = "gyomu_session";
const SEVEN_DAYS = 7 * 24 * 60 * 60;

export type JwtUserPayload = { sub: string; email: string };

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET is required (min 32 random characters in production)");
  }
  return s;
}

export function signUserToken(user: { id: string; email: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email } satisfies JwtUserPayload,
    getJwtSecret(),
    { expiresIn: SEVEN_DAYS, algorithm: "HS256" },
  );
}

export function verifyUserToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & JwtUserPayload;
  if (typeof decoded.sub !== "string" || typeof decoded.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub, email: decoded.email };
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

/**
 * フロント（Vercel）と API（別ホスト）に分かれるときは
 * `COOKIE_SAME_SITE=none`（HTTPS 必須）と CORS `FRONTEND_ORIGIN` を設定する。
 */
export function getCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none" | "strict";
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === "production";
  const crossSite = process.env.COOKIE_SAME_SITE === "none";
  return {
    httpOnly: true,
    secure: crossSite || isProd,
    sameSite: crossSite ? "none" : "lax",
    maxAge: SEVEN_DAYS * 1000,
    path: "/",
  };
}

export function getClearCookieOptions(): {
  path: string;
  sameSite: "lax" | "none" | "strict";
  secure: boolean;
} {
  const o = getCookieOptions();
  return { path: o.path, sameSite: o.sameSite, secure: o.secure };
}
