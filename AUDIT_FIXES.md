# FieldTrack — Audit & Bug-Fixing Log

This document details every defect identified during the full-stack audit, its root cause, files changed, regression tests added or executed, and verification results.

---

## Fix 1: Disconnected Store Directory & In-Memory State Mutation

- **Finding ID:** `AUDIT-FIX-001`
- **Severity:** P1 — High (Core workflow disconnected from persistence)
- **Root Cause:** [`src/app/stores/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/stores/page.tsx) and [`src/app/stores/[storeId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/stores/[storeId]/page.tsx) were client components managing stores purely in local React `useState` memory with hardcoded identifiers (`orgId: "active-org"`). Store creations and modifications were never sent to PostgreSQL via the backend API.
- **Affected Files:**
  - [`src/app/stores/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/stores/page.tsx)
  - [`src/app/stores/[storeId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/stores/[storeId]/page.tsx)
  - [`src/components/stores/StoresDirectoryClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/stores/StoresDirectoryClient.tsx) _(new component)_
  - [`src/components/stores/StoreDetailClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/stores/StoreDetailClient.tsx) _(new component)_
- **Remediation:**
  1. Converted `StoresPage` into an async Server Component that resolves the authenticated user and active organization workspace, checks role permissions (`canWrite = role === "admin" || role === "manager"`), and loads real tenant stores using `listStoresForOrg`.
  2. Built `StoresDirectoryClient` with in-flight double-tap protection, coordinate validation, search/region filtering, and live mutation to `POST /api/orgs/[orgId]/stores`.
  3. Converted `StoreDetailPage` into an async Server Component querying `getStoreForOrg` and updating via `PATCH /api/orgs/[orgId]/stores/[storeId]`.
- **Regression Tests & Verification:**
  - `src/modules/trips/__tests__/stores-and-trips.test.ts` (7 integration test suites passing).
  - `src/modules/trips/__tests__/ui-workflows.test.ts` (store search and region filtering invariants).

---

## Fix 2: Field Trips Directory Using Static Mock Arrays

- **Finding ID:** `AUDIT-FIX-002`
- **Severity:** P1 — High (Core workflow displaying mock data)
- **Root Cause:** [`src/app/trips/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/page.tsx) defined a static `SAMPLE_TRIPS` constant and filtered in-memory rather than querying the database.
- **Affected Files:**
  - [`src/app/trips/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/page.tsx)
  - [`src/components/trips/TripsListClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripsListClient.tsx) _(new component)_
- **Remediation:**
  1. Converted `TripsPage` into an async Server Component resolving the active workspace and querying `listTripsForOrg`.
  2. Built `TripsListClient` to support live workflow status filtering (`draft`, `submitted`, `approved`, `changes_requested`, `rejected`), text search, and direct links to trip details and editing.
- **Regression Tests & Verification:**
  - `npm test src/modules/trips/__tests__/stores-and-trips.test.ts` passing.
  - Verified scoping: field employees only see their own trips, while managers and admins see all trips across the active organization.

---

## Fix 3: Trip Creation & Editing Form In-Memory Mocking

- **Finding ID:** `AUDIT-FIX-003`
- **Severity:** P1 — High (Trip submission not persisting to database)
- **Root Cause:** [`src/components/trips/TripPlanForm.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripPlanForm.tsx) and [`src/app/trips/new/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/new/page.tsx) used hardcoded `DEFAULT_ACTIVE_STORES` and set local `confirmation` state on submit without calling backend endpoints.
- **Affected Files:**
  - [`src/components/trips/TripPlanForm.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripPlanForm.tsx)
  - [`src/app/trips/new/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/new/page.tsx)
  - [`src/app/trips/[tripId]/edit/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/[tripId]/edit/page.tsx)
- **Remediation:**
  1. Updated `TripPlanForm` to accept `activeOrgId`, `tripId`, and dynamic `availableStores`.
  2. Implemented transactional submission calling `POST /api/orgs/[orgId]/trips` (for new drafts) or `PATCH /api/orgs/[orgId]/trips/[tripId]` (for edits), sending ordered stops with sequence numbers and planned dates.
  3. Added automatic redirection to `/trips/[tripId]` upon successful creation/save.
  4. Updated `NewTripPage` and `EditTripPage` to load real active stores from `listStoresForOrg` and real trip details from `getTripDetailForOrg`.
- **Regression Tests & Verification:**
  - Verified trip creation lifecycle in `stores-and-trips.test.ts` (draft -> submitted -> changes_requested -> approved -> reopened).

---

## Fix 4: Trip Detail Page Hardcoded Identifiers & Mock Audit Events

- **Finding ID:** `AUDIT-FIX-004`
- **Severity:** P1 — High (Core trip review and audit timeline disconnected)
- **Root Cause:** [`src/app/trips/[tripId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/[tripId]/page.tsx) had hardcoded `ORG_ID`, `EMPLOYEE_ID`, and static mock `auditEvents`. Trip submission and manager approval were not persisted to PostgreSQL.
- **Affected Files:**
  - [`src/app/trips/[tripId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/[tripId]/page.tsx)
  - [`src/components/trips/TripDetailClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripDetailClient.tsx) _(new component)_
- **Remediation:**
  1. Converted `TripDetailPage` into an async Server Component resolving session and calling `getTripDetailForOrg` and `getStoresByIds`.
  2. Built `TripDetailClient` rendering:
     - Real ordered store stops with names and addresses.
     - Immutably recorded audit history timeline with actor IDs and UTC timestamps.
     - Employee submission action calling `POST /api/orgs/[orgId]/trips/[tripId]/submit`.
     - Manager review action calling `POST /api/orgs/[orgId]/trips/[tripId]/decision`.
     - Explicit **Self-Approval Prevention** UI guard when the reviewing manager is also the trip owner.
- **Regression Tests & Verification:**
  - `src/modules/trips/__tests__/ui-workflows.test.ts` (self-approval prevention rule verified).
  - `src/modules/tenancy/__tests__/database-rls.test.ts` (atomic `decide_submitted_trip` RPC tested).

---

## Fix 5: Manager Approvals Inbox Hardcoded Reviewer & Trips

- **Finding ID:** `AUDIT-FIX-005`
- **Severity:** P1 — High (Approvals workflow not querying database)
- **Root Cause:** [`src/app/approvals/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/approvals/page.tsx) had hardcoded `ACTIVE_REVIEWER_ID` and `INITIAL_INBOX_TRIPS`.
- **Affected Files:**
  - [`src/app/approvals/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/approvals/page.tsx)
  - [`src/components/approvals/ApprovalsInboxClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/approvals/ApprovalsInboxClient.tsx) _(new component)_
- **Remediation:**
  1. Converted `ApprovalsPage` into an async Server Component verifying `manager` or `admin` role and querying `listManagerApprovalInboxForOrg`.
  2. Built `ApprovalsInboxClient` with interactive decision controls (Approve, Request Changes, Reject) requiring explanatory notes for non-approval outcomes and posting decisions to `POST /api/orgs/[orgId]/trips/[tripId]/decision`.
- **Regression Tests & Verification:**
  - Verified manager permissions and self-approval block in `ui-workflows.test.ts` and `stores-and-trips.test.ts`.

---

## Fix 6: Store Visits Execution Page Using Static Stop Fixtures

- **Finding ID:** `AUDIT-FIX-006`
- **Severity:** P1 — High (Visits list disconnected from real database visits)
- **Root Cause:** [`src/app/visits/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/visits/page.tsx) defined `INITIAL_STOPS` and `ORG_ID = "aaaaaaaa..."` locally instead of reading from `listVisitsForOrg`.
- **Affected Files:**
  - [`src/app/visits/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/visits/page.tsx)
  - [`src/components/visits/VisitsListClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/visits/VisitsListClient.tsx) _(new component)_
  - [`src/components/ui/StatusBadge.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/ui/StatusBadge.tsx)
- **Remediation:**
  1. Converted `VisitsPage` into an async Server Component resolving user workspace and querying `listVisitsForOrg`.
  2. Built `VisitsListClient` rendering live visit statuses (`in_progress`, `submitted`, `reviewed`), check-in/out timestamps in UTC, and linking to the full execution and AI evidence detail page (`/visits/[visitId]`).
  3. Added `reviewed` state descriptor to `StatusBadge.tsx`.
- **Regression Tests & Verification:**
  - `src/components/ui/__tests__/status-badge.test.ts` passing with 6 tests.
  - `src/modules/visits/__tests__/visits-and-evidence.test.ts` passing with 3 tests.

---

## Fix 7: Global Root Layout Missing Active Workspace & User Context

- **Finding ID:** `AUDIT-FIX-007`
- **Severity:** P2 — Medium (Navigation and OrgSwitcher defaulting to unselected state)
- **Root Cause:** [`src/app/layout.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/layout.tsx) rendered `<AppShell>` without props, causing `OrgSwitcher` and header indicators to fall back to generic placeholder labels.
- **Affected Files:**
  - [`src/app/layout.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/layout.tsx)
- **Remediation:**
  - Converted `RootLayout` into an async Server Component that extracts the authenticated user from Supabase and active organization from cookies/tenancy repository, propagating `activeOrgId`, `activeOrgName`, `activeRole`, `organizations`, and `userEmail` to `AppShell`.
- **Regression Tests & Verification:**
  - `npm run build` succeeds, generating all app routes as server-rendered dynamic pages inheriting the session.

---

## Fix 8: Next.js Middleware Deprecation Migration to Proxy

- **Finding ID:** `AUDIT-FIX-008`
- **Severity:** P2 — Medium (Next.js 16.4.2 deprecation warning)
- **Root Cause:** Next.js 16.4.2 deprecated the `middleware.ts` file convention in favor of `proxy.ts` with an exported `proxy` function (`The middleware file convention is deprecated. Please use proxy instead.`).
- **Affected Files:**
  - `src/middleware.ts` _(deleted)_
  - [`src/proxy.ts`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/proxy.ts) _(created drop-in replacement)_
- **Remediation:**
  1. Created `src/proxy.ts` exporting `async function proxy(request: NextRequest)` and matching configuration `config = { matcher: [...] }`.
  2. Preserved the identical Supabase session refresh, public auth route passthrough, protected route enforcement, onboarding checks, active organization cookie validation, and security headers.
  3. Safely removed `src/middleware.ts`.
- **Regression Tests & Verification:**
  - `npm run build` completed cleanly with `ƒ Proxy (Middleware)` in Turbopack build logs. Deprecation warning completely eliminated.
  - Integration and unit tests pass with zero routing regressions.

---

## Fix 9: End-to-End MVP Workflow & Cross-Tenant Acceptance Test

- **Finding ID:** `AUDIT-FIX-009`
- **Severity:** P1 — High (Verification of end-to-end retail journey & tenant security)
- **Root Cause:** Need for automated, end-to-end verification covering the entire real employee and manager lifecycle—from organization onboarding and store creation to trip submission, self-approval prevention, manager approval, GPS-verified check-in, required checklist completion, storage-constrained evidence upload, checkout, reporting, and cross-tenant isolation.
- **Affected Files:**
  - [`src/modules/tenancy/__tests__/end-to-end-workflow.test.ts`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/modules/tenancy/__tests__/end-to-end-workflow.test.ts) _(created comprehensive E2E test suite)_
- **Remediation:**
  - Created a 9-step E2E integration test suite running in an isolated PostgreSQL engine (PGlite) with all 11 chronological database migrations applied and RLS forced:
    1. **Organization Onboarding & Store Directory:** Manager creates organization via `create_organization_with_owner` RPC, acquires `admin` role, and creates store. Unauthorized employee store creation is blocked by RLS.
    2. **Trip Planning:** Employee drafts field trip with planned store destinations.
    3. **Trip Submission:** Employee submits trip and verifies initial audit entry.
    4. **Self-Approval Prevention & Manager Review:** Employee cannot approve trip; manager cannot approve their own trip (`Self-approval is forbidden`); authorized manager approves trip via atomic RPC `decide_submitted_trip` and immutable audit log entry is recorded.
    5. **Visit Execution (Check-In):** Employee checks in to approved store stop via `check_in_trip_stop` with GPS coordinates. Required checklist items are verified auto-seeded.
    6. **Checklist & Storage Compliance:** Premature checkout fails until required checklist items are marked complete. Evidence upload verifies tenant storage path `${orgId}/${visitId}/${filename}`; foreign-tenant storage path is rejected by database check constraint.
    7. **Checkout Completion:** Employee checks out via `check_out_visit` with GPS coordinates; stop status transitions to `visited`.
    8. **Reporting & AI Draft Review:** Manager reporting aggregations verified; AI report draft with provenance source record IDs reviewed and approved.
    9. **Cross-Tenant Isolation & Audit Immutability:** Attacker from competitor organization receives 0 rows across stores, trips, and visits; audit log trigger `trg_trip_audit_events_invariants` raises exception `42501` on any update/delete attempt.
- **Regression Tests & Verification:**
  - `npm test src/modules/tenancy/__tests__/end-to-end-workflow.test.ts` (9 tests passing).
  - Total test suite expanded to 20 test files, 127/127 tests passing.

---

## Fix 10: Storage Runbook Specification Inconsistency in Staging Checklist

- **Finding ID:** `AUDIT-FIX-010`
- **Severity:** P2 — Medium (Operational runbook mismatch)
- **Root Cause:** [`STAGING_CHECKLIST.md`](file:///Users/rahbarraza/Downloads/SAAS%20startup/STAGING_CHECKLIST.md) listed storage bucket name as `evidence` and path structure as `{organization_id}/{trip_stop_id}/{evidence_id}.{ext}` with 15-minute expiration, whereas the codebase implementation in [`src/modules/visits/domain.ts`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/modules/visits/domain.ts) and [`src/modules/visits/repository.ts`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/modules/visits/repository.ts) strictly uses `EVIDENCE_STORAGE_BUCKET = "visit-evidence"` with tenant path `{organization_id}/{visit_id}/{filename}` and 5-minute (300s) signed URLs. A staging deployment following the old checklist would have experienced `404 Bucket Not Found` errors on evidence uploads.
- **Affected Files:**
  - [`STAGING_CHECKLIST.md`](file:///Users/rahbarraza/Downloads/SAAS%20startup/STAGING_CHECKLIST.md)
- **Remediation:**
  - Corrected storage bucket name to `visit-evidence` in section 3 and section 6.
  - Aligned storage path hierarchy documentation to `{organization_id}/{visit_id}/{evidence_id}.{ext}`.
  - Updated signed ticket expiration time to 5 minutes (`300` seconds).
- **Regression Tests & Verification:**
  - Re-verified matching constant in `src/modules/visits/domain.ts` and `visits-and-evidence.test.ts` passing.

---

## Fix 11: Missing Interactive Store Visit Execution Client on Visit Detail Page

- **Finding ID:** `AUDIT-FIX-011`
- **Severity:** P1 — High (Visit checklist, evidence upload, and checkout unavailable in UI)
- **Root Cause:** While the backend APIs (`PATCH /api/orgs/[orgId]/visits/[visitId]`, `POST /api/orgs/[orgId]/visits/[visitId]/evidence`, and `POST /api/orgs/[orgId]/visits/[visitId]/checkout`) were fully implemented and tested, [`src/app/visits/[visitId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/visits/[visitId]/page.tsx) rendered static read-only unordered lists (`<ul>`) for checklists and evidence files. Employees executing active visits had no interactive controls to check off items, input answers, upload photos, or submit checkouts.
- **Affected Files:**
  - [`src/components/visits/VisitExecutionClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/visits/VisitExecutionClient.tsx) _(new component)_
  - [`src/app/visits/[visitId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/visits/[visitId]/page.tsx)
- **Remediation:**
  1. Created `VisitExecutionClient` providing:
     - Interactive checklist answer inputs and completion toggles connected to `PATCH /api/orgs/[orgId]/visits/[visitId]`.
     - Direct Supabase Storage signed-ticket upload form with allowlisted MIME verification (JPEG, PNG, WebP, PDF) and confirmation call to `POST /api/orgs/[orgId]/visits/[visitId]/evidence?action=confirm`.
     - Checkout execution form requiring completion of all required checklist items and transmitting device coordinates to `POST /api/orgs/[orgId]/visits/[visitId]/checkout`.
  2. Integrated `VisitExecutionClient` into `src/app/visits/[visitId]/page.tsx`, passing authorized workspace permissions and active visit state.
- **Regression Tests & Verification:**
  - Added checkout checklist validation regression test to `src/modules/trips/__tests__/ui-workflows.test.ts`.

---

## Fix 12: Missing Stop Check-In Action on Approved Trip Detail Page

- **Finding ID:** `AUDIT-FIX-012`
- **Severity:** P1 — High (No UI mechanism to initiate store visit from approved trips)
- **Root Cause:** [`src/components/trips/TripDetailClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripDetailClient.tsx) rendered planned stops with static status badges, but lacked an interactive action for the trip owner to check in to a stop (invoking `POST /api/orgs/[orgId]/visits`) and navigate to the visit execution screen.
- **Affected Files:**
  - [`src/app/trips/[tripId]/page.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/app/trips/[tripId]/page.tsx)
  - [`src/components/trips/TripDetailClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/trips/TripDetailClient.tsx)
- **Remediation:**
  1. Updated `TripDetailPage` to query active visits for the trip's stops from the database and pass `visitsMap` to the client.
  2. Enhanced `TripDetailClient` to render:
     - A "Check In" button for trip owners when a stop is `planned` and the trip is `approved`.
     - Live links to existing visits (`Visit (in_progress) →` or `Visit (submitted) →`) when a stop has already been checked into.
     - Connected the check-in button to `POST /api/orgs/[orgId]/visits` with unverified location telemetry, seamlessly navigating the employee to the visit execution screen upon completion.
- **Regression Tests & Verification:**
  - Added check-in eligibility rule test to `src/modules/trips/__tests__/ui-workflows.test.ts`.

---

## Fix 13: Visits List Status Filter Inconsistent with Database Enum

- **Finding ID:** `AUDIT-FIX-013`
- **Severity:** P2 — Medium (Filter dropdown dropped submitted visits)
- **Root Cause:** [`src/components/visits/VisitsListClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/visits/VisitsListClient.tsx) had `<option value="completed">Completed (Checked Out)</option>`, but the PostgreSQL `visit_status` enum and `VISIT_STATUSES` domain constant use `submitted` and `reviewed`. Selecting "Completed" filtered out 100% of checked-out visits.
- **Affected Files:**
  - [`src/components/visits/VisitsListClient.tsx`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/components/visits/VisitsListClient.tsx)
- **Remediation:**
  - Aligned the filter options with actual domain statuses:
    - `<option value="all">All Visits</option>`
    - `<option value="in_progress">In Progress (Checked In)</option>`
    - `<option value="submitted">Submitted (Checked Out)</option>`
    - `<option value="reviewed">Reviewed</option>`
- **Regression Tests & Verification:**
  - Added `VisitStatus` filtering test to `src/modules/trips/__tests__/ui-workflows.test.ts`.

---

## Fix 14: Staging Checklist Environment Configuration & Startup Mismatches

- **Finding ID:** `AUDIT-FIX-014`
- **Severity:** P2 — Medium (Staging deployment startup failure risk)
- **Root Cause:** [`STAGING_CHECKLIST.md`](file:///Users/rahbarraza/Downloads/SAAS%20startup/STAGING_CHECKLIST.md) listed `FIELDTRACK_ENV` instead of the variable validated by [`src/lib/env/startup.ts`](file:///Users/rahbarraza/Downloads/SAAS%20startup/src/lib/env/startup.ts) (`APP_ENV`), omitted the mandatory `EXPECTED_SUPABASE_PROJECT_REF` required in non-development environments, and did not document the kill switches `AI_REPORTS_ENABLED` and `UPLOADS_ENABLED` or Supabase Auth email confirmation settings. Deploying staging with the old checklist would fail at server startup in `assertStartupEnv()`.
- **Affected Files:**
  - [`STAGING_CHECKLIST.md`](file:///Users/rahbarraza/Downloads/SAAS%20startup/STAGING_CHECKLIST.md)
- **Remediation:**
  - Updated section 1 to document `APP_ENV`, `EXPECTED_SUPABASE_PROJECT_REF`, `AI_REPORTS_ENABLED`, and `UPLOADS_ENABLED`.
  - Added section 2.4 documenting Supabase Auth email confirmation settings and the requirement for email autoconfirm or staging SMTP credentials.
- **Regression Tests & Verification:**
  - Verified with `validateStartupEnv()` for `APP_ENV: "staging"`.
