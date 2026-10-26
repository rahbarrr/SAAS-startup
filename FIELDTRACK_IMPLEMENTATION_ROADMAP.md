# FieldTrack — Implementation Roadmap (from Phase 0 baseline)

**Date:** 2026-10-25 · **Baseline:** `main` @ `49e29dd` · Companion docs: `FIELDTRACK_FEATURE_INVENTORY.md`, `FIELDTRACK_CURRENT_BLOCKERS.md`.

## Baseline summary

The application code is feature-complete for the MVP workflow and passes every local gate (format, lint, typecheck, migration lint on 12 migrations, 233/233 tests across 23 test files, production build, 0 prod vulnerabilities). What is **not** established is anything involving real Supabase Auth, Storage, a deployed host, or a live AI provider.

## Phase 1 — Foundation and Security Hardening (COMPLETE AND VERIFIED LOCALLY)

- **Secrets and Startup Validation:** Strict detection of service-role keys / `sb_secret_` in public environment variables across all environments; HTTPS enforced outside development; exact hostname matching on `.supabase.co` and `.supabase.in` preventing lookalike subdomain attacks.
- **Middleware & Session Proxy:** Middleware fail-closed with 503 JSON (`INTERNAL_ERROR`, correlation `x-request-id`) when Supabase env is missing in hosted production/preview deployments, while allowing local development pass-through.
- **Error & Log Redaction:** Comprehensive token scrubbing (`sb_secret_`, `sk-`, Bearer tokens, DB connection URLs) in both observability logs and user-facing HTTP error envelopes.
- **Redirect Path Sanitization:** Rejection of control characters and non-leading backslashes in `sanitizeRedirectPath`.
- **Database Privilege Hardening (Migration 12):** Revoked table and sequence access from `anon`, revoked EXECUTE from `anon` on all public functions except `consume_rate_limit`, and revoked EXECUTE on trigger functions from `public`, `anon`, and `authenticated`. Verified via PGlite and `post-release.sql`.
- **API Access Control Matrix:** 61 route handlers verified to reject unauthenticated requests with 401 and cross-tenant requests with 403.
- **Regression Tests Added:** 103 new security and hardening tests across `phase1-foundation.test.ts`, `api-access-control.test.ts`, and `db-privilege-hardening.test.ts`. Total test count: 233 passed.

## Phase 2 — Owner decisions (blocking everything cloud-side)

1. Confirm the hosting platform (B-01).
2. Confirm the configured Supabase project reference and verify it is the intended target before applying any cloud migration.
3. Verify the production email-confirmation and redirect settings using the intended pilot account.

- **Exit:** a written record of the three answers.

## Phase 3 — Close the storage verification gap (local first)

- Add a test fixture that creates a minimal `storage` schema (`buckets`, `objects`, `foreign` policy plumbing) in PGlite so the migration's guarded block actually executes, then assert: private bucket, org-prefix isolation on SELECT, `can_employee_edit_visit` gating INSERT, cross-tenant denial.
- Requires adding test code only (no migration edits). Not done in this phase per the rules.
- **Exit:** S-01 downgraded from "never executed" to "executed locally"; still needs live confirmation in Phase 5.

## Phase 4 — Manager Dashboard and Reporting (COMPLETE AND VERIFIED LOCALLY)

- **Operational Metrics Derivation:** Authoritative calculation of operational metrics directly from committed database records (`trips`, `trip_stops`, `visits`, `visit_checklist_items`, `visit_evidence`, `trip_audit_events`), completely free of static/mock fixtures. Includes `tripsAwaitingApproval`, `approvedTrips` (with `approvedNotStarted`, `inProgress`, and `completedAllStopsCheckedOut`), `tripsByStatus` lifecycle breakdown across all 7 statuses, `completedVisits`, `pendingVisits`, and `exceptionsRequiringAttention`.
- **Planned vs. Actual Execution & Field Rep Attribution:** Stop execution list displaying store name, region, sequence, planned stop status, actual visit status, checklist completion counts, flagged items, evidence counts, point-in-time check-in/out timestamps, and assigned field rep UUID (`ownerUserId`).
- **CSV Export & Formula Injection Prevention:** RFC 4180 CSV export endpoint with content disposition attachment, `Cache-Control: no-store`, row count header, and OWASP formula injection prefix escaping (`=`, `+`, `-`, `@`, `\t`, `\r`, and leading whitespace) via regex `/^[ \t\r\n]*[=+\-@\t\r]/`.
- **Multi-Tenant & Role Authorization:** Gated to active `manager` or `admin` members for organization-wide dashboard and CSV export. Field employees and cross-tenant users receive strict 403 responses. Peer field employees denied from viewing other reps' trip and visit comparisons.
- **Strict Date Boundary & Overdue Rules:** All date boundaries (`startDateFrom`, `startDateTo`, `startDate`, `endDate`) validated as ISO-8601 UTC calendar dates (`YYYY-MM-DD`). Overdue stops evaluated when reference date exceeds trip `endDate` without checkout. Inverted date ranges strictly rejected.
- **Resilient UI States:** Handles loading, empty, error, and retry states. Unauthenticated users see explicit zeroed metrics and sign-in guidance; field employees receive role scope notices; managers encountering fetch errors see accessible `<ErrorState>`; stop execution list renders `<EmptyState>` when filters yield no matches; cursor pagination enabled across pages.
- **In-App Notifications & Read Receipts:** Event-derived notification stream based on committed `trip_audit_events` and user `in_app_notification_reads` receipts. In-flight action guard blocks concurrent double-clicks. Explicit `EXTERNAL_DELIVERY_DISCLAIMER` clearly discloses in-app only delivery without claiming external email/SMS/push delivery.
- **Tests Added & Verified:** 24 test suites, 257 tests passing cleanly across all quality gates.

