/**
 * Test helpers for forging authenticated NextRequest objects.
 *
 * We don't go through /api/auth/login — instead we sign the same JWT cookie
 * the login route would set. This keeps the test focused on the endpoint
 * under test rather than the auth flow.
 */
import { NextRequest } from "next/server";
import { getCookieName, signUserToken } from "@/lib/auth/tokens";

export type AuthedFixture = {
  id: string;
  email: string;
  cookie: string;
};

/**
 * Sign a session cookie for an existing user (by id+email). Returns the
 * `Cookie` header value to set on a NextRequest.
 */
export function signSessionCookie(user: { id: string; email: string }): string {
  const token = signUserToken(user);
  return `${getCookieName()}=${token}`;
}

type RequestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  url?: string;
  body?: unknown;
  cookie?: string;
};

/**
 * Build a NextRequest you can hand to a route handler. The URL is mostly
 * cosmetic — pass query params through it if a route reads them.
 */
export function buildRequest({
  method = "GET",
  url = "http://test.local/api/_",
  body,
  cookie,
}: RequestInit = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";

  return new NextRequest(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Shorthand: build a JSON-body POST request authenticated as a user. */
export function postAs(user: { id: string; email: string }, url: string, body?: unknown) {
  return buildRequest({ method: "POST", url, body, cookie: signSessionCookie(user) });
}

export function getAs(user: { id: string; email: string }, url: string) {
  return buildRequest({ method: "GET", url, cookie: signSessionCookie(user) });
}

export function patchAs(user: { id: string; email: string }, url: string, body?: unknown) {
  return buildRequest({ method: "PATCH", url, body, cookie: signSessionCookie(user) });
}

export function deleteAs(user: { id: string; email: string }, url: string) {
  return buildRequest({ method: "DELETE", url, cookie: signSessionCookie(user) });
}
