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
