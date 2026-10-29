# Google OAuth onboarding release

## Required Vercel Production values

Set these values in Vercel project `saas-startup1` for the Production
environment:

```text
APP_ENV=production
EXPECTED_SUPABASE_PROJECT_REF=lrolhonkrjhuwgnmcdsj
NEXT_PUBLIC_APP_URL=https://saas-startup1.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://lrolhonkrjhuwgnmcdsj.supabase.co
```

Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the existing public key for this
project. Do not print or replace it with a service-role/secret key. The
production `NEXT_PUBLIC_APP_URL` must be the canonical HTTPS URL above; local
development may use `http://localhost:3000` in the local environment only.

## Safe database release

The live project was verified at migration `20261025000014` and is missing
migration 17's company columns and onboarding RPC. Migration 15 (geofencing)
and migration 16 (billing/subscriptions) both depend on the schema through
migration 14, but neither depends on the other or on migration 17. Migration
17 depends on the base organizations/auth schema. The repository's production
workflow applies all pending migrations with `supabase db push`, so do not
run it until migrations 15 and 16 have received separate product/database
approval.

Before any approved release:

1. Take a backup/export using the approved Supabase or PostgreSQL procedure.
2. Verify the export completed and contains `organizations`,
   `organization_members`, `profiles`, and `organization_invitations`.
3. Record the backup reference and rollback/forward-fix plan.
4. Dispatch `.github/workflows/production-db-release.yml` with the release tag,
   backup reference, rollback plan, and exact confirmation text required by the
   workflow.
5. Review the dry-run output, then obtain the `production` environment
   approval. Never mark migrations as applied manually.
6. Confirm the post-release verification reports the onboarding RPC and
   `organizations.industry` / `organizations.company_size`.

Do not change billing plans, provider credentials, OAuth secrets, or production
data as part of this fix.
