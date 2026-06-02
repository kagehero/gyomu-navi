/**
 * Vitest setup for the integration project.
 *
 * Runs once per worker before any test file. We have two jobs:
 *
 *   1. Refuse to run if DATABASE_URL_TEST is missing. We must never let
 *      integration tests bind to the development/production database.
 *
 *   2. Rewrite DATABASE_URL in-process so when route handlers (or any
 *      code under src/lib/db/pool.ts) read it lazily, they connect to
 *      the test database instead. This is the simplest way to redirect
 *      everything without changing the production code path.
 *
 * JWT_SECRET also needs to be set so the auth-token helpers can sign and
 * verify cookies. We don't require a real secret — the test secret only
 * has to be consistent within the run.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config();

const testUrl = process.env.DATABASE_URL_TEST?.trim();

if (!testUrl) {
  throw new Error(
    [
      "Integration tests require DATABASE_URL_TEST.",
      "Set it to a Neon test-branch URL (or any throwaway Postgres). Example:",
      "  DATABASE_URL_TEST=postgresql://...neon.tech/neondb?sslmode=require",
      "",
      "Refusing to run against DATABASE_URL — that would clobber dev data.",
    ].join("\n"),
  );
}

/**
 * Belt-and-braces: the host portion of DATABASE_URL_TEST must differ from
 * the DATABASE_URL declared in .env. Re-parse .env directly because Vitest
 * runs this setup once per test file in the same worker — by the second file
 * `process.env.DATABASE_URL` has already been rewritten to point at the test
 * database, so comparing process.env would be a false alarm.
 */
function hostOf(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}
const envPath = resolve(process.cwd(), ".env");
const rawProdUrl = existsSync(envPath)
  ? dotenv.parse(readFileSync(envPath, "utf-8")).DATABASE_URL
  : undefined;
if (rawProdUrl && hostOf(testUrl) === hostOf(rawProdUrl)) {
  throw new Error(
    [
      "DATABASE_URL_TEST points at the same host as DATABASE_URL:",
      `  host = ${hostOf(testUrl)}`,
      "",
      "Integration tests TRUNCATE every data table. They must run against a",
      "separate database (e.g. a Neon branch). Refusing to start.",
    ].join("\n"),
  );
}

process.env.DATABASE_URL = testUrl;

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = "test-secret-only-used-in-integration-tests-aaaaaaaa";
}
