# Production auth and onboarding release runbook

The production project `lrolhonkrjhuwgnmcdsj` was verified at migration
`20261025000014`. The application requires the company-profile onboarding RPC
and columns introduced by migration 17, so the release must use the approved
database release workflow. Do not run ad-hoc SQL from a local shell pointed at
an unknown project.

## Before approval

1. Confirm the Supabase project reference and release target in the deployment
   system.
2. Export a schema/data backup using the approved Supabase or `pg_dump`
   procedure, with credentials supplied only through the secret manager.
3. Verify the backup by checking that the export completed successfully and
   contains `organizations`, `organization_members`, `profiles`, and
   `organization_invitations`. Record the backup/export identifier in the
   release ticket. A backup must not be described as complete until this check
   passes.
4. Review migrations 15, 16, 17, and this repository's migration safety lint.
   Migration 17 does not depend on application code from 15 or 16, but the
   normal ordered release will apply all pending migrations. Confirm that the
   geofencing and billing changes are approved before proceeding.

## Release and verification

1. Apply pending migrations through the protected release workflow with the
   required manual approval; do not mark migrations as applied manually.
2. Verify migration history reaches `20261028000017` (and the current release
   head) and confirm these objects exist:
   `organizations.industry`, `organizations.company_size`,
   `organization_subscriptions`, and
   `create_organization_with_company_profile(text,text,text,text,text,text,text)`.
3. Run the repository migration lint, typecheck, unit tests, integration tests,
   and production build.
4. Smoke-test Google sign-in with a test account, complete company onboarding,
   refresh the browser, and verify that the account returns to the created
   workspace. Do not use production customer records as fixtures.

If the migration approval is not granted, leave production unchanged and use
the fallback invitation/signup link behavior while the release is reviewed.
