# NestJS + AWS Migration Plan (Post-Phase1)

Target architecture for after Phase1 ships. Until Phase1 is in production, the
current stack (Next.js Route Handlers + Neon + Vercel Blob) stays canonical —
do not start migrating live code until the freeze.

## Current → Target

| Concern            | Current (Phase1)                                            | Target                                  |
|--------------------|-------------------------------------------------------------|-----------------------------------------|
| Frontend           | Next.js 15 App Router (SSR + Route Handlers)                | Next.js as **SPA** (no API routes)      |
| Backend            | Next.js Route Handlers under `src/app/api/*`                | NestJS on EC2 t3.large, port 3001       |
| DB                 | Neon Postgres                                               | AWS RDS Postgres 16                     |
| Auth               | Custom JWT in httpOnly cookie `gyomu_session` (jsonwebtoken)| NestJS `AuthModule` + passport-jwt      |
| File storage       | Vercel Blob (`@vercel/blob`)                                | S3 + presigned URLs (`@aws-sdk/client-s3`) |
| Image proxy        | `/api/reports/[id]/image` (server reads private blob)       | S3 GET presigned URL (signed at API)    |
| Reverse proxy / TLS| Vercel edge                                                 | Nginx on EC2                            |
| Process mgmt       | Vercel serverless                                           | PM2 (`ecosystem.config.js`)             |
| Secrets            | Vercel env vars                                             | EC2 IAM Role + Parameter Store / `.env` |

## Key decisions

1. **Existing SQL migrations are preserved.** `src/lib/db/migrations/00{1..8}_*.sql`
   contain CHECK constraints, partial unique indexes, triggers, and a
   role/FK consistency CHECK — TypeORM `synchronize` would silently drop these.
   We run the existing `.sql` files via TypeORM's raw-SQL migration runner;
   entities are only used as a typed query surface.
2. **Vercel Blob → S3 cutover is destructive.** Phase1 image data is
   considered disposable; no copy script is provided. Production cutover plan
   reissues image uploads only.
3. **Next.js becomes an SPA.** All `src/app/api/*` routes are deleted in the
   migration branch. `RoleBasedLayout` / `RequireAuth` use the SPA `useAuth`
   hook reading from NestJS `/auth/me`. The cost is losing SSR per-request
   data fetching for dashboard/reports — acceptable given the app is
   already mostly client-rendered.
4. **JWT stays httpOnly.** NestJS sets `Set-Cookie: <name>; HttpOnly; Secure; SameSite=Lax`.
   Cross-origin (Next.js on `app.example.com`, API on `api.example.com`) requires
   `SameSite=None; Secure` and CORS `credentials: true`.
5. **AWS auth via EC2 IAM Role.** No long-lived access keys in env or repo.
   The Node SDK picks up the role automatically via IMDS v2.

## Migration phases

### Phase A — Backend stand-up (1 week)

1. Provision RDS (Postgres 16, single-AZ to start, encrypted, in private subnet).
2. Provision S3 bucket (private; bucket policy denies public ACLs; CORS
   configured for the Next.js SPA origin).
3. Provision EC2 t3.large (Amazon Linux 2023, IAM role with `s3:PutObject`,
   `s3:GetObject` on bucket prefix, RDS connect via secrets manager).
4. Apply existing `001..008` SQL migrations to RDS via TypeORM raw-SQL runner.
5. Bring up `backend/` NestJS scaffold (this PR), deploy via PM2 + Nginx.
6. Smoke-test `/api/health`, `/api/auth/login`, `/api/auth/me` against RDS.

### Phase B — Module-by-module port (2 weeks)

Port each Next.js Route Handler tree to a NestJS module. Order is "leaf first"
to keep both stacks runnable in parallel during the cutover:

1. `master/*` (admin-only CRUD; no dependencies)
2. `me/*` (employee scope; depends on auth)
3. `attendance/*` (depends on auth + sites/staffs)
4. `reports/*` + `reports/sessions/*` + upload presign (depends on master)
5. `notices/*` + `board/*` (depends on auth + master)

For each module: write controllers + services + DTOs (zod or class-validator),
reuse the existing zod schemas where possible to minimize semantic drift.

### Phase C — Frontend cutover (3–4 days)

1. Replace `src/lib/api.ts` with an axios instance pointed at the NestJS base
   URL, `withCredentials: true`.
2. Delete `src/app/api/*` entirely.
3. Replace `src/lib/auth/*` (server-side cookie verification) — auth state now
   comes from `/auth/me` only.
4. Update `middleware.ts` to gate on cookie presence (presence only — actual
   validation happens at the API).
5. Update the Vercel Blob upload path: `uploadReportImage` now does
   `GET /api/uploads/presign` → `PUT` to the returned S3 URL → POST the
   public-read or proxied URL back to the reports endpoint.
6. Run the existing Playwright smoke suite against the new stack as the
   acceptance gate.

### Phase D — Cutover (1 day)

1. DNS-flip Next.js from Vercel to CloudFront → S3 static export (or keep on
   Vercel pointed at the new API; either is fine).
2. Decommission Vercel Blob store.
3. Keep Neon running for 7 days as rollback safety, then drop.

## What is **out of scope** for the migration PR

- OCR (Phase2 candidate).
- Realtime / websockets (no current consumer).
- Multi-tenancy / per-customer subdomains.
- Background jobs (no current consumer; if needed, BullMQ + Redis on the same EC2).

## Risks / open questions

- **EC2 t3.large single instance** has no HA. Acceptable for an internal tool
  but document the recovery story (AMI + RDS snapshot restore).
- **Nginx config** below assumes SSL is terminated at Nginx with certbot.
  If TLS is offloaded to an ALB instead, the upstream `proxy_set_header`
  block needs `X-Forwarded-Proto $http_x_forwarded_proto` instead of `https`.
- **passport-jwt cookie extractor** must agree with the cookie name the
  frontend reads (we keep `gyomu_session` for continuity).
- **DB connection pool sizing.** RDS t3.large family caps ~600 connections.
  TypeORM default pool is 10 per process; with PM2 cluster mode `instances: 2`
  that's 20 — leave headroom for migrations + read tools.

## File map (this scaffold)

- `backend/` — NestJS project (this PR creates skeleton only; modules are
  empty controllers with TODO comments pointing at the Next.js route they
  replace).
- `backend/.env.example` — required env vars (DB, JWT, S3, CORS).
- `infra/nginx.conf` — reverse proxy for SPA + API.
- `infra/ecosystem.config.js` — PM2 process file.
- `docs/migration-plan.md` — this document.
