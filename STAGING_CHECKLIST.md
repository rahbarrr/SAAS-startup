# FieldTrack — Staging Deployment Preparation, Execution & Verification Runbook

**Date:** 2026-10-25  
**Version:** 1.0.0 (Pre-Release Staging)  
**Target Environment:** Staging  
**Git Branch:** `main` (commit tracked against `origin/main`)  
**Deployment Platform:** Vercel (preview / staging branch)  
**Database & Auth Platform:** Supabase Cloud (dedicated staging project: `lrolhonkrjhuwgnmcdsj.supabase.co`)

---

## 1. Executive Summary & Staging Readiness Verdict

### Final Staging Readiness Verdict: **READY FOR STAGING (CONDITIONAL ON EXTERNAL HOST / DB ACTIONS)**

The FieldTrack codebase, multi-tenant database migrations, Row-Level Security policies, server-side authorization routines, and client interactive interfaces are **100% verified, compiled, and tested**. All automated quality gates have passed cleanly with zero errors, zero warnings, and zero vulnerabilities.

Because platform deployment credentials (Vercel CLI session and Supabase CLI session) are not authenticated in the local terminal environment, actual cloud deployment cannot be executed automatically without owner credentials. This runbook provides the exact, verified instructions for the repository owner to execute the migration push and Vercel deployment without risk to production.

---

## 2. Pre-Deployment Automated Quality Gates (Verified)

Every pre-flight quality gate was executed locally against the active repository. All gates passed with 100% success:

| Quality Gate              | Command                                   | Result                          | Details                                                                               |
| :------------------------ | :---------------------------------------- | :------------------------------ | :------------------------------------------------------------------------------------ |
| **Code Formatting**       | `npm run format:check`                    | **PASS (0 errors)**             | Prettier checked all `ts`, `tsx`, `css`, `json`, `mjs`, `md` files.                   |
| **Static Analysis**       | `npm run lint`                            | **PASS (0 errors, 0 warnings)** | ESLint 9 validated all TypeScript source files under `src/`.                          |
| **Type Checking**         | `npm run typecheck`                       | **PASS (0 errors)**             | TypeScript 5.8 `tsc --noEmit` verified strict type safety.                            |
| **Migration Safety Lint** | `npm run lint:migrations`                 | **PASS (0 errors, 0 warnings)** | 11 migrations verified for RLS enforcement, safe search paths, and triggers.          |
| **Automated Test Suite**  | `npm test` (`vitest run`)                 | **PASS (130 / 130 passed)**     | 20 test files: unit tests, in-memory PGlite WASM Postgres tests, E2E lifecycle tests. |
| **Production Build**      | `npm run build` (`next build`)            | **PASS (Turbopack)**            | Compiled 20 app routes + `ƒ Proxy (Middleware)` with 0 deprecation warnings.          |
| **Dependency Security**   | `npm audit --omit=dev --audit-level=high` | **PASS (0 vulnerabilities)**    | Patched high-severity CVEs via `zod@4.6.7`.                                           |

---

## 3. Staging Environment Configuration

The following environment variables must be configured in the staging hosting platform (e.g. Vercel Staging/Preview settings). **Never commit or log real credentials or secret keys.**

### Public Environment Variables (Browser & Server)

| Variable Name                   | Required | Staging Value / Specification                            | Description                                              |
| :------------------------------ | :------- | :------------------------------------------------------- | :------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Yes**  | `https://lrolhonkrjhuwgnmcdsj.supabase.co`               | HTTPS URL of dedicated staging Supabase project.         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes**  | Staging Supabase anon key (`eyJ...`)                     | Public client key with limited RLS-governed permissions. |
| `NEXT_PUBLIC_APP_URL`           | **Yes**  | `https://staging.fieldtrack.app` (or Vercel preview URL) | Must begin with `https://` in staging.                   |

### Server-Only Environment Variables (Secrets & Backend Settings)

