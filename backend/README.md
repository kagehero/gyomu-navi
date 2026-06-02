# gyomu-navi-backend (scaffold)

NestJS service that will replace the Phase1 Next.js Route Handlers as part of
the post-Phase1 migration to EC2 + RDS + S3. **This scaffold is intentionally
incomplete** — it stands up the cross-cutting plumbing (auth, DB, S3 presign,
health) so the per-feature port can land module-by-module. See
[`docs/migration-plan.md`](../docs/migration-plan.md) for sequencing.

## What's here

```
backend/
├── src/
│   ├── auth/         JWT (httpOnly cookie), passport-jwt, login/logout/me
│   ├── users/        UserEntity + lookup service
│   ├── upload/       S3 presigned PUT for report images
│   ├── database/     TypeORM config + bootstrap migration wrapping Phase1 SQL
│   ├── health.controller.ts
│   ├── app.module.ts
│   └── main.ts
├── ormconfig.ts      Standalone DataSource for `npm run migration:*`
├── .env.example      Required env vars (DB, JWT, S3, CORS)
└── package.json
```

## What's NOT here (deliberate)

- Attendance / reports / notices / board / master controllers.
  These wait for the per-module port in the migration PR.
- TypeORM entities for staffs / sites / clients / etc. Same reason —
  we don't add types we can't exercise yet.
- Tests beyond a `health.controller` smoke test (to add).
- Containerfile. PM2 + systemd is the deploy model.

## Local dev

```bash
cd backend
cp .env.example .env   # fill in DB + JWT + S3
npm install
npm run start:dev      # boots on :3001
```

To run migrations against a fresh RDS instance:

```bash
# Requires the Phase1 sibling tree (../src/lib/db/migrations/*.sql) on disk.
npm run migration:run
```

## Routes (current scaffold)

| Method | Path                | Auth | Notes |
|--------|---------------------|------|-------|
| GET    | `/api/health`       | —    | Liveness probe |
| POST   | `/api/auth/login`   | —    | Issues httpOnly `gyomu_session` cookie |
| POST   | `/api/auth/logout`  | —    | Clears the cookie |
| GET    | `/api/auth/me`      | JWT  | SPA bootstrap |
| POST   | `/api/auth/register`| —    | **501** stub — waits for master module |
| GET    | `/api/users/me`     | JWT  | Same payload as /auth/me; kept for symmetry |
| POST   | `/api/uploads/presign` | JWT | Returns `{ uploadUrl, objectKey, expiresIn }` |
