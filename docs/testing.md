# Testing

There are two flavours of tests in this repo:

| Flavour     | Files               | Environment | What runs against        |
|-------------|---------------------|-------------|--------------------------|
| Unit        | `*.test.ts(x)`      | jsdom       | pure functions, React UI |
| Integration | `*.itest.ts`        | node        | real Postgres (test DB)  |

`vitest.config.ts` exposes both as projects. The default `npm test` runs
both. `test:unit` skips the DB, useful in environments without a test DB.

## Scripts

```bash
npm test                # both projects
npm run test:unit       # jsdom-only (no DB required)
npm run test:integration # node + DB (DATABASE_URL_TEST required)
npm run test:watch      # vitest in watch mode (all projects)
```

## Unit tests

Just write `*.test.ts(x)` next to the code under test. Imports follow
the same `@/` alias as production code. Examples already in the tree:

- `src/lib/geo.test.ts` — Haversine
- `src/lib/dates.test.ts` — JST day boundary

## Integration tests

Integration tests import route handlers directly (no Next.js server) and
call them with forged `NextRequest` objects. They hit a **separate test
database** — never the dev/prod DB. The `integration-setup.ts` file
refuses to run if `DATABASE_URL_TEST` is missing.

### One-time setup

1. **Create a Neon branch** of your dev DB (or any throwaway Postgres).
   Recommended: a Neon branch named `test` off `main`.

2. **Add `DATABASE_URL_TEST` to `.env`** with that branch's connection
   string. Example:

   ```env
   DATABASE_URL_TEST=postgresql://...neon.tech/neondb?sslmode=require
   ```

3. Optional: set `JWT_SECRET` for the test run. If unset, the setup
   file plants a throwaway secret.

That's it — the first integration test run will migrate the test DB
automatically.

### How tests reset state

Each integration test file calls `setupFixtures()` in `beforeAll`,
which `TRUNCATE`s every data table and re-inserts a small fixed dataset
(two departments, one client, two sites, two staff, three users — one
per role). Tests are serial within an integration project (a single
fork) so the truncate doesn't race.

If you need exotic data, insert it on top of fixtures inside the test.
If you need an isolated table state per `describe` block, call
`setupFixtures()` again from a nested `beforeAll`.

### Writing a new integration test

1. Create `<path>/<name>.itest.ts` next to the route under test.
2. `import { GET, POST } from "./route";` (and similar for `[id]`).
3. Use the helpers in `src/test/auth.ts` to build requests:

   ```ts
   import { getAs, postAs, patchAs, deleteAs } from "@/test/auth";

   const res = await POST(postAs(admin, "http://t/api/...", { ... }));
   expect(res.status).toBe(201);
   ```

4. `setupFixtures()` returns `{ ids, emails }` you can pass through.
5. `afterAll(() => closePool())` keeps the worker from hanging on the
   open pool.

### Test fixture contents

`setupFixtures()` (see `src/test/fixtures.ts`) creates:

- **departments**: 清掃部門, 警備部門
- **client**: 株式会社ABC (one client only)
- **sites**: Alpha 拠点 (centre 35.6896,139.6917 / r=100m), Beta 拠点
- **business_type**: 日常清掃 (ABC client)
- **staffs**: 佐藤 花子 (cleaning, assigned to Alpha), 鈴木 一郎 (security, Beta)
- **users**: `admin@t`, `manager@t` (cleaning), `employee@t` (sato)

Password for all three test users: `testpass`.

## CI

GitHub Actions (or whatever CI you adopt) needs:

- `DATABASE_URL_TEST` available as a secret/env var pointing at a Neon
  branch you're happy to clobber.
- The same Node/npm versions that match `package.json`.
- `npm ci && npm test` is enough.

The integration project marshals to a single fork (`singleFork: true`)
so adding more `*.itest.ts` files doesn't introduce concurrency bugs.
