# Release process: production-controlled

Nothing in this repository automatically applies database migrations to production. Production database releases require a deliberate, manual, owner-approved action.

## 1. Environments

| Environment | Purpose | Database | Data |
|---|---|---|---|
| Local development | Build features and run automated checks | Local Supabase or isolated development project | Test data only |
| Production | Live FieldTrack service | Production Supabase project | Real organization and customer data |

Vercel may create Preview deployments for branch or pull-request review. Do not attach production credentials to preview builds; keep credentials and data isolated from Production.

Application startup validation accepts `APP_ENV=development` locally and `APP_ENV=production` for the live site. Hosted deployments must set `EXPECTED_SUPABASE_PROJECT_REF` to match the Supabase project URL. Production configuration is rejected inside Vercel Preview deployments.

## 2. Automated workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| CI | Pull requests and pushes to `main` | Formatting, lint, typecheck, migration safety lint, unit tests, integration tests (in-process PGlite), dependency audit, and production build |
| Migration review | Pull requests changing `supabase/migrations/**` | Prevents editing or deleting previously applied migrations; runs migration safety lint and produces a security-review summary |
| Production database release | Manual dispatch only | Dry-run against the selected production project, then waits for required reviewer approval before applying migrations and running post-release verification |

Application deployment is handled by the connected Vercel Git integration. A successful application build does not prove database migrations or customer workflows succeeded.

## 3. Database migration rules

- The source of truth is `supabase/migrations/`. Treat applied migrations as immutable; make corrections in a new, reviewed migration.
- Run `npm run lint:migrations` and `npm run test:integration` before releasing SQL.
- Never run destructive SQL or apply migrations to a cloud database until the project reference has been independently checked.
- Never auto-apply migrations as part of an application build.
- Before production migration, verify the backup/PITR plan, review the exact dry-run output, and record a rollback or forward-fix plan.

## 4. Backups and restore

- Verify the actual Supabase plan and backup/PITR configuration before relying on it.
- A database backup does not include uploaded Storage objects. Maintain a separate, access-controlled backup/export plan for evidence files.
- Restore to a new project for verification; never test restore procedures over the live production project.
- Run `supabase/verification/post-release.sql` after a database release and record results.

## 5. Observability

Structured logs use request IDs and redact tokens, email addresses, sensitive notes, coordinates, storage paths, and signed URLs. No external error-monitoring provider is currently assumed to be configured; verify alerting in the hosting dashboard.

## 6. Owner-controlled production configuration

1. Protect `main` by requiring the CI check and appropriate review before merging.
2. Store production database credentials and project reference only in the GitHub `production-plan` and `production` environments as required by `.github/workflows/production-db-release.yml`.
3. Configure only production values under Vercel's Production environment. Keep privileged keys server-only.
4. Confirm redirects, private evidence storage, backups, and usage/spend caps before onboarding real customers.

## 7. Production database release checklist

Before release:
- [ ] CI passes on the exact release commit.
- [ ] SQL changes and RLS/policy/grant statements have been reviewed.
- [ ] A verified backup/PITR reference is available.
- [ ] The migration dry-run output targets the intended production project.
- [ ] A forward-fix or restore plan is recorded.
- [ ] Owner approval has been obtained.

During release:
- [ ] Use the manual Production database release workflow.
- [ ] Review the dry-run before approving the protected apply step.
- [ ] Confirm migrations and `supabase/verification/post-release.sql` succeed.

After release:
- [ ] Verify the production deployment commit and health endpoint.
- [ ] Smoke-test login, workspace onboarding, trip creation, approvals, visit check-in/out, evidence upload, and tenant isolation with an authorized test organization.
- [ ] Inspect runtime logs and record any remaining limitations.

## 8. Rollback and incident response

1. For an application-only issue, roll back the Vercel application deployment to the last known-good build.
2. For migration issues, prefer a reviewed forward-fix migration. Never edit an applied migration.
3. For data corruption, suspend affected writes and restore to a new project; cut over only after verification and explicit owner approval.
4. For a security incident, contain the issue, rotate potentially exposed credentials, review audit/log records, and record a post-incident note with a regression test.
