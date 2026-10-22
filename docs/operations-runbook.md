# FieldTrack Operations Runbook: Backup, Restore & Incident Response

> Status: **draft procedures, not yet exercised.** No restore drill has been performed. Nothing here
> is a compliance claim; legal/privacy obligations need qualified review.

## 1. Backup & restore

| Item | Procedure | Owner action required |
|---|---|---|
| Postgres data | Enable Supabase daily backups; enable Point-in-Time Recovery (PITR) on production (paid plan). | Confirm plan/PITR in dashboard. |
| Storage (`visit-evidence`) | Supabase DB backups do **not** include storage objects. Schedule a periodic export of the bucket to separate private object storage. | Choose destination; not automated yet. |
| Migrations | `supabase/migrations/` in Git is the schema source of truth. | None. |
| Secrets | Held in the hosting provider / Supabase secret stores, never in Git. | Keep an access-controlled inventory. |

**Restore drill (run before launch, then quarterly):**
1. Restore the latest backup/PITR point into a *new* Supabase project (never over production).
2. Apply any migrations newer than the backup; run `npm test` against the schema.
3. Verify: row counts for `organizations`, `trips`, `visits`, `trip_audit_events`; spot-check RLS as a
   non-admin user; fetch one evidence object via a signed URL.
4. Record time-to-restore and data-loss window (RPO/RTO) here.

Targets (proposed, unvalidated): RPO ≤ 24h without PITR (minutes with PITR); RTO ≤ 4h.

## 2. Incident response basics

**Severity:** SEV1 = confirmed cross-tenant data exposure, credential leak, or data loss.
SEV2 = auth/role bypass without confirmed exploitation. SEV3 = other security bug.

**Steps:**
1. **Detect & triage**: record time, reporter, affected tenants, suspected data classes.
2. **Contain**: disable affected feature (e.g. set `ai_report_drafts_enabled = false`, suspend an organization via `organizations.status`), revoke sessions, rotate exposed keys.
3. **Rotate secrets** if exposure is possible: Supabase service-role/anon keys & JWT secret, `OPENAI_API_KEY`, any hosting tokens. Redeploy.
4. **Investigate**: review `trip_audit_events` (append-only), Supabase Auth/API/Postgres logs, hosting logs.
5. **Remediate**: fix, add a regression test, ship via migration/PR.
6. **Notify**: affected customers and regulators **as required by applicable law and contracts**. Deadlines
   and thresholds vary by jurisdiction. Obtain legal advice; do not assume.
7. **Post-incident review**: timeline, root cause, follow-ups, within 5 business days.

## 3. Known gaps (tracked)
- No rate limiting on auth, invitations, uploads, AI drafts (per-user).
- No automated storage backup or restore drill yet.
- No application access-log table for manager views of employee data.
- Retention/deletion policy for visits, evidence and audit events undefined (legal input needed).