| Variable Name                   | Required    | Staging Value / Specification            | Security / Behavior Details                                                     |
| :------------------------------ | :---------- | :--------------------------------------- | :------------------------------------------------------------------------------ |
| `APP_ENV`                       | **Yes**     | `staging`                                | Dictates strict security policies (HTTPS required, cross-project protection).   |
| `EXPECTED_SUPABASE_PROJECT_REF` | **Yes**     | `lrolhonkrjhuwgnmcdsj`                   | Must match project ref in `NEXT_PUBLIC_SUPABASE_URL`. Prevents cross-env leaks. |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Yes**     | Staging Service Role secret (`eyJ...`)   | Server-only. Used for migrations, health checks, and test fixtures.             |
| `AI_REPORTS_ENABLED`            | **Yes**     | `true`                                   | Incident kill switch for AI report drafting. Defaults to `true`.                |
| `UPLOADS_ENABLED`               | **Yes**     | `true`                                   | Incident kill switch for photo uploads. Defaults to `true`.                     |
| `OPENAI_API_KEY`                | Optional    | Staging OpenAI API key (`sk-...`)        | Required only for live AI visit report drafting. Scoped with spend cap.         |
| `OPENAI_REPORT_MODEL`           | Conditional | `gpt-4o-mini`                            | Required if `OPENAI_API_KEY` is set.                                            |
| `OPENAI_API_BASE_URL`           | Optional    | `https://api.openai.com/v1`              | Custom endpoint or mock endpoint if desired (defaults to standard endpoint).    |
| `OPENAI_REQUEST_TIMEOUT_MS`     | Optional    | `15000` (15s)                            | Upstream HTTP request timeout in milliseconds (1000 - 60000ms).                 |
| `OPENAI_MAX_OUTPUT_TOKENS`      | Optional    | `1200`                                   | Max output token cap for visit report drafting (128 - 4096 tokens).             |
| `VERCEL_ENV`                    | Automatic   | Set by Vercel (`preview` / `production`) | Validated to prevent production credentials running in preview deployments.     |
| `SENTRY_DSN`                    | Optional    | Sentry Project DSN                       | Error telemetry for server and client crashes.                                  |

---

## 4. Database Migrations Status & Review

The FieldTrack schema relies on 11 chronological PostgreSQL migrations. All migrations are strictly additive, idempotently checked, and enforced with PostgreSQL Row-Level Security.

### 4.1 Migration Inventory & Architectural Impact

1. **`20261022000001_init_orgs_and_memberships.sql`**:
   - Creates `organizations` and `organization_memberships` tables.
   - Defines `org_role` (`admin`, `manager`, `field_rep`) and `membership_status` (`active`, `suspended`, `invited`).
   - Implements helper functions `is_active_org_member(org_id)` and `has_active_org_role(org_id, roles)`.
   - Enables and forces RLS on all membership records.
2. **`20261022000002_field_operations_schema.sql`**:
   - Creates core domain tables: `stores`, `trips`, `trip_stops`, `visits`, `visit_evidence`, `trip_audit_events`.
   - Defines enums: `trip_status` (`draft`, `submitted`, `approved`, `rejected`, `cancelled`, `completed`) and `visit_status` (`in_progress`, `submitted`, `reviewed`).
   - Enforces foreign keys and cascades scoped strictly to `org_id`.
3. **`20261022000003_auth_invitations_and_onboarding.sql`**:
   - Implements `organization_invitations` table with single-use SHA-256 hashed tokens and expiration dates.
   - Provides transactional atomic functions: `create_organization_with_admin` and `accept_invitation`.
4. **`20261022000004_transactional_trips_and_stores_rpcs.sql`**:
   - Provides atomic RPC `create_trip_with_stops` ensuring trips and stops are inserted in a single transaction.
   - Enforces sequence ordering on trip stops.
5. **`20261022000005_approval_inbox_and_atomic_decisions.sql`**:
   - Implements atomic RPC `decide_submitted_trip`.
   - Database trigger `trg_prevent_trip_self_approval` prevents managers from approving their own submitted trips.
   - Records immutable entries in `trip_audit_events`.
6. **`20261022000006_visit_execution_and_evidence.sql`**:
   - Implements `check_in_visit` and `check_out_visit` transactional RPCs.
   - Enforces checklist completion and validates location coordinates before checkout.
   - Configures storage access policies for `visit_evidence`.
7. **`20261022000007_trip_completion_and_reporting_indexes.sql`**:
   - Creates composite indexes for dashboard analytics and store visit queries.
   - Adds auto-completion triggers when all stops for an approved trip have checked out.
8. **`20261022000008_ai_visit_report_drafts.sql`**:
   - Implements `visit_ai_report_drafts` table.
   - Enforces per-organization daily draft quota (`ai_daily_draft_quota`).
   - Mandates human review flag (`requires_human_review = true`) on all generated drafts.
9. **`20261022000009_in_app_notifications_and_read_receipts.sql`**:
   - Creates `in_app_notifications` table.
   - Implements `mark_in_app_notification_read` atomic RPC.
   - Dispatches notifications on trip approvals, rejections, and assignments.
10. **`20261022000010_security_hardening_rls_and_triggers.sql`**:
    - Executes `ALTER TABLE ... FORCE ROW LEVEL SECURITY` across all public tables.
    - Locks `search_path = public, pg_temp` on all `SECURITY DEFINER` functions to prevent search path hijacking.
11. **`20261022000011_rate_limits.sql`**:
    - Implements Postgres token-bucket rate limiter via `rate_limit_buckets` table.
    - Atomic RPC `consume_rate_limit(scope, identifier, max_tokens, window_seconds)` protects auth and AI endpoints.

