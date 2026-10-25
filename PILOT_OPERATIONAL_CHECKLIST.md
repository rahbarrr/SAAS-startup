# FieldTrack — Pilot Operational Checklist

This checklist provides the mandatory operational procedures for deploying, configuring, monitoring, and operating FieldTrack during a controlled multi-tenant pilot with real retail managers and field representatives.

---

## 1. Pre-Deployment Infrastructure & Environment Checklist

### 1.1 Supabase Database & Security Verification
- [ ] **Migration State:** Execute `npm run lint:migrations` to ensure 0 lint errors across all 14 database migrations.
- [ ] **Database Schema:** Confirm all 14 migrations are applied in sequential timestamp order:
  1. `20261022000001_init_orgs_and_memberships.sql`
  2. `20261022000002_field_operations_schema.sql`
  3. `20261022000003_auth_invitations_and_onboarding.sql`
  4. `20261022000004_transactional_trips_and_stores_rpcs.sql`
  5. `20261022000005_approval_inbox_and_atomic_decisions.sql`
  6. `20261022000006_visit_execution_and_evidence.sql`
  7. `20261022000007_trip_completion_and_reporting_indexes.sql`
  8. `20261022000008_ai_visit_report_drafts.sql`
  9. `20261022000009_in_app_notifications_and_read_receipts.sql`
  10. `20261022000010_security_hardening_rls_and_triggers.sql`
  11. `20261022000011_rate_limits.sql`
  12. `20261022000012_revoke_anon_and_internal_function_execute.sql`
  13. `20261022000013_phase5_offline_push_and_digests.sql`
  14. `20261025000014_phase7_enterprise_audit_and_location.sql`
- [ ] **Row-Level Security (RLS):** Verify RLS is enabled and forced on all public tables:
  `organizations`, `organization_members`, `organization_invitations`, `stores`, `trips`, `trip_stops`, `visits`, `visit_checklist_items`, `visit_evidence`, `trip_audit_events`, `organization_audit_events`, `trip_location_breadcrumbs`, `visit_ai_report_drafts`, `in_app_notification_reads`.
- [ ] **Database Triggers:** Verify triggers are active:
  - `trg_trips_workflow_and_decisions` (blocks self-approval; enforces state machine).
  - `trg_visits_lifecycle_invariants` (blocks checkout with incomplete required checklists; prevents non-owner edits).
  - `trg_enforce_org_audit_invariants` (enforces append-only immutability; blocks UPDATE/DELETE with code `42501`).
  - `trg_enforce_trip_audit_invariants` (blocks UPDATE/DELETE on trip audit trail).
- [ ] **Storage Buckets:**
  - Create Supabase private storage bucket: `fieldtrack-evidence`.
  - Ensure public access is **disabled** (`public = false`).
  - Enforce tenant-scoped object path constraint: `<organization_id>/<visit_id>/<filename>`.

### 1.2 Environment Variables (Production & Staging)
Ensure the following variables are configured in the Vercel / deployment environment (never committed to git):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`: Production Supabase project URL (e.g. `https://xyz.supabase.co`).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/public key.
- [ ] `NEXT_PUBLIC_APP_URL`: Canonical application origin (e.g. `https://app.fieldtrack.example.com`).
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: Service-role key for backend administrative tasks.
- [ ] `CRON_SECRET`: Random 64-character hex string for authenticating scheduler webhooks on `/api/orgs/[orgId]/digest`.
- [ ] `ROUTING_PROVIDER`: Set to `osrm` for road-network driving distances, or left empty for straight-line Haversine.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: VAPID public key for Web Push.
- [ ] `VAPID_PRIVATE_KEY`: VAPID private key (server-only).
- [ ] `VAPID_SUBJECT`: Contact email for Web Push (e.g. `mailto:support@fieldtrack.example.com`).
- [ ] `OPENAI_API_KEY`: (Optional) OpenAI API key. If omitted, the deterministic heuristic provider operates seamlessly.
- [ ] `OPENAI_REPORT_MODEL`: Set to `gpt-4o-mini` when OpenAI is configured.
- [ ] `RESEND_API_KEY`: (Optional) API key for dispatching manager email digests.

---

## 2. Organization Onboarding & Pilot Setup Checklist

