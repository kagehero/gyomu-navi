# Gyomu Navi (業務ナビ)

Internal operations **navigation UI** for day-to-day workplace tasks. A **[Next.js (App Router)](https://nextjs.org/)** app groups Dashboard, reports, attendance, notices, master data, and settings behind one shell: **admin** users get a desktop sidebar, **employee** users get a mobile-style layout. **Authentication** is implemented with **Route Handlers** and **PostgreSQL** (session via **httpOnly** cookie + JWT).

> **Note:** Screen content such as lists and dashboards may still use **mock data** in `src/lib/mockData.ts` until you wire those views to your own APIs.

## Tech stack

| Area | Choice |
|------|--------|
| App | [Next.js 15](https://nextjs.org/) (App Router), [React 18](https://react.dev/), TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + shadcn-style UI (`src/components/ui/`) |
| Routing & layouts | `src/app/`, `next/link` |
| Server state | [TanStack Query](https://tanstack.com/query) (in `src/app/providers.tsx`) |
| Forms & validation | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| API / auth | `src/app/api/**/route.ts` (Node runtime + `pg`) |
| Database | [PostgreSQL](https://www.postgresql.org/) via [node-pg](https://node-postgres.com/) |
| Auth | bcrypt-hashed passwords, [JWT](https://jwt.io/) in an httpOnly cookie |
| Unit tests | [Vitest](https://vitest.dev/) + Testing Library |
| E2E (optional) | [Playwright](https://playwright.dev/) |

**Path alias:** `@/` → `src/` (see `tsconfig.json`).

**Feature UI** lives under `src/features/<area>/` (e.g. `features/dashboard/Dashboard.tsx`). App route files in `src/app/` stay thin and import those modules. The name `src/pages` is avoided on purpose — Next.js reserves it for the **Pages Router**.

## Prerequisites

- **Node.js** 18+ (20 LTS recommended) and **npm** 9+
- **Docker** (recommended) **or** a running **PostgreSQL 16+** instance
- A **`.env`** file — copy from **`.env.example`**

## Database & environment

1. Copy the example env and adjust secrets for production.

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL (Docker example):

   ```bash
   docker compose up -d
   ```

   Default URL matches `.env.example`: `postgresql://gyomu:gyomu@localhost:5432/gyomu_navi`.

   **Using [Neon](https://neon.tech/):** Copy the connection string from the Neon console into `DATABASE_URL`. The pool enables TLS for `neon.tech` and similar hosts (see `src/lib/db/pool.ts`). Run `db:migrate` and `db:seed` with that `DATABASE_URL`.

3. Create tables and **seed users**:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   | Role | Email | UI |
   |------|--------|-----|
   | 管理者 (admin) | `admin@example.com` | Desktop layout, master + settings |
   | 従業員 (employee) | `employee@example.com` | Mobile layout, scoped data (master/settings blocked) |

   Default password (change in production): `changeme123`.

4. `JWT_SECRET` must be a long random string in production. Optional: `ALLOW_REGISTER=true` for `POST /api/auth/register` (keep off in production).

## Getting started

```bash
npm install
# ensure .env exists and database is up, then:
npm run db:migrate
npm run db:seed
npm run dev
```

- **App:** [http://localhost:3000](http://localhost:3000) — unauthenticated users are sent to `/login`.  
- **API health:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (app + `/api` on the same origin) |
| `npm run build` | Production build |
| `npm run start` | Start production server (after `build`) |
| `npm run db:migrate` | Run SQL in `src/lib/db/` on `DATABASE_URL` |
| `npm run db:seed` | Insert default users |
| `npm run lint` | `next lint` (ESLint) |
| `npm test` / `npm run test:watch` | Vitest |

## Project layout (high level)

```text
src/app/                 # routes, layouts, providers, globals.css
  login/                 # public login
  (app)/                 # protected routes (route group)
  api/                   # Route Handlers (auth, health)
src/features/            # domain screens + auth (AuthContext, Login, …)
src/components/
  ui/                    # shadcn primitives
  layout/                # app shell (sidebar, nav, RequireAuth, …)
src/hooks/               # shared hooks (e.g. toast, mobile)
src/lib/                 # api client, db, server auth helpers, mock data, utils
```

## Application routes

| Path | View |
|------|------|
| `/login` | Login (public) |
| `/` | Dashboard (protected) |
| `/reports` | Reports |
| `/attendance` | Attendance |
| `/notices` | Notices |
| `/master` | Master (admin only) |
| `/settings` | Settings (admin only) |

## Production deployment

- Set `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV=production` on the host.
- On a **single** Next deployment, the browser calls same-origin `/api/...` — no `NEXT_PUBLIC_API_BASE_URL` is required.
- If the **browser** must call a **different** API host, set `NEXT_PUBLIC_API_BASE_URL` (no trailing slash) and configure cookies/CORS for cross-site use (`COOKIE_SAME_SITE=none` requires HTTPS).

### Vercel

1. **Project → Settings → Environment Variables** — add at least:
   - `DATABASE_URL` — your Postgres URL (e.g. Neon; include SSL as in `.env.example`).
   - `JWT_SECRET` — a long random string (32+ characters).
2. **Redeploy** after adding or changing variables (Vercel does not always apply new envs to old deployments).
3. **Database:** run migrations and seed **against the same** `DATABASE_URL` from your machine (or a CI job), e.g. `npm run db:migrate` and `npm run db:seed` with that URL exported. The production DB must contain the `users` table and rows, or login will return 401, not 500.
4. If `/api/auth/login` returns **500**, check **Functions →** your deployment **→ Logs** for stack traces. Common causes: missing `DATABASE_URL` / `JWT_SECRET`, DB unreachable, or wrong SSL settings. If config is missing, the API now returns **503** with a `code: "config"` hint in JSON (after the latest code is deployed).

## License

`private: true` in `package.json` — treat as internal / not published unless you change that.
