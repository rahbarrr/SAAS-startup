# Release process: staging-first

> Nothing in this repository deploys to production, changes DNS, publishes an app, or creates paid
> resources on its own. Every production step below is a **manual, owner-approved action**.
> No compliance framework (GDPR, DPDP, SOC 2, ISO 27001, …) is claimed by these controls.

## 1. Environments

| | Local | Preview (per PR) | Staging | Production |
|---|---|---|---|---|
| Purpose | development | review a PR | pre-release verification | customers |
| `APP_ENV` | `development` | `staging` | `staging` | `production` |
| Supabase project | local/dev | **staging project** | **staging project** | **separate production project** |
| Data | seed only | non-production only | non-production only | real |
| Credentials | `.env.local` | host "Preview" env vars (staging values) | host "Staging/Preview" vars | host "Production" vars only |
| AI provider key | optional | staging key with low spend cap | staging key with low spend cap | production key |

Rules enforced in code (`src/lib/env/startup.ts`, run from `src/instrumentation.ts`):
- Server refuses to start if required variables are invalid. Errors list variable **names only**.
- In `staging`/`production`, `EXPECTED_SUPABASE_PROJECT_REF` is required and must match the
  `NEXT_PUBLIC_SUPABASE_URL` host, so staging credentials cannot silently run as production (and vice versa).
- `APP_ENV=production` inside a Vercel preview deployment is rejected.

## 2. Pipeline

| Stage | File | Trigger | What it does |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | every PR + push to `main` | format check, lint, typecheck, migration safety lint, unit tests, integration tests (in-process PGlite, no network/secrets), `npm audit --omit=dev --audit-level=high`, production build |
| Migration review | `.github/workflows/migration-review.yml` | PRs touching `supabase/migrations/**` | blocks edits/deletes of existing migrations, runs safety lint, prints an RLS/policy/grant/SECURITY DEFINER summary + reviewer checklist |
| Staging DB | `.github/workflows/staging-db.yml` | push to `main` touching migrations, or manual | dry-run then `supabase db push` to the **staging** project |
| Production DB | `.github/workflows/production-db-release.yml` | **manual only** | `plan` (dry-run) → reviewer approval via `production` Environment → apply → `supabase/verification/post-release.sql` |

Preview deployments for PRs come from the hosting provider's Git integration (see §8), not from a workflow.

## 3. Migrations

- Source of truth: `supabase/migrations/` (timestamped, append-only; CI rejects edits to existing files).
- `npm run lint:migrations` flags: DROP TABLE/SCHEMA/COLUMN, TRUNCATE, DISABLE RLS, DELETE without WHERE,
  grants to `anon`, `SECURITY DEFINER` without `search_path`, and new public tables without RLS. Each risky
  statement needs an explicit `-- migration-review: <marker>` comment so a human consciously approves it.
  **The lint does not replace reading the SQL.**
- Every migration is exercised by the PGlite integration suite (`npm run test:integration`).

## 4. Backups, retention, restore testing

Proposed policy (confirm against the actual Supabase plan before relying on it; these are not guarantees):

| Item | Frequency | Retention | Notes |
|---|---|---|---|
| Postgres automated backups | daily (plan-dependent) | per plan (verify; commonly 7 days on Pro) | Free tier has no backups. |
| Point-in-Time Recovery | continuous (paid add-on) | per add-on setting | **Paid.** Needs owner approval; recommended for production. |
| Pre-release backup | before **every** production migration | until next successful release + 30 days | Record id/timestamp in the release workflow input. |
| Storage bucket `visit-evidence` | weekly export to separate private storage (not automated yet) | 30 days (proposal) | DB backups do not contain objects. |
| Restore test | before launch, then quarterly | log kept in this repo/wiki | See below. |

**Restore test:** restore the latest backup/PITR point into a *new* project (never over production) →
run `supabase/verification/post-release.sql` → spot-check RLS as a non-admin user → fetch one evidence
object via signed URL → record time-to-restore and data-loss window. **No restore test has been performed yet.**

## 5. Observability

- **Structured logs:** `src/lib/observability/logger.ts` emits JSON lines with `requestId`; keys/values for
  tokens, emails, notes, captions, coordinates/accuracy, addresses, prompts, storage paths and signed URLs
  are redacted; JWT/OpenAI-key/hex-secret/email patterns are redacted in free text. Log IDs, not content.
- **Correlation IDs:** middleware accepts a well-formed inbound `x-request-id` (otherwise generates one),
  forwards it to server code and returns it on every response. Quote it in support requests.
- **Unhandled errors:** `jsonError` calls `captureException` (redacted log line + optional reporter).
- **Error monitoring provider: NOT CONNECTED.** `src/lib/observability/error-reporting.ts` is a provider-agnostic
  hook. To enable Sentry (or equivalent) the owner must create the account/project (may be a paid plan),
  supply a DSN as a server secret, and register a reporter via `setErrorReporter`. Until then, alerts
  rely on host/log-drain alerting you configure yourself.

## 6. Abuse, rate limits, AI budgets

