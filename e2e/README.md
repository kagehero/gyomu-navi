# E2E tests

Playwright suites for Gyomu Navi. The tests are split into two tiers:

## 1. Smoke (`smoke.spec.ts`)

Runs against any environment that can serve the app. Verifies:

- Login page renders and validates required fields.
- Static assets (`/manifest.webmanifest`, `/favicon.svg`) are served.
- Unauthenticated requests to protected routes redirect to `/login`.

No DB-state assumptions. Safe to run in CI without seed data.

## 2. Authenticated flows (`employee-flow.spec.ts`, `admin-flow.spec.ts`)

Skipped unless `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (and optionally
`E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD`) are set in env. These hit a
seeded environment — typically a Neon test branch loaded via `npm run db:seed`.

## Running locally

`playwright.config.ts` boots `next dev --port 3100` automatically, so a one-shot
run needs no extra terminal:

```bash
# Smoke only (default port: 3100, server managed by Playwright)
npm run test:e2e:smoke

# Full suite — provide seeded creds to opt in to admin/employee flows
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD=changeme123 \
E2E_EMPLOYEE_EMAIL=employee@example.com \
E2E_EMPLOYEE_PASSWORD=changeme123 \
npm run test:e2e
```

### Pointing at an existing server

If a server is already running (your `npm run dev`, a prod build via
`npm run start`, or staging), set `PLAYWRIGHT_BASE_URL` — Playwright will skip
the auto-launch and hit the URL you provide:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test smoke.spec.ts
```
