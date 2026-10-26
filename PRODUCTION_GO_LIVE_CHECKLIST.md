# FieldTrack — Production Go-Live & Pilot Readiness Checklist

This document is the definitive checklist for taking FieldTrack from local development to a live, controlled retail pilot. Every item is categorized with an exact operational status:

- :white_check_mark: **`VERIFIED AUTOMATICALLY`** — Proven correct by automated suites (migrations, typecheck, lint, unit tests, integration tests, Next.js build).
- :eye: **`VERIFIED MANUALLY`** — Verified via code inspection, policy review, and architectural validation.
- :warning: **`ACTION REQUIRED`** — Specific human configuration step required in the live Supabase / Vercel cloud environment.
- :no_entry_sign: **`BLOCKED`** — Dependent on an upstream action before it can be completed.

---

## 1. Supabase Database & Security Verification

| Item                                      | Status                   | Verification Detail / Exact Next Action                                                                                                                                                                                                                                                                                                                                               |
| :---------------------------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Migration Lint & Sequential Order**     | `VERIFIED AUTOMATICALLY` | All 14 migrations pass `scripts/migration-lint.mjs` with 0 errors and 0 warnings.                                                                                                                                                                                                                                                                                                     |
| **Database Schema Deployment**            | `ACTION REQUIRED`        | **Action:** Apply migrations to your hosted Supabase production database using Supabase CLI: `supabase db push`.                                                                                                                                                                                                                                                                      |
| **Row-Level Security (RLS)**              | `VERIFIED AUTOMATICALLY` | Enabled and forced across all 14 public tables (`organizations`, `organization_members`, `organization_invitations`, `stores`, `trips`, `trip_stops`, `visits`, `visit_checklist_items`, `visit_evidence`, `trip_audit_events`, `organization_audit_events`, `trip_location_breadcrumbs`, `visit_ai_report_drafts`, `in_app_notification_reads`). Verified in `database-rls.test.ts`. |
| **Workflow State Machine Triggers**       | `VERIFIED AUTOMATICALLY` | `trg_trips_workflow_and_decisions` prevents self-approval, enforces forward status transitions. Verified in lifecycle tests.                                                                                                                                                                                                                                                          |
| **Visit Invariant Triggers**              | `VERIFIED AUTOMATICALLY` | `trg_visits_lifecycle_invariants` prevents non-owner edits, blocks checkout with unfinished required checklists, and forbids self-review [SEC-002].                                                                                                                                                                                                                                   |
| **Audit Log Immutability**                | `VERIFIED AUTOMATICALLY` | Triggers block `UPDATE` and `DELETE` on `organization_audit_events` and `trip_audit_events` (code `42501`).                                                                                                                                                                                                                                                                           |
| **Canonical Storage Bucket**              | `VERIFIED AUTOMATICALLY` | Canonical bucket name is `visit-evidence` with `public = false`, 25 MiB cap, and restricted MIME types. Tested in `phase9-storage-security.test.ts`.                                                                                                                                                                                                                                  |
| **Storage Security Policies**             | `VERIFIED AUTOMATICALLY` | `visit_evidence_storage_insert` and `visit_evidence_storage_select` enforce active membership and role checks. Direct `UPDATE` and `DELETE` on `storage.objects` are rejected.                                                                                                                                                                                                        |
| **Unused Bucket (`fieldtrack-evidence`)** | `ACTION REQUIRED`        | **Action:** Check object count in Supabase Dashboard. If 0 objects, delete `fieldtrack-evidence` to prevent operator confusion.                                                                                                                                                                                                                                                       |

---

## 2. Environment Variables Configuration (Vercel / Hosting)

Configure these in your Vercel Project Settings (&rarr; **Settings** &rarr; **Environment Variables**):

