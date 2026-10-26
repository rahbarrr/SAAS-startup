# FieldTrack — Enterprise Pilot Operations & Readiness Runbook

This document provides operational instructions, deployment verification checklists, security governance procedures, and architecture guidance for conducting a controlled enterprise pilot with FieldTrack.

---

## 1. Pilot Readiness Checklist

Verify all items prior to launching tenant pilots or granting production access:

| Area                   | Requirement                                                                            | Verification Method                                                    | Status   |
| :--------------------- | :------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- | :------- |
| **Migrations**         | All 14 migrations applied sequentially                                                 | `npm run lint:migrations` passes with 0 errors                         | Verified |
| **Row Level Security** | RLS enabled and forced on 100% of public tables                                        | `src/modules/security/__tests__/db-privilege-hardening.test.ts` passes | Verified |
| **Audit Immutability** | Append-only triggers prevent UPDATE/DELETE on `organization_audit_events`              | PostgreSQL raises exception `42501` on mutation                        | Verified |
| **Location Privacy**   | Breadcrumb points restricted to `in_progress` trips; admin purge function available    | Unit & integration test suites verify status check                     | Verified |
| **Formula Injection**  | Formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) sanitized in CSV exports   | `sanitizeCsvCell` unit tests passing                                   | Verified |
| **Health Probe**       | Distinguishes service availability from dependency failures; echoes `x-correlation-id` | `GET /api/health` returns 200 with service map                         | Verified |
| **Access Control**     | Every API route enforces 401 unauthenticated and 403 non-member isolation              | `api-access-control.test.ts` (85 automated tests pass)                 | Verified |
| **Client Bundles**     | Zero service-role keys or sensitive credentials exposed                                | Turbopack client bundle audit and strict environment separation        | Verified |

---

## 2. Environment Configuration

### Required Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_ENV=production
EXPECTED_SUPABASE_PROJECT_REF=<project-ref>
```

### Optional Integration Variables

```bash
# Automated Digest & Cron Trigger Authentication
CRON_SECRET=super-secret-random-32-byte-hex-string

# Web Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BM...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:security@yourdomain.com

# Transactional Email (Daily Manager Digest)
RESEND_API_KEY=re_...