## Phase 5 — AI Visit Report Drafting (COMPLETE AND VERIFIED LOCALLY)

- **Authorized Report Drafting:** Authorized field employees and managers can draft an AI visit report for checked-in or completed visits (`checkedInAt != null`). Unstarted visits are rejected upfront (400 `VALIDATION_ERROR`).
- **Strict Data Minimization & Security:** Only authorized visit records (visit notes, completed checklist items, evidence photo captions) are gathered. GPS coordinates, Supabase storage paths, image binaries, and employee personal PII (emails/user IDs) are strictly excluded from prompts and model inputs.
- **Untrusted Model Content & Injection Defense:** Model outputs are treated as untrusted JSON content validated against `aiGeneratedReportDraftPayloadSchema`. Delimiter tags (`</untrusted_visit_data>`) in visit notes are redacted, and directive override attempts (auto-approvals, employee scoring, secret exfiltration) are blocked with 502 `AI_POLICY_VIOLATION`. The model cannot approve trips, modify roles, or execute actions.
- **Human-Review Enforcement & Provenance Immutability:** Generated drafts are stored with `requiresHumanReview = true`, `isFinalApproved = false`, and `aiGeneratedLabel = 'AI-Generated Draft — Requires Human Review'`. Database triggers and service validation strictly preserve source provenance (`model_name`, `model_version`, `source_record_ids`). When reviewed, `requiresHumanReview` transitions to `false` and `isFinalApproved` is set only upon explicit manager/employee approval.
- **Configuration & Cost Controls:**
  - `AI_REPORTS_ENABLED`: Global server kill switch (`true`/`false`). When `false`, drafting is disabled and reports fallback to manual editing without errors.
  - `OPENAI_API_KEY`: Server-only secret; never exposed to browser or client bundles.
  - `OPENAI_REPORT_MODEL`: Configurable model (defaults to `gpt-4o-mini`).
  - `OPENAI_MAX_OUTPUT_TOKENS`: Hard output token limit (defaults to 1200 tokens).
  - `OPENAI_REQUEST_TIMEOUT_MS`: Request timeout (defaults to 15,000 ms / 15 seconds).
  - Organization Quotas: `ai_daily_draft_quota` enforced per org per UTC calendar day.
- **Independent Manual Reporting:** Manual visit note drafting and checklist completion operate completely independently of AI availability.
- **Tests Added & Verified:** 24 test suites, 259 tests passing cleanly across all quality gates.

## Phase 6 — Controlled production verification (requires explicit approval per action)

1. Confirm the production project reference in the hosting environment and Supabase dashboard match exactly.
2. Review the current migration inventory and the remote migration history before applying any database change.
3. Take and record the required backup/PITR reference and document the forward-fix/restore plan.
4. Run only the reviewed production database release workflow; inspect its dry-run output before approving the apply step.
5. Verify the private evidence bucket, auth callback URLs, and email policy without changing existing customer data.


## Phase 7 — Live validation (record real results; mark anything untested as unverified)

Signup/confirm/login/logout/reset and callbacks; onboarding persistence; trip → approve → check-in → checklist → upload → checkout; dashboard/CSV accuracy; unauthenticated API calls rejected; cross-tenant read/write/**storage object** access denied with two real tenants; logs contain no secrets/PII.

## Phase 8 — Pre-production prerequisites (not started)

Error-monitoring provider, backup/PITR plan and restore test, OpenAI spend cap, branch protection and GitHub environments, billing and mobile (design memos only; **no implementation exists**).

## Priority order

|  #  | Item                                        | Why this order                                        |
| :-: | :------------------------------------------ | :---------------------------------------------------- |
|  1  | Phase 2 owner decisions + Phase 1 doc fixes | Cheap, unblock everything, and stop inaccurate claims |
|  2  | Phase 3 storage test                        | Largest unverified security surface; doable offline   |
|  3  | Phase 4 & Phase 5 (local features)          | Core application and AI workflow verified locally     |
|  4  | Phase 6–7 (controlled production validation) | Requires owner-approved cloud actions                 |