### 4.2 Applying Migrations to the Staging Project

> [!IMPORTANT]
> Never apply migrations directly to production. Ensure you are targeting the staging project ref (`lrolhonkrjhuwgnmcdsj`).

#### Option A: Via Supabase CLI (Recommended)

```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link to dedicated staging project
npx supabase link --project-ref lrolhonkrjhuwgnmcdsj

# 3. Dry-run to review pending migrations
npx supabase db push --dry-run

# 4. Push migrations to staging database
npx supabase db push
```

#### Option B: Via GitHub Actions Workflow (`staging-db.yml`)

1. Ensure the following repository environment secrets/variables are set under the **`staging`** environment on GitHub:
   - Secret `STAGING_SUPABASE_ACCESS_TOKEN`
   - Secret `STAGING_SUPABASE_DB_PASSWORD`
   - Variable `STAGING_SUPABASE_PROJECT_REF`: `lrolhonkrjhuwgnmcdsj`
2. Navigate to **Actions** -> **Staging database migrations** -> **Run workflow** -> Select `main` branch.

### 4.3 Post-Migration Schema & RLS Verification

After applying migrations, execute `supabase/verification/post-release.sql` in the Supabase SQL Editor.
The script asserts:

1. Every public table has `relrowsecurity` and `relforcerowsecurity` enabled.
2. All 4 core security functions exist (`is_active_org_member`, `has_active_org_role`, `consume_rate_limit`, `decide_submitted_trip`).
3. Audit log immutability trigger `trg_trip_audit_events_invariants` is active.
4. `rate_limit_buckets` has no direct public RLS policies.
   Output must return: `'post-release verification passed'`.

---

## 5. Supabase Staging Project Configuration

Before testing the staging application, complete these 3 configurations in the Supabase Dashboard:

### 5.1 Storage Bucket Provisioning

1. Navigate to **Storage** -> **New Bucket**.
2. Name: `visit-evidence`.
3. Public bucket: **Disabled** (Private bucket).
4. Maximum file size: **25 MB** (`26214400` bytes).
5. Allowed MIME types: `image/jpeg, image/png, image/webp, application/pdf`.

### 5.2 Authentication & Redirect URLs

1. Navigate to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your staging application URL (e.g. `https://staging.fieldtrack.app` or assigned Vercel preview domain).
3. Under **Redirect URLs**, add:
   - `https://staging.fieldtrack.app/auth/callback`
   - `https://*.vercel.app/auth/callback` (for branch preview deployments)
   - `http://localhost:3000/auth/callback` (for local development)

### 5.3 Email Confirmation Settings

1. Navigate to **Authentication** -> **Providers** -> **Email**.
2. For Staging QA / Automated Testing:
   - Toggle **Enable Email Autoconfirm** to `ON`.
   - _Rationale:_ Allows test accounts and QA personnel to log in immediately upon registration without accessing external temporary inboxes. (In production, autoconfirm must remain `OFF` with custom SMTP enabled).

---

## 6. Hosting Platform Deployment (Vercel)

The project is built on Next.js 16 with Turbopack and is structured for zero-configuration Vercel deployment.

### 6.1 Deploying via Vercel CLI

```bash
# 1. Login to Vercel
npx vercel login

# 2. Link repository to Vercel project
npx vercel link

# 3. Add staging environment variables
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
npx vercel env add NEXT_PUBLIC_APP_URL preview
npx vercel env add APP_ENV preview
npx vercel env add EXPECTED_SUPABASE_PROJECT_REF preview
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
npx vercel env add AI_REPORTS_ENABLED preview
npx vercel env add UPLOADS_ENABLED preview

# 4. Deploy preview build from main branch
npx vercel --build-env APP_ENV=staging
```

### 6.2 Deploying via GitHub Integration (Continuous Deployment)

1. In Vercel Dashboard, import repository `https://github.com/rahbarrr/SAAS-startup`.
2. Under **Environment Variables**, select **Preview** and **Development** targets and configure the staging variables from Section 3.
3. Every push to `main` (or a release branch) automatically builds and deploys a preview environment with a unique HTTPS URL.

---

## 7. Staging URL Acceptance Smoke Tests

Once deployed, execute this 17-point end-to-end verification checklist against the deployed staging URL:

| Test ID   | Area                    | Action / Test Description                                                                 | Expected Result                                                                          |
| :-------- | :---------------------- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **ST-01** | **HTTPS & Security**    | Access staging URL over HTTPS. Inspect SSL cert and headers.                              | Valid TLS cert, HSTS active, no mixed content warnings.                                  |
| **ST-02** | **User Registration**   | Register new account at `/signup` with test email and password.                           | Account created, redirected to `/onboarding`.                                            |
| **ST-03** | **Auth Sessions**       | Log out, log back in at `/login`, refresh page.                                           | Session cookie persists, user remains authenticated.                                     |
| **ST-04** | **Password Recovery**   | Request reset link at `/forgot-password`, follow link to `/reset-password`.               | Password successfully updated.                                                           |
| **ST-05** | **Org Onboarding**      | Complete onboarding at `/onboarding` creating "Staging Retail Ops".                       | Org created in database, user assigned `admin` role, redirected to `/`.                  |
| **ST-06** | **Store Management**    | Create store "Metro Supermarket" at `/stores` with lat/lng.                               | Store persisted, appears in `/stores` directory and `/stores/[storeId]`.                 |
| **ST-07** | **Trip Planning**       | Plan draft trip at `/trips/new` with 2 store stops.                                       | Trip created in `draft` state with sequential stop numbers.                              |
| **ST-08** | **Trip Submission**     | Submit trip from `/trips/[tripId]`.                                                       | Status transitions to `submitted`. Form locked from employee edits.                      |
| **ST-09** | **Self-Approval Block** | Attempt to approve own trip as creator.                                                   | UI disables button / displays warning; backend RPC rejects action.                       |
| **ST-10** | **Peer Approval**       | Log in as peer manager; review trip at `/approvals`; approve with note.                   | Status transitions to `approved`. Audit log entry written to `trip_audit_events`.        |
| **ST-11** | **Store Check-in**      | Trip owner navigates to approved stop; clicks "Check In".                                 | Check-in recorded with UTC timestamp and GPS coordinates; active visit opened.           |
| **ST-12** | **Visit Execution**     | At `/visits/[visitId]`, complete checklist questions and upload photo evidence.           | Checklist answers saved; photo uploaded to `visit-evidence` via signed ticket.           |
| **ST-13** | **Visit Checkout**      | Complete required items and click "Check Out".                                            | Validation verifies checklist; visit status transitions to `submitted`.                  |
| **ST-14** | **Dashboard & CSV**     | Navigate to `/`; view Planned vs. Actual metrics; click "Export CSV".                     | Metrics reflect submitted visit; CSV streams with formula escaping (`=`, `+`, `-`, `@`). |
| **ST-15** | **AI Visit Report**     | In `/visits/[visitId]`, request AI report draft (if enabled).                             | Quota checked; draft generated and clearly marked _"requires human review"_.             |
| **ST-16** | **Tenant Isolation**    | Log in with second test account in different org; attempt to fetch Org A trip ID via API. | Server returns `404 Not Found` with zero metadata leakage.                               |
| **ST-17** | **Observability**       | Inspect server runtime logs.                                                              | Structured JSON logs; tokens, passwords, and sensitive keys are fully redacted.          |

---

## 8. Rollback Runbook & Incident Response

In the event of an issue on the staging deployment:

### 8.1 Application Rollback (Immediate)

- **Vercel Dashboard:** Navigate to Project -> **Deployments** -> Locate previous known-good deployment -> Click **Promote to Production** or rollback alias.
- **Rollback Time:** < 60 seconds.

### 8.2 Incident Kill Switches (No Code Deployment Required)

- **Disable AI Report Generation:** Update environment variable `AI_REPORTS_ENABLED="false"` in hosting dashboard and trigger instant redeploy. Application falls back to standard manual visit reporting.
- **Disable Evidence Uploads:** Update environment variable `UPLOADS_ENABLED="false"` and redeploy. All signed ticket creation and file confirmations are rejected with a user-friendly maintenance message.

### 8.3 Database Schema Recovery

- Never run ad-hoc destructive SQL commands (`DROP TABLE`, `TRUNCATE`).
- All migrations in this repository are designed to be strictly backward-compatible. In case of a defect, issue a new forward-fix migration (`20261022000012_...sql`).
- If data corruption occurs in staging, restore database from the latest Supabase daily backup into a new staging project ref.

---

## 9. Next Actions for Repository Owner

To complete the staging release:

1. [ ] **Push Migrations:** Run `npx supabase db push` to apply migrations `000001` through `000011` to Supabase staging project `lrolhonkrjhuwgnmcdsj`.
2. [ ] **Create Storage Bucket:** In Supabase dashboard, create private bucket `visit-evidence` (max 25MB).
3. [ ] **Enable Auth Autoconfirm:** In Supabase Auth -> Providers -> Email, enable "Enable Email Autoconfirm".
4. [ ] **Deploy Vercel:** Link repository to Vercel and set the environment variables listed in Section 3.
5. [ ] **Execute Smoke Tests:** Follow Section 7 to verify end-to-end functionality.