# Road Network Routing (Optional OSRM)
ROUTING_PROVIDER=osrm # or leave blank for straight-line Haversine fallback
OSRM_BASE_URL=https://router.project-osrm.org
```

---

## 3. Scheduled Jobs & Operator Runbook

### Manager Operations Digest (`/api/orgs/[orgId]/digest`)

- **Schedule:** Triggered daily at 06:00 UTC (or end-of-day per customer timezone).
- **Authentication:** `CRON_SECRET` required as `Authorization: Bearer <token>` or `x-cron-secret: <token>`.
- **Operator Failure Procedure:**
  1. Inspect the server logs filtering for `event: "manager_digest_dispatch"`.
  2. If Resend returns rate limits or authentication errors, the endpoint records delivery status as `failed` but does not crash.
  3. Safe manual replay:
     ```bash
     curl -X POST https://app.yourdomain.com/api/orgs/<org-id>/digest \
       -H "Authorization: Bearer $CRON_SECRET" \
       -H "Content-Type: application/json" \
       -H "x-correlation-id: manual-replay-$(date +%s)"
     ```

### Location Retention Purge (`/api/orgs/[orgId]/location/purge`)

- **Policy:** Location breadcrumbs are retained for a configurable period (default: 30 days).
- **Execution:** Automated via database pg_cron or invoked by an organization administrator:
  ```bash
  curl -X POST https://app.yourdomain.com/api/orgs/<org-id>/location/purge \
    -H "Cookie: sb-access-token=..." \
    -H "Content-Type: application/json" \
    -d '{"retentionDays": 30}'
  ```
- **Audit:** Records an immutable `location.breadcrumbs_purged` audit event specifying who initiated the purge and the count of purged records.

---

## 4. Controlled Location Tracking & Architecture Reality

### Current Web/PWA Capability

1. **Core Workflow:** Point-in-time check-in and check-out GPS snapshots recorded with explicit user consent.
2. **Active Trip Tracking:** Users can explicitly activate location telemetry on `in_progress` work trips. A visible `🟢 Tracking Active` banner is displayed throughout the session.
3. **Strict Constraints:**
   - Tracking is rejected if the trip is in `draft`, `submitted`, `approved`, or `completed` status.
   - Non-owner employees cannot record breadcrumbs for another representative's trip.
   - Web browsers (Safari iOS and Chrome/Edge Android) suspend JavaScript and terminate timer loops when tabs are backgrounded or the screen locks.

### Future Native Architecture Recommendation (Phase 8)

If continuous background GPS tracking while the screen is locked or device is in a representative's pocket is a mandatory enterprise requirement:

- **Framework:** React Native / Expo with `@transistorsoft/react-native-background-geolocation` or Expo Background Location.
- **Platform Permissions:**
  - **iOS:** `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: ["location"]`.
  - **Android:** `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` with a persistent system notification.
- **Backend API:** Reuse the exact `/api/orgs/[orgId]/trips/[tripId]/location` endpoint and database schema established in Phase 7.

---

## 5. Security & Governance Invariants

1. **Audit Immutability:** Historical records in `public.organization_audit_events` cannot be altered or deleted by application APIs.
2. **CSV Formula Injection:** All exported spreadsheet cells are sanitized against `=+-@\t\r` injection.
3. **Data Isolation:** All queries enforce `orgId` boundaries via RLS and server-side authorization helpers (`requireOrgPermission` / `resolveTenantContext`).
4. **Secret Redaction:** Logs, health checks, and client bundles never contain database connection strings, service-role keys, or plaintext credentials.

---

## 6. Phase 8: AI-Powered Field Intelligence Governance & Architecture

FieldTrack Phase 8 introduces three operational AI intelligence workflows designed with strict safety boundaries and zero-dependency resilience:

### Workstreams

1. **AI Trip Planning Assistant (`/api/orgs/[orgId]/trips/[tripId]/ai-plan`):**
   - Synthesizes schedule conflicts, rep overlapping itineraries, daily stop workloads (>8 stops flagged), and missing store coordinates.
   - Integrates the 2-Opt TSP route optimizer (`optimizeTripRoute`) to propose optimized visit sequences and distance savings.
   - **Approved-Trip Protection:** Itinerary updates cannot silently alter approved trips. Reordering an approved trip requires `confirmApprovedTripModification: true` and automatically resets status to `draft` for re-approval.
2. **Manager Daily Briefing (`/api/orgs/[orgId]/ai/briefing`):**
   - Synthesizes operational metrics for the day (trips today, active visits, overdue incomplete visits, pending approvals, missing evidence).
   - Flags critical exceptions with direct source record IDs (`trip_id`, `visit_id`).
   - Surfaces workload distribution imbalances (overloaded vs underutilized reps).
   - Generates actionable manager follow-ups with accept/dismiss decision tracking (`/api/orgs/[orgId]/ai/briefing/action`).
   - If operational records are sparse, returns `hasSufficientData: false` with factual explanations rather than hallucinating metrics.
3. **AI Visit Report Summaries (`/api/orgs/[orgId]/visits/[visitId]/ai-report`):**
   - Generates structured draft summaries from checklist items and evidence metadata.
   - Auditable lifecycle: records `ai.visit_report_drafted`, `ai.visit_report_approved`, and `ai.visit_report_rejected` in `organization_audit_events`.
   - Representatives can review and edit all text before submission.

### Resilience & Zero-Network Offline Fallback

- `ResilientAiIntelligenceProvider` coordinates between external OpenAI models and `HeuristicIntelligenceProvider`.
- If `OPENAI_API_KEY` is omitted, offline, timed out (15s boundary), or rate-limited, FieldTrack functions seamlessly without disruption using verified database heuristics.

### Security & Privacy Controls

- **Zero API Key Leakage:** `OPENAI_API_KEY` and Supabase service-role keys are strictly server-side and never bundled to client browsers.
- **Tenant Isolation:** Enforced via `resolveTenantContext` and `assertTenantResourceOwnership`. Managers and reps cannot query or summarize other organizations' data.
- **Prompt Injection Defense:** Operational strings (store addresses, notes, checklist answers) are strictly delimited inside `<untrusted_operational_data>` boundary tags.
- **No Autonomous Mutations:** AI outputs are advisory recommendations. All mutations require authenticated user interaction through existing business authorization logic.