| Environment Variable            | Classification | Scope                     | Status              | Verification Procedure & Exact Action                                                                                                                                           |
| :------------------------------ | :------------- | :------------------------ | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Required       | Public (Browser & Server) | `ACTION REQUIRED`   | **Action:** Paste hosted project URL (`https://xyz.supabase.co`).<br>**Verify:** `curl -I $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` returns 401/200.                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required       | Public (Browser & Server) | `ACTION REQUIRED`   | **Action:** Paste public anon key from Supabase Dashboard (&rarr; Settings &rarr; API).<br>**Verify:** Key starts with `eyJ...` and is safe for browser bundles.                |
| `NEXT_PUBLIC_APP_URL`           | Required       | Public (Browser & Server) | `ACTION REQUIRED`   | **Action:** Set canonical application URL (e.g. `https://app.fieldtrack.example.com`).<br>**Verify:** Matches deployment domain exactly (no trailing slash).                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Required       | **Server-Only Secret**    | `ACTION REQUIRED`   | **Action:** Paste service-role secret. Never prefix with `NEXT_PUBLIC_`.<br>**Verify:** Protected behind `import "server-only"` in `src/lib/env/server.ts`.                     |
| `CRON_SECRET`                   | Required       | **Server-Only Secret**    | `ACTION REQUIRED`   | **Action:** Generate random 64-char hex string: `openssl rand -hex 32` and save in Vercel.<br>**Verify:** Send test request to `/api/orgs/[orgId]/digest` with `x-cron-secret`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | Required       | Public (Browser & Server) | `ACTION REQUIRED`   | **Action:** Generate keys: `npx web-push generate-vapid-keys`. Paste public key.<br>**Verify:** String of ~87 characters.                                                       |
| `VAPID_PRIVATE_KEY`             | Required       | **Server-Only Secret**    | `ACTION REQUIRED`   | **Action:** Paste private key from previous step into Vercel.<br>**Verify:** Never exposed to browser.                                                                          |
| `VAPID_SUBJECT`                 | Required       | **Server-Only Secret**    | `ACTION REQUIRED`   | **Action:** Set contact mailto (e.g. `mailto:support@fieldtrack.example.com`).                                                                                                  |
| `APP_ENV`                       | Required       | **Server-Only**           | `ACTION REQUIRED`   | **Action:** Set to `production`.                                                                                                                                                |
| `EXPECTED_SUPABASE_PROJECT_REF` | Required       | **Server-Only**           | `ACTION REQUIRED`   | **Action:** Set to subdomain of `NEXT_PUBLIC_SUPABASE_URL` to prevent mispointing.                                                                                              |
| `ROUTING_PROVIDER`              | Optional       | Server-Only               | `VERIFIED MANUALLY` | **Status:** Defaults to straight-line Haversine geodesic if omitted. Set to `osrm` for driving routes.                                                                          |
| `OPENAI_API_KEY`                | Optional       | Server-Only Secret        | `VERIFIED MANUALLY` | **Status:** Deterministic heuristic engine runs automatically if omitted. Set key to enable GPT insights.                                                                       |
| `OPENAI_REPORT_MODEL`           | Optional       | Server-Only               | `VERIFIED MANUALLY` | Set to `gpt-4o-mini` if `OPENAI_API_KEY` is provided.                                                                                                                           |
| `RESEND_API_KEY`                | Optional       | Server-Only Secret        | `VERIFIED MANUALLY` | Set if sending daily manager email digests; falls back to structured application logs if omitted.                                                                               |

---

## 3. Supabase Authentication Dashboard Configuration

| Setting                 | Status            | Action Required                                                                                                                                                                                                                                     |
| :---------------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site URL**            | `ACTION REQUIRED` | Open **Supabase Dashboard** &rarr; **Authentication** &rarr; **URL Configuration**.<br>Set **Site URL** to `https://app.fieldtrack.example.com`.                                                                                                    |
| **Redirect URLs**       | `ACTION REQUIRED` | Add the following exact callback URLs (do not use wildcards `*`):<br>- `https://app.fieldtrack.example.com/auth/callback`<br>- `https://app.fieldtrack.example.com/reset-password`<br>- `https://app.fieldtrack.example.com/api/invitations/accept` |
| **Email Auth Settings** | `ACTION REQUIRED` | Verify **Enable Email provider** is turned ON.<br>Confirm **Confirm email** matches your pilot policy (can be disabled for invited team members).                                                                                                   |

---

## 4. Deployed Application Verification (Manual Walkthrough Matrix)

