# FieldTrack — Feature Inventory (Phase 0 Baseline)

**Date:** 2026-10-25
**Branch / commit:** `main` @ `49e29dd` (in sync with `origin/main`, working tree clean before this phase)
**Method:** Repository read + local command execution only. No live Supabase, Vercel, or OpenAI call was made.

## Classification key

| Label                        | Meaning                                                                                                                                         |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **COMPLETE AND VERIFIED**    | Implemented and covered by a passing automated test that exercises the real logic (not just a mock of it). "Verified" always means **locally**. |
| **PARTIAL**                  | Implemented but with a gap in wiring, coverage, or behavior.                                                                                    |
| **MISSING**                  | Not present in code.                                                                                                                            |
| **BLOCKED BY CONFIGURATION** | Code exists but cannot work or be tested until an external setting is made.                                                                     |
| **NEEDS SECURITY REVIEW**    | Security-relevant and not adequately verified by the existing tests.                                                                            |

## Verification fidelity: what "local" means here

- Integration tests run migrations in **PGlite (in-process WASM Postgres)**. They create a stub `auth` schema and a stub `auth.uid()` reading `request.jwt.claim.sub`, then `set local role authenticated`. Table-level RLS, triggers and RPCs are therefore exercised for real.
- There is **no `storage` schema** in these tests. The bucket + `storage.objects` policy block in migration `…000002` (and its tighter replacement in `…000010`) is guarded by `if exists (storage.buckets)` and is therefore **skipped entirely under PGlite**. Signed upload/download URLs in `visits-and-evidence.test.ts` are **hand-written fakes** (`https://storage.local/...`).
- Supabase Auth (email confirmation, redirects, sessions, `handle_auth_user_created` on real `auth.users`) and the OpenAI provider are not exercised against real services.

## 1. Pages (21)

