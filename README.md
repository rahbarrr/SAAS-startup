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
- **Local database changes:** For local development, start the local Supabase stack and apply migrations against that local database only. Never run a generic migration push against a cloud project without verifying the linked project reference.
- **Production database changes:** Use the reviewed, manually triggered production database release workflow. Confirm the target project, backup reference, and forward-fix/rollback plan before approving an apply step.

---

## Production Deployment

1. **Automated quality gates**
   - Require the GitHub CI workflow to pass: formatting, lint, typecheck, migration safety lint, unit tests, integration tests, dependency audit, and production build.
2. **Application deployment**
   - Vercel deploys the application from the configured Git branch. Verify the deployment commit and health endpoint before calling a release successful.
3. **Database release**
   - Never apply migrations during a normal application build. Use the manual `Production database release` workflow after reviewing the migration diff and taking a verified pre-release backup.
   - Configure production environment variables only in Vercel Production. Keep service-role keys server-only.

---

## Accessibility, UX Resilience, & In-App Notifications

### 1. Accessibility (WCAG 2.1 AA) & Narrow Mobile Support

- **Semantic Structure & Labels**: Every page defines a single `<h1>` heading with nested `<section aria-labelledby="...">` and `<h2>`/`<h3>` landmarks. All form controls have explicit `<label htmlFor="...">` bindings or `aria-label` attributes.
- **Keyboard & Focus Visibility**: `.skip-link` jumps directly to `#main-content`; `:focus-visible` renders a `3px solid #1d4ed8` outline; all interactive buttons and links enforce `--touch-target-min: 2.75rem` (`44px`).
- **Status Announcements & Contrast**: `StatusBadge` pairs color tokens (`>= 4.5:1` contrast) with distinct symbols (`✓`, `⏳`, `↺`, `✕`, `▶`, `✦`) and optional `role="status" aria-live="polite"`. Error states use `role="alert" aria-atomic="true"`.
- **Narrow Mobile Widths (`320px–480px`) & Long Names**: `.card-grid` uses `minmax(min(100%, 17rem), 1fr)` to prevent horizontal overflow at `320px`, while `.break-long-words` and `truncateDisplayLabel()` handle 120-character store/trip names without breaking layouts while preserving full text in `title`.

### 2. Timezone, Date-Only vs. Timestamp Rules, & Network Resilience

- **Date-Only (`YYYY-MM-DD`) vs. Server Timestamps (`timestamptz`)**:
  - Trip `start_date` and `end_date` are calendar dates evaluated in UTC and formatted via `formatCalendarDateOnlyUtc()` without passing through local browser timezone offsets (preventing off-by-one day shifts in negative UTC offsets).
  - Visit `checked_in_at`, `checked_out_at`, `submitted_at`, and `decided_at` are server-recorded `timestamptz` values formatted via `formatUtcTimestamp()` (`YYYY-MM-DD HH:mm UTC`).
- **Double-Click, Slow-Network, & Expired-Session Handling**:
  - Client actions use `createInFlightActionGuard()` and disabled button states (`disabled` + `.btn:disabled`) alongside server/database idempotency keys (`check_in_idempotency_key`, `check_out_idempotency_key`, `ON CONFLICT DO NOTHING`) to prevent duplicate records on rapid double-taps or network retries.
  - `classifyRequestFailure()` distinguishes expired sessions (`401` $\rightarrow$ prompts re-authentication at `/login`), slow networks/timeouts (`504`/`AbortError` $\rightarrow$ exposes a safe `Try Again` action), and concurrent state conflicts (`409`).

### 3. Event-Derived In-App Notifications & Why No Job Queue Is Used

- In-app notifications (`/notifications` and `/api/orgs/[orgId]/notifications`) are derived deterministically from committed `public.trip_audit_events` rows (`trip_submitted`, `trip_resubmitted`, `trip_approved`, `trip_changes_requested`, `trip_rejected`) and per-user read receipts in `public.in_app_notification_reads`.
- Because notifications are keyed by `audit_event_id` and read receipts use `ON CONFLICT (organization_id, audit_event_id, user_id) DO NOTHING`, retries never create duplicate notifications.
- Email, SMS, and push providers are **not** configured; the UI explicitly discloses that delivery is **in-app only**. No background job queue or in-process timer (`setImmediate`/`setTimeout`) is introduced because all current MVP workflows execute synchronously within PostgreSQL transactions or bounded request lifecycles.

### 4. Remaining UX Issues & Post-MVP Backlog

1. **Offline IndexedDB Queueing for Rural Stores**: While status badges and idempotency keys support retrying failed check-ins/check-outs over spotty mobile connections, full offline-first queuing (caching checklist edits in IndexedDB when completely disconnected and syncing in background when connectivity returns) is deferred to post-MVP.
2. **External Notification Delivery (Email / Web Push)**: When an transactional email or push provider is added in a future phase, outbound delivery should be dispatched via a durable provider-backed queue (with dead-letter visibility and per-event idempotency keys) rather than synchronous request handlers.
3. **Interactive Map Preview for Store Coordinates**: Store coordinates and point-in-time check-in/out records are currently displayed as accessible tabular text with explicit unverified-location disclosures rather than an embedded map tile widget.

## Operations & Architecture Documentation

- **Backup, Restore & Incident Response Runbook:** [docs/operations-runbook.md](docs/operations-runbook.md) (draft procedures, recovery checklists, and incident response).
- **Release Process & Deployment Checklist:** [docs/release-process.md](docs/release-process.md) (CI gates, reviewed production migrations, kill switches, and rollback protocol).
- **Mobile Architecture Decision Memo:** [docs/mobile-architecture-decision-memo.md](docs/mobile-architecture-decision-memo.md) (evaluation of Responsive Web/PWA vs. Expo React Native, offline store visit requirements, and native blueprint).
- **Billing & Subscription Architecture Specification:** [docs/billing-architecture-specification.md](docs/billing-architecture-specification.md) (pre-implementation plan matrix, entitlement limits, trial lifecycle, failed payment dunning, and webhook idempotency).
