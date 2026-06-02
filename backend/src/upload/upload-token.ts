import { createHmac, timingSafeEqual } from "node:crypto";

export type UploadTokenPayload = {
  objectKey: string;
  contentType: string;
  contentLength: number;
  userId: string;
  exp: number;
};

export function signUploadToken(payload: UploadTokenPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyUploadToken(token: string, secret: string): UploadTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as UploadTokenPayload;
    if (!payload.objectKey || !payload.contentType || !payload.userId) return null;
    if (typeof payload.contentLength !== "number" || payload.contentLength < 1) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
