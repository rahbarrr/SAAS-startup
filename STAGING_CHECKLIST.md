# FieldTrack — Staging Deployment Checklist & Runbook

This checklist must be executed before approving and releasing FieldTrack to the staging environment. Never deploy to production or run destructive operations without explicit human owner approval.

---

## 1. Environment Variables Configuration

Configure the following environment variables in the staging deployment platform (e.g. Vercel, Cloud Run). **Never paste or print actual secret values in code, pull requests, or CI logs.**

### Public Environment Variables (Browser & Client)

- `NEXT_PUBLIC_SUPABASE_URL`: HTTPS URL of the staging Supabase project (e.g. `https://<staging-ref>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anonymous public key with limited client privileges.
- `NEXT_PUBLIC_APP_URL`: Base URL of the staging application (e.g. `https://staging.fieldtrack.app`).

### Server-Side Only Environment Variables (Secrets)

- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key used exclusively for privileged migrations, health probes, and test fixtures in CI. **Never expose to the browser.**
- `OPENAI_API_KEY`: API key for AI visit draft report generation (scoped to staging quota).
- `OPENAI_REPORT_MODEL`: Model identifier for visit report drafting (default: `gpt-4o-mini`).
- `FIELDTRACK_ENV`: Deployment environment identifier (`staging`).
- `SENTRY_DSN`: Error monitoring DSN for server and client error telemetry (optional in local dev, required for staging).

---

## 2. Supabase Staging Database & Migrations

Ensure migrations are applied strictly in source-controlled order:

1. **Verify Staging Project Region:**
   - Database region should match target operational geography (recommended: `ap-south-1` Mumbai for India teams, or customer data residency region).
2. **Review Migration SQL Sequence:**
   - `000001_init_orgs_and_memberships.sql`
   - `000002_field_operations_schema.sql`
   - `000003_auth_invitations_and_onboarding.sql`
   - `000004_transactional_trips_and_stores_rpcs.sql`
   - `000005_approval_inbox_and_atomic_decisions.sql`
   - `000006_visit_execution_and_evidence.sql`
   - `000007_trip_completion_and_reporting_indexes.sql`
   - `000008_ai_visit_report_drafts.sql`
   - `000009_in_app_notifications_and_read_receipts.sql`
   - `000010_security_hardening_rls_and_triggers.sql`
   - `000011_rate_limits.sql`
3. **Execute Post-Migration Verification SQL:**
   - Run `supabase/verification/post_release_verification.sql` to verify that RLS is enabled and forced on every table, no public triggers are missing, and no security exemptions exist.

---

## 3. Storage Bucket & Security Policies

1. **Create Staging Storage Bucket:**
   - Bucket name: `evidence`
   - Public access: **Disabled** (Private bucket)
2. **Verify Storage Authorization Policy:**
   - Storage path prefix must strictly conform to:
     `{organization_id}/{trip_stop_id}/{evidence_id}.{ext}`
   - Upload tickets are signed server-side with strict 15-minute expiration.
   - Enforce max file size: 10 MB (`10485760` bytes).
   - Enforce allowlisted MIME types: `image/jpeg`, `image/png`, `image/webp`.

---

## 4. Pre-Deployment Automated Quality Gates

Verify that all checks pass in the release pipeline before promoting to staging:

```bash
# 1. Format check
npm run format:check

# 2. Static code analysis
npm run lint

# 3. TypeScript type checking
npm run typecheck

# 4. Migration safety and policy linting
npm run lint:migrations

# 5. Unit test suite
npm run test:unit

# 6. Integration tests on isolated PostgreSQL
npm run test:integration

# 7. Production Next.js build
npm run build

# 8. Dependency vulnerability audit
npm audit --omit=dev --audit-level=high
```

---

## 5. Staging Smoke Test Verification

Execute the following manual smoke tests against the deployed staging URL:

| Test ID   | Workflow            | Action                                    | Expected Result                                                              |
| :-------- | :------------------ | :---------------------------------------- | :--------------------------------------------------------------------------- |
| **ST-01** | Auth & Registration | Sign up new test user                     | Redirects to Onboarding with auth session established                        |
| **ST-02** | Org Onboarding      | Create test organization                  | Org created, user assigned `admin` role, redirected to dashboard             |
| **ST-03** | Member Invitation   | Admin invites field employee              | Single-use invitation link generated with token hash                         |
| **ST-04** | Store Directory     | Manager creates new store                 | Store persisted with lat/lng, listed in store directory                      |
| **ST-05** | Trip Planning       | Employee creates draft trip               | Draft created with ordered stops, status is `draft`                          |
| **ST-06** | Trip Submission     | Employee submits trip                     | Status transitions to `submitted`, locked from employee edits                |
| **ST-07** | Self-Approval Block | Manager attempts to approve own trip      | UI displays self-approval block; backend RPC rejects action                  |
| **ST-08** | Peer Approval       | Peer manager reviews trip                 | Manager approves with note; status transitions to `approved`                 |
| **ST-09** | Visit Execution     | Employee checks in to stop                | Check-in recorded with UTC timestamp and unverified GPS                      |
| **ST-10** | Evidence Upload     | Employee uploads photo                    | Signed URL generated, file stored under tenant prefix, thumbnail displayed   |
| **ST-11** | Visit Checkout      | Employee completes checklist & checks out | Checklist validated; visit marked `submitted`                                |
| **ST-12** | AI Report Draft     | Manager requests AI summary               | Server verifies budget/quota, generates draft marked _requires human review_ |
| **ST-13** | Tenant Isolation    | Inspect Org B from Org A account          | Returns `404 Not Found` with zero tenant metadata leakage                    |

---

## 6. Rollback & Incident Response Plan

If any critical failure occurs during staging smoke testing:

1. **Traffic Rollback:**
   - In deployment hosting dashboard (e.g. Vercel), immediately roll back the deployment alias to the previous known-good deployment SHA.
2. **Disable AI Provider Calls:**
   - If AI quota or cost spike occurs, revoke or clear `OPENAI_API_KEY` in environment variables; the application automatically falls back to manual reporting without crashing.
3. **Disable Evidence Uploads:**
   - In Supabase dashboard, pause the `evidence` bucket or temporarily set upload size limit to 0 bytes.
4. **Database State Inspection:**
   - Inspect `rate_limit_buckets` and `trip_audit_events` for abnormal request bursts.
   - For database schema rollbacks, never run manual `DROP` scripts. Follow the down-migration steps detailed in `docs/release-process.md`.

---

## 7. Approval Sign-Off Gate

Staging deployment may proceed only after:

- [x] All 8 automated quality checks pass with 0 errors.
- [x] Post-release SQL verification script passes on migrated schema.
- [x] Required environment variables configured without secrets exposure.
- [x] Human QA / Owner sign-off recorded.
