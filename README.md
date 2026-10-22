# FieldTrack

Multi-tenant field-operations SaaS for retail, FMCG, and distributed field teams to plan trips, manage approvals, record store visits, capture evidence, and review outcomes.

---

## Architecture & Directory Structure

FieldTrack is built as a single **Next.js (App Router, strict TypeScript)** modular monolith backed by **Supabase (PostgreSQL + Row-Level Security + Auth)**.

```text
├── .env.example              # Environment variable template (names & descriptions only)
├── supabase/
│   └── migrations/           # Versioned SQL schema & RLS migrations
├── src/
│   ├── app/                  # Next.js App Router pages, layouts, error/loading states, & REST routes
│   │   ├── api/orgs/         # Organization & membership REST API endpoints
│   │   ├── approvals/        # Manager approvals queue route
│   │   ├── team/             # Organization membership management route
│   │   ├── trips/            # Field trip planning route
│   │   └── visits/           # Store visit recording & evidence route
│   ├── components/
│   │   ├── shell/            # Responsive AppShell & keyboard/screen-reader navigation
│   │   └── ui/               # Reusable WCAG 2.1 AA UI states (EmptyState, LoadingState, ErrorState, StatusBadge)
│   ├── lib/
│   │   ├── auth/             # Server-verified session resolution (`supabase.auth.getUser()`)
│   │   ├── env/              # Zod environment validation (`public.ts` & `server-only` `server.ts`)
│   │   ├── http/             # Standardized `{ data, error, meta }` envelopes & cursor pagination
│   │   └── supabase/         # Server-only Supabase client factory
│   ├── modules/
│   │   └── tenancy/          # Domain types, Zod boundary schemas, RBAC authorization, server-only services & tests
│   └── types/
│       └── database.ts       # Explicit PostgreSQL table, enum, and RPC TypeScript definitions
```

---

## Local Setup

1. **Prerequisites**
   - Node.js `>= 20` (tested on Node `v24.14.1`) and `npm` `>= 10`
   - A Supabase project (cloud or local via `supabase start`)

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
   - `.env` and `.env.*` (except `.env.example`) are git-ignored.
   - Server secrets (`SUPABASE_SERVICE_ROLE_KEY`) are isolated inside `src/lib/env/server.ts` with `import "server-only"` and must never be prefixed with `NEXT_PUBLIC_` or imported into client components.

4. **Start the development server**
   ```bash
   npm run dev
   ```

---

## Quality & Test Commands

Run these checks locally and in CI before merging:

| Command                | Purpose                                                                     |
| :--------------------- | :-------------------------------------------------------------------------- |
| `npm run typecheck`    | Runs TypeScript (`tsc --noEmit`) in strict mode                             |
| `npm run lint`         | Runs ESLint across `src/`                                                   |
| `npm run format:check` | Verifies code formatting with Prettier                                      |
| `npm run format`       | Formats code with Prettier                                                  |
| `npm test`             | Runs unit & authorization boundary tests via Vitest                         |
| `npm run build`        | Builds the Next.js production bundle (does **not** run database migrations) |

---

## Database Migrations

All database schema and Row-Level Security (RLS) changes live as versioned SQL files under `supabase/migrations/`.

- **Never auto-apply migrations during a normal application build or production deploy.**
- **Do not use subqueries inside `CHECK` constraints.** Use composite foreign keys, unique indexes, triggers, or transactional server logic.
- **Local / Staging application:**
  ```bash
  # Using Supabase CLI against local or linked staging database:
  supabase db push
  ```

---

## Staging & Production Deployment

1. **Staging Verification**
   - Apply pending migrations in `supabase/migrations/` to the **staging** database first and verify RLS policies and constraints.
   - Run `npm run typecheck && npm run lint && npm run format:check && npm test` in CI.
   - Deploy the Next.js build to the staging environment and verify multi-org tenant isolation, approval flows, and role boundaries (`admin`, `manager`, `field_employee`).

2. **Production Deployment**
   - Apply reviewed migrations to the production database during a controlled migration step **before** releasing application code that depends on new columns/tables.
   - Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the hosting platform's encrypted environment settings.
   - Deploy the Next.js build (`npm run build && npm run start`).