### 2.1 Workspace Initialization
- [ ] **Create Tenant Workspace:** Organization Administrator registers and calls `/api/orgs` to create the tenant (e.g., `Summit Retail Ltd`).
- [ ] **Store Directory Configuration:** Administrator imports or creates active retail stores with verified street addresses, postal codes, and GPS coordinates (`latitude`, `longitude`).
- [ ] **Team Invitations:**
  - Administrator sends invitation to pilot Retail Manager (role: `manager`).
  - Administrator sends invitations to pilot Field Representatives (role: `field_employee`).
- [ ] **Account Activation:** Invited members receive email/token and accept their invitations, establishing authenticated user sessions.

### 2.2 Device & Browser Pre-Flight (Physical Devices)
Conduct on test devices prior to active field work:
- [ ] **Android Chrome (v120+):**
  - Navigate to `NEXT_PUBLIC_APP_URL`.
  - Install as Progressive Web App (PWA) via Chrome menu (`Install app`).
  - Check in to a test store stop: verify device prompts for Location permission and captures unverified GPS coordinates.
  - Test evidence capture: verify `<input type="file" capture="environment">` invokes device camera directly.
  - Airplane mode test: toggle flight mode, fill out checklist item, verify draft saves locally in IndexedDB/Storage.
  - Reconnect test: toggle flight mode off, tap "Sync Pending", confirm operation status updates to `synced`.
- [ ] **iOS Safari (iOS 16.4+):**
  - Open Safari, tap Share -> `Add to Home Screen`.
  - Open the installed Home Screen PWA.
  - Test Location permission prompt on Check-In.
  - Test camera capture prompt.
  - Background test: switch apps for 3 minutes, return to FieldTrack, confirm unsaved visit checklist state is preserved.

---

## 3. Daily Pilot Operations Checklist

### Morning Routine (Retail Manager)
1. [ ] **Daily Briefing Review:** Open `/ai-insights` to review the Manager Daily Briefing.
   - Review critical exceptions (overdue visits, pending approvals, missing evidence).
   - Review recommended actions and mark as `accepted` or `dismissed`.
2. [ ] **Approval Inbox Triage:** Open `/approvals` to review submitted trip itineraries.
   - Review planned stop order and driving route feasibility.
   - Authorize or request changes on pending trips (self-approval is automatically blocked).

### Daytime Routine (Field Representative)
1. [ ] **Trip Roster:** Open `/trips` and view assigned approved trip.
2. [ ] **Store Check-In:** Tap "Check In" upon arriving at store destination.
   - Confirm coordinates are captured (`captured_unverified`).
   - Notice trip status automatically transitions to `in_progress`.
3. [ ] **Audit Execution:**
   - Complete required checklist items (e.g., promotional endcap compliance).
   - Capture and upload clear photographic evidence.
4. [ ] **Store Check-Out:** Review audit summary, enter field notes, and complete Check-Out.
   - Confirm stop status transitions to `visited` and visit status to `submitted`.

### Evening Routine (Retail Manager & Administrator)
1. [ ] **Visit Quality Review:** Open `/visits` to inspect submitted store visit records and photographic evidence. Mark visits as `reviewed`.
2. [ ] **Territory Analytics & Reports:** Open `/reports` to verify completed store visits, coverage rates, and audit compliance metrics.
3. [ ] **Audit Trail Spot-Check:** Open `/audit` to verify all state-changing operations are faithfully recorded in immutable audit logs.
4. [ ] **Scheduled Digest Execution:** Confirm `/api/orgs/[orgId]/digest` cron fired with valid `CRON_SECRET` and dispatched operational summaries.

---

## 4. Emergency Kill-Switches & Incident Procedures

| Incident Scenario | Kill Switch / Mitigation Procedure |
| :--- | :--- |
| **OpenAI Rate Limit / API Outage** | Application automatically falls back to the zero-network `HeuristicIntelligenceProvider`. No downtime occurs. Optional: set `AI_REPORTS_ENABLED="false"`. |
| **Evidence Upload Storage Issue** | Set `UPLOADS_ENABLED="false"` in environment variables. Representative checklist completion and visit submissions continue uninterrupted. |
| **Compromised Cron Secret** | Generate new 64-char random string, update `CRON_SECRET` in Vercel environment variables, and update external scheduler request headers. |
| **Data Retention Compliance** | Organization Administrator executes `/api/orgs/[orgId]/location/purge` with `retentionDays: 30` to permanently purge location breadcrumbs older than the configured threshold. |