| Test Flow                       | Automated Status         | Live Manual Verification Procedure                                                                                                                                                               |
| :------------------------------ | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Login, Logout, Recovery**  | `VERIFIED AUTOMATICALLY` | **Browser Test:** Navigate to `/login`, sign in with test credentials, verify dashboard renders. Click logout, verify redirect to `/login`. Test password reset link.                            |
| **2. Org Workspace & Invites**  | `VERIFIED AUTOMATICALLY` | **Browser Test:** Administrator calls `/api/orgs` to create pilot workspace. Go to `/team`, invite Retail Manager and 2 Reps. Verify invitation emails are received.                             |
| **3. Trip Creation & Approval** | `VERIFIED AUTOMATICALLY` | **Browser Test:** Manager creates trip at `/trips/new` with 3 stops. Submit trip. Manager logs in as different account (or admin) and approves at `/approvals`. Verify self-approval is blocked. |
| **4. Check-In & Check-Out**     | `VERIFIED AUTOMATICALLY` | **Mobile Test:** Field rep opens `/trips`, taps "Check In". Verify GPS permission prompt. Complete required checklist. Tap "Complete Check Out". Verify stop transitions to `visited`.           |
| **5. Private Evidence Upload**  | `VERIFIED AUTOMATICALLY` | **Mobile Test:** Rep uploads store photo via camera. Verify photo uploads to `visit-evidence`. As manager, open `/visits`, view photo via signed URL. Confirm image renders.                     |
| **6. Reports & Audit Trail**    | `VERIFIED AUTOMATICALLY` | **Browser Test:** Manager opens `/reports`, views territory metrics, clicks "Export CSV". Open `/audit`, verify append-only events exist for every state change.                                 |
| **7. Offline Sync Queue**       | `VERIFIED AUTOMATICALLY` | **Physical Device Test:** Rep turns on Airplane Mode. Fill out checklist. Turn Airplane Mode off. Tap "Sync Pending". Verify operations sync to server without error.                            |
| **8. Scheduled Digest Webhook** | `VERIFIED AUTOMATICALLY` | **Terminal Test:** Send curl command to `/api/orgs/[orgId]/digest` with `x-cron-secret: $CRON_SECRET`. Verify HTTP 200 response.                                                                 |
| **9. Cross-Tenant Denial**      | `VERIFIED AUTOMATICALLY` | **API / Browser Test:** User from Organization B attempts to view `/api/orgs/[orgA_Id]/stores`. Verify server returns 404/403.                                                                   |

---

## 5. Controlled Pilot Preparation Status

| Pilot Component                 | Target Setting                                                        | Status                          |
| :------------------------------ | :-------------------------------------------------------------------- | :------------------------------ |
| **Tenant Organization**         | 1 Retail Company (e.g. Apex Retail)                                   | Prepared                        |
| **Management Cohort**           | 1 Retail Territory Manager                                            | Prepared                        |
| **Field Representative Cohort** | 2–3 Field Representatives                                             | Prepared                        |
| **Hardware / OS**               | Android Chrome (v120+) & iOS Safari (16.4+)                           | Supported                       |
| **Pilot Duration**              | Day 0 Dry Run + 14-day field audit period                             | Defined in `PILOT_TEST_PLAN.md` |
| **Safeguards**                  | Point-in-time GPS only; zero background tracking; immutable audit log | Enforced                        |

---

## 6. Summary of Exact Immediate Actions

Before inviting retail managers and field reps to the pilot:

1. [ ] **Step 1:** In Supabase Dashboard, inspect `fieldtrack-evidence`. If empty, delete it. Keep `visit-evidence` as the private bucket.
2. [ ] **Step 2:** Deploy database migrations to Supabase: `supabase db push`.
3. [ ] **Step 3:** Set the 10 required environment variables in your Vercel Project Settings.
4. [ ] **Step 4:** Set **Site URL** and **Redirect URLs** in Supabase Auth settings.
5. [ ] **Step 5:** Perform the 30-minute Day 0 Dry Run with the pilot manager using [PILOT_TEST_PLAN.md](file:///Users/rahbarraza/Downloads/SAAS%20startup/PILOT_TEST_PLAN.md).