| Route                                                             | File                              | Classification                | Evidence / note                                                                                                                                                                                   |
| :---------------------------------------------------------------- | :-------------------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/` dashboard                                                     | `src/app/page.tsx`                | COMPLETE AND VERIFIED (local) | Operational metrics, tripsByStatus, field rep attribution, zeroed fallback, role scope notices, ErrorState rendering, pagination, CSV export, and 9 passing tests in `dashboard-and-csv.test.ts`. |
| `/login`, `/signup`, `/forgot-password`                           | `src/app/*/page.tsx`              | BLOCKED BY CONFIGURATION      | Server actions tested with a fake auth provider only. Real flow needs Supabase Auth + redirect URLs + confirmation setting.                                                                       |
| `/reset-password`                                                 | `src/app/reset-password/page.tsx` | BLOCKED BY CONFIGURATION      | Same; depends on live recovery email + callback.                                                                                                                                                  |
| `/auth/callback`                                                  | `src/app/auth/callback/route.ts`  | NEEDS SECURITY REVIEW         | Open-redirect guard unit-tested (`security-regressions`); code-exchange not tested live.                                                                                                          |
| `/onboarding`                                                     | `src/app/onboarding/page.tsx`     | COMPLETE AND VERIFIED (local) | `create_organization_with_owner` and invitation accept covered in `auth.test.ts`, `database-rls.test.ts`, E2E.                                                                                    |
| `/stores`, `/stores/[storeId]`                                    | `src/app/stores/**`               | COMPLETE AND VERIFIED (local) | Client wired via `fetch` to API; service/RLS tests; validation of active stores.                                                                                                                  |
| `/trips`, `/trips/new`, `/trips/[tripId]`, `/trips/[tripId]/edit` | `src/app/trips/**`                | COMPLETE AND VERIFIED (local) | Lifecycle in E2E + `stores-and-trips`; edit gating by owner & status; UI state logic in `ui-workflows.test.ts`.                                                                                   |
| `/approvals`                                                      | `src/app/approvals/page.tsx`      | COMPLETE AND VERIFIED (local) | `decide_submitted_trip`, self-approval block tested in E2E, RLS, service, and UI (`ApprovalsInboxClient`).                                                                                        |
| `/visits`, `/visits/[visitId]`                                    | `src/app/visits/**`               | COMPLETE AND VERIFIED (local) | Check-in/out RPCs, consent-driven geolocation, checklist persistence, evidence ticket/confirm/download redirect.                                                                                  |
| `/team`                                                           | `src/app/team/page.tsx`           | COMPLETE AND VERIFIED (local) | `team-directory.test.ts`.                                                                                                                                                                         |
| `/notifications`                                                  | `src/app/notifications/page.tsx`  | COMPLETE AND VERIFIED (local) | Read-receipt RPC tested. Note: notifications are **derived from `trip_audit_events`**, not inserted by triggers.                                                                                  |
| `error`, `loading`, `not-found`, `layout`, `manifest`             | `src/app/*`                       | COMPLETE AND VERIFIED (local) | Manifest has a test; others build-verified only.                                                                                                                                                  |

## 2. API routes (21)

All under `src/app/api/`. Every handler uses `getAuthenticatedUser` + `createUserServerSupabaseClient` (user-scoped client; **the service-role key is never used by app code**).

| Route                                                            | Methods        | Classification                                                          |
| :--------------------------------------------------------------- | :------------- | :---------------------------------------------------------------------- |
| `invitations/accept`                                             | POST           | COMPLETE AND VERIFIED (local)                                           |
| `orgs`, `orgs/switch`                                            | GET/POST       | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/members`, `invitations`                            | GET/POST       | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/stores`, `stores/[storeId]`                        | GET/POST/PATCH | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/trips`, `trips/[tripId]`, `…/submit`, `…/decision` | GET/POST/PATCH | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/approvals`                                         | GET            | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/visits`, `visits/[visitId]`, `…/checkout`          | GET/POST/PATCH | COMPLETE AND VERIFIED (local)                                           |
| `orgs/[orgId]/visits/[visitId]/evidence`                         | GET/POST       | COMPLETE AND VERIFIED (local) (signed ticket, path check, 307 redirect) |
| `orgs/[orgId]/visits/[visitId]/ai-report`                        | GET/POST/PATCH | COMPLETE AND VERIFIED (local) (human-review, injection defense, quota)  |
| `orgs/[orgId]/dashboard`, `dashboard/export`                     | GET            | COMPLETE AND VERIFIED (local) (CSV formula escaping tested)             |
| `orgs/[orgId]/notifications`                                     | GET/POST       | COMPLETE AND VERIFIED (local)                                           |

## 3. Database (12 migrations, 14+ tables)

Migrations `…000001`–`…000012` (lint: 0 errors/0 warnings). Tables: `profiles`, `organizations`, `organization_members` (renamed from `organization_memberships` in `…000002`), `organization_invitations`, `stores`, `trips`, `trip_stops`, `visits`, `visit_checklist_items`, `visit_evidence`, `trip_audit_events`, `visit_ai_report_drafts`, `in_app_notification_reads`, `rate_limit_buckets`. Migration 12 revokes anon table/sequence access and trigger function execute permissions.

Enums (actual): `org_role` = `admin | manager | field_employee`; `membership_status` = `invited | active | deactivated`; `trip_status` = `draft | submitted | approved | changes_requested | rejected | in_progress | completed`; `visit_status` = `in_progress | submitted | reviewed`.

Key functions/triggers (actual names): `is_active_org_member`, `has_active_org_role`, `create_organization_with_owner`, `accept_organization_invitation(p_token_hash)`, `decide_submitted_trip`, `check_in_trip_stop`, `check_out_visit`, `mark_in_app_notification_read`, `consume_rate_limit`, `can_employee_edit_visit`, `can_read_visit_evidence_storage`; triggers `trg_trips_workflow_and_decision` (self-approval ban), `trg_trip_audit_events_invariants`, `trg_visits_lifecycle_invariants`, `trg_trip_stops_mutation_guard`, `trg_profiles_immutable_identity`, `trg_visit_ai_report_drafts_invariants`, `trg_in_app_notification_reads_invariants`, `trg_on_auth_user_created`.

| Area                                                                 | Classification                | Evidence                                                                                    |
| :------------------------------------------------------------------- | :---------------------------- | :------------------------------------------------------------------------------------------ |
| Tenant isolation / table RLS (all tables `force row level security`) | COMPLETE AND VERIFIED (local) | `database-rls.test.ts` (19), `tenancy.test.ts` (22), E2E cross-tenant test                  |
| Self-approval prevention                                             | COMPLETE AND VERIFIED (local) | Trigger + RPC + service + UI; message appears in migrations 2, 4, 5                         |
| Audit-log immutability                                               | COMPLETE AND VERIFIED (local) | trigger + test                                                                              |
| Rate-limit RPC                                                       | COMPLETE AND VERIFIED (local) | `rate-limit.test.ts`; scope allow-listed; fixed-window counter (`window_start`/`hit_count`) |
| `storage.buckets` insert + `storage.objects` policies                | **NEEDS SECURITY REVIEW**     | Skipped under PGlite; never executed by any test. Behavior on real Supabase is unverified.  |
| `handle_auth_user_created` on real `auth.users`                      | BLOCKED BY CONFIGURATION      | Trigger needs a real Supabase `auth` schema.                                                |
| Migrations applied to a remote project                               | BLOCKED BY CONFIGURATION      | Remote reported `public.organizations` missing at last probe (earlier phase).               |

## 4. Services, repositories, libraries

| Module                                                                                      | Classification                                                                                                                                              |
| :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/tenancy`, `trips`, `stores`, `reporting`, `notifications`, `auth` services + repos | COMPLETE AND VERIFIED (local)                                                                                                                               |
| `modules/visits` (check-in/out, checklist)                                                  | COMPLETE AND VERIFIED (local)                                                                                                                               |
| `modules/visits` (evidence ticket/confirm/download)                                         | NEEDS SECURITY REVIEW (storage layer faked in tests)                                                                                                        |
| `modules/ai-reports`                                                                        | COMPLETE AND VERIFIED (local) (requiresHumanReview enforced, kill switch wired, bounded timeouts/tokens, mock tests)                                        |
| `lib/env/{startup,public,server}`                                                           | COMPLETE AND VERIFIED (local) (`startup.test.ts`, `env.test.ts`)                                                                                            |
| `lib/rate-limit`                                                                            | COMPLETE AND VERIFIED (local); wired into sign-in/sign-up/recovery (`auth/actions.ts`), `evidence` POST (request_ticket), `ai-report`                       |
| `lib/observability` (logger redaction, request IDs)                                         | COMPLETE AND VERIFIED (local); error-reporter provider **not connected**                                                                                    |
| `lib/offline`, `components/pwa`                                                             | PARTIAL (draft storage unit-tested; no service worker/sync backend verified)                                                                                |
| `lib/supabase/middleware.ts` + `proxy.ts`                                                   | PARTIAL: same-origin check and redirects logic present; **fails open** (passes through) when Supabase env vars are absent; no direct unit test of the proxy |

## 5. UI components (23)

`approvals/ApprovalsInboxClient`, `notifications/InAppNotificationsList`, `pwa/PwaOfflineSyncIndicator`, `shell/{AppShell,NavLinks,OrgSwitcher}`, `stores/{StoreDetailClient,StoresDirectoryClient}`, `team/InviteMemberPanel`, `trips/{TripDetailClient,TripPlanForm,TripsListClient}`, `ui/{States,StatusBadge}`, `visits/{AiVisitReportDraftPanel,VisitExecutionClient,VisitsListClient}`. Only `StatusBadge` has a component-level test; all others are covered indirectly (type-check + build) and by logic-level tests. **No browser/E2E UI test exists.**

## 6. Tests (24 files, 252 tests)

| File                                                                                                                                                       |  Tests |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: |
| `security/__tests__/api-access-control.test.ts`                                                                                                            |     61 |
| `security/__tests__/phase1-foundation.test.ts`                                                                                                             |     33 |
| `tenancy/__tests__/tenancy.test.ts`                                                                                                                        |     22 |
| `tenancy/__tests__/database-rls.test.ts` (PGlite)                                                                                                          |     19 |
| `visits/__tests__/visit-execution-client-workflows.test.ts`                                                                                                |     17 |
| `trips/__tests__/ui-workflows.test.ts`                                                                                                                     |     10 |
| `tenancy/__tests__/end-to-end-workflow.test.ts` (PGlite)                                                                                                   |      9 |
| `security/__tests__/db-privilege-hardening.test.ts` (PGlite)                                                                                               |      9 |
| `trips/__tests__/stores-and-trips.test.ts`                                                                                                                 |      7 |
| `auth/__tests__/auth.test.ts`                                                                                                                              |      6 |
| `security/__tests__/security-regressions.test.ts`                                                                                                          |      6 |
| `ui/__tests__/status-badge.test.ts`                                                                                                                        |      6 |
| `env/__tests__/startup.test.ts`                                                                                                                            |      6 |
| `offline/__tests__/visit-draft-storage.test.ts`                                                                                                            |      5 |
| `tenancy/__tests__/team-directory.test.ts`                                                                                                                 |      5 |
| `scripts/__tests__/migration-lint.test.ts`, `env.test.ts`, `logger.test.ts`, `rate-limit.test.ts`, `ai-report-drafts.test.ts`, `dashboard-and-csv.test.ts` | 4 each |
| `notifications-and-ux.test.ts`, `visits-and-evidence.test.ts`                                                                                              | 3 each |
| `app/__tests__/manifest.test.ts`                                                                                                                           |      1 |

## 7. Audit-fix presence check (`AUDIT_FIXES.md`, 17 items)

| ID      | Claim                                                  | Present in code?                                                                                                                        |
| :------ | :----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| 001–006 | Mock/in-memory pages replaced by live API wiring       | **Yes**: 9 client components call `fetch(`; no fixture arrays found in pages inspected                                                  |
| 007     | Layout carries workspace/user context                  | Yes (AppShell/OrgSwitcher present)                                                                                                      |
| 008     | `middleware.ts` → `proxy.ts`                           | **Yes**: `src/middleware.ts` gone; `src/proxy.ts` exports `proxy`; build prints `ƒ Proxy (Middleware)`                                  |
| 009     | E2E MVP + cross-tenant test                            | **Yes**: `end-to-end-workflow.test.ts` (9 tests passing)                                                                                |
| 010     | Storage runbook inconsistency                          | Docs-only; see blocker B-04 (checklist still wrong about bucket creation)                                                               |
| 011–013 | Visit execution client, stop check-in, filter enum     | **Yes**: `VisitExecutionClient.tsx` (PUT to signed URL then `?action=confirm`), check-in in `TripDetailClient`, filter aligned to enum  |
| 014     | Checklist env alignment                                | Partially: variable names correct; **other facts in the checklist are wrong** (see blockers B-03).                                      |
| 015     | Phase 1 — Foundation and Security Hardening            | **Yes**: Strict JWT & domain checks, logger redactions, anon privilege revocations (migration 12), fail-closed middleware.              |
| 016     | Phase 2 — Core Field Operations UI & Submit Invariants | **Yes**: Trip edit ownership/status gating, submit route JSON parse error handling, TripsList full status enum filter options.          |
| 017     | Phase 3 — Visit Execution Consent, Uploads & Gating    | **Yes**: Consent-driven geolocation, action guard deadlock fix, client idempotency keys, 307 download redirect, upload size/type check. |
