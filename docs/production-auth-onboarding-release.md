# Production auth and onboarding release runbook

The production project `lrolhonkrjhuwgnmcdsj` was verified at migration
`20261025000014`. The application requires the company-profile onboarding RPC
and columns introduced by migration 17, plus the transactional invitation
creation changes in migrations 18 and 19, so the release must use the approved
database release workflow. Do not run ad-hoc SQL from a local shell pointed at
an unknown project.

## Before approval

1. Confirm the Supabase project reference and release target in the deployment
   system.
2. Review migrations 15, 16, 17, 18, 19, and this repository's migration safety lint.
   Migration 17 does not depend on application code from 15 or 16, but the
   normal ordered release applies all pending migrations. Confirm that the
   geofencing and billing changes are approved before proceeding.
3. Confirm that GitHub Actions has the `PRODUCTION_DB_URL`,
   `PRODUCTION_SUPABASE_ACCESS_TOKEN`, and
   `PRODUCTION_SUPABASE_DB_PASSWORD` secrets, and that
   `PRODUCTION_SUPABASE_PROJECT_REF` points to `lrolhonkrjhuwgnmcdsj`.
4. The protected apply job will create a private PostgreSQL backup artifact and
   verify that it contains `organizations`, `organization_members`,
   `profiles`, and `organization_invitations` before schema changes. It fails
   closed if the dump cannot be created, verified, or uploaded.
5. The workflow checks for duplicate pending invitations before applying the
   unique index. Resolve any existing duplicates through the approved release
   process; do not delete records ad hoc.

## Backup and release

The Supabase Free plan does not include scheduled project backups. The protected
workflow creates a PostgreSQL custom-format `pg_dump` artifact after production
reviewer approval but **before any migration is applied**. It verifies that the
dump is readable and contains the four core organization tables, computes a
SHA-256 digest, uploads the dump as a private GitHub Actions artifact, and
retains it for seven days. Download and preserve it securely if longer
retention is required. A missing database URL or failed backup check stops the
release before schema changes.

1. Apply pending migrations through the protected release workflow with the
   required manual approval; do not mark migrations as applied manually. The
   external backup/PITR reference is optional because the workflow creates its
   own verified backup artifact.
2. Verify migration history reaches `20261029000019` (and the current release
   head) and confirm these objects exist:
   `organizations.industry`, `organizations.company_size`,
   `organization_subscriptions`, and
   `create_organization_with_company_profile(text,text,text,text,text,text,text)`,
   `create_organization_invitation(uuid,text,org_role,text,timestamptz,text)`,
   `claim_organization_invitation_email(uuid,uuid)`,
   `record_organization_invitation_email(uuid,uuid,boolean,text,text)`, and the
   one-pending-invitation unique index.
3. Run the repository migration lint, typecheck, unit tests, integration tests,
   and production build.
4. Smoke-test Google sign-in with a test account, complete company onboarding,
   refresh the browser, and verify that the account returns to the created
   workspace. Do not use production customer records as fixtures.

If the migration approval is not granted, leave production unchanged and use
the fallback invitation/signup link behavior while the release is reviewed.