- Postgres rate limiter (`supabase/migrations/20261022000011_rate_limits.sql`, `src/lib/rate-limit`):
  | Scope | Default | Subject |
  |---|---|---|
  | `auth_sign_in` | 10 / 5 min | client IP and email (separately) |
  | `auth_sign_up` | 5 / hour | client IP |
  | `auth_recovery` | 5 / hour | client IP and email |
  | `ai_draft` | 10 / hour | user id |
  | `upload` | 60 / hour | user id |
  Fails **closed** (limiter outage → request rejected). IP comes from proxy headers; confirm your host sets
  `x-forwarded-for` trustworthily. Subjects are stored only as MD5 hashes. These are throttles, not DDoS protection.
- AI cost control, evaluated **before** the provider call: global kill switch → per-user rate limit →
  org feature flag → org daily draft quota (`ai_daily_draft_quota`, default `0` = off). The quota check is not atomic, so
  concurrent requests may slightly exceed it. The platform-level spend cap on the OpenAI account is the real
  hard stop and must be set by the owner.

## 7. Disabling AI or uploads during an incident

| Action | How | Speed |
|---|---|---|
| Disable AI everywhere | set `AI_REPORTS_ENABLED=false` in the host env and redeploy | minutes |
| Disable AI for one org | `update organizations set ai_report_drafts_enabled = false where id = '<org>'` | immediate |
| Disable uploads everywhere | set `UPLOADS_ENABLED=false` and redeploy (blocks ticket + confirm) | minutes |
| Stop AI spend completely | revoke/rotate `OPENAI_API_KEY` at the provider | immediate |
| Freeze a tenant | `update organizations set status = 'suspended' where id = '<org>'` | immediate |
| Block bucket access | remove storage SELECT/INSERT policies on `storage.objects` via a reviewed migration, or pause the project | minutes |

## 8. Owner configuration required (not done by this repo)

1. **GitHub:** enable branch protection on `main` (require CI + Code Owners review); create Environments
   `staging`, `production-plan` and `production` (add **required reviewers** on `production`).
2. **Secrets/variables:** `STAGING_SUPABASE_ACCESS_TOKEN`, `STAGING_SUPABASE_DB_PASSWORD`, var
   `STAGING_SUPABASE_PROJECT_REF`; `PRODUCTION_SUPABASE_ACCESS_TOKEN`, `PRODUCTION_SUPABASE_DB_PASSWORD`,
   `PRODUCTION_DB_URL`, var `PRODUCTION_SUPABASE_PROJECT_REF`. Workflows fail with a clear message if missing.
3. **Supabase:** create a staging project (non-production data only) and a production project. **Region:**
   choose deliberately and record the decision. For India-based teams the source report suggests Mumbai
   (`ap-south-1`); confirm it is offered for your plan at creation time and check customer/data-residency
   requirements with qualified advisers. The region cannot be changed later without migrating data. Configure Auth
   redirect URLs (exact origins, no wildcards) per environment.
4. **Hosting (e.g. Vercel):** connect the repo; Preview env vars → staging Supabase values only; Production env
   vars → production values only; set `APP_ENV`, `EXPECTED_SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_APP_URL`.
   Do not add the production domain/DNS until approved.
5. **Monitoring:** choose and connect an error-monitoring provider (§5); set billing/spend caps on OpenAI.
6. **Backups:** confirm plan, enable PITR if approved, schedule storage exports, run the first restore test.

## 9. Production deployment checklist

Pre-release
- [ ] CI green on the release commit; `npm audit --omit=dev --audit-level=high` clean
- [ ] Migration PR(s) reviewed line by line, including every RLS/policy/grant change
- [ ] Same migrations already applied to **staging** and smoke-tested there
- [ ] Staging verification passed: sign-in, org switch, trip → approval, visit check-in/out, evidence upload, CSV export, AI draft (if enabled)
- [ ] Backup/PITR point taken; reference recorded
- [ ] Rollback/forward-fix plan written for these migrations (see §10)
- [ ] Release tag `vX.Y.Z` created
- [ ] Owner approval to proceed obtained and recorded

Release
- [ ] Run **Production database release** (inputs: tag, backup ref, rollback plan, confirmation)
- [ ] Review the `plan` dry-run output; approve the `production` environment gate
- [ ] `apply` job and `post-release.sql` verification succeed
- [ ] Deploy the app build for the same tag from the hosting provider

Post-release
- [ ] Smoke checks on production using a test organization
- [ ] Watch error rate, auth failures, `RATE_LIMITED` volume, AI usage for 1 hour
- [ ] Announce completion; record release notes

## 10. Rollback plan

1. **App-only problem:** redeploy the previous application build (host "instant rollback"). Migrations are additive
   and old code should tolerate new nullable columns/functions; verify this per release.
2. **Migration problem:** prefer a **forward-fix migration**. Down-migrations are not maintained. Never edit an applied migration.
3. **Data corruption / destructive error:** disable writes (`UPLOADS_ENABLED=false`, suspend affected orgs, maintenance
   mode), restore backup/PITR into a *new* project, validate with `post-release.sql`, then cut over per owner decision
   (credential/URL swap). Expect data loss since the restore point.
4. **Security issue:** follow `docs/operations-runbook.md` (contain, rotate secrets, investigate, notify per legal advice).
5. After any rollback: write a post-incident note and add a regression test.
