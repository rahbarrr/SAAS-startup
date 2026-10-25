# FieldTrack — Current Blockers & Cloud Readiness Audit

**Date:** 2026-10-25 · **Baseline Commit:** `49e29dd` on `main` · **Target Staging Ref:** `lrolhonkrjhuwgnmcdsj`

---

## 1. Quality Gates: Actual Verified Results (Run in this Phase)

| Quality Gate              | Command Line                              | Actual Result | Verification Details                                                                         |
| :------------------------ | :---------------------------------------- | :-----------: | :------------------------------------------------------------------------------------------- |
| **Code Formatting**       | `npm run format:check`                    |   **PASS**    | 0 errors; all TypeScript, TSX, CSS, JSON, and Markdown files comply with Prettier.           |
| **Static Analysis**       | `npm run lint`                            |   **PASS**    | 0 errors, 0 warnings across entire `src/` directory.                                         |
| **Type Safety**           | `npm run typecheck`                       |   **PASS**    | 0 errors across TypeScript 5.8 `tsc --noEmit`.                                               |
| **Migration Safety Lint** | `npm run lint:migrations`                 |   **PASS**    | 12 versioned migrations verified: 0 errors, 0 warnings (RLS enabled, safe search paths).     |
| **Automated Test Suite**  | `npm test` (`vitest run`)                 |   **PASS**    | **24 test files passed, 259 tests passed (0 failures, 0 skipped)** in 4.17s.                 |
| **Production Build**      | `npm run build` (`next build`)            |   **PASS**    | Next.js 16.4.2 (Turbopack) compiled 20 application routes + `ƒ Proxy (Middleware)` in 556ms. |
| **Dependency Security**   | `npm audit --omit=dev --audit-level=high` |   **PASS**    | 0 vulnerabilities found.                                                                     |

---

## 2. Cloud Staging Blockers Audit

### Category A: External Cloud & Platform Blockers (Requires Owner Action)

| ID       | Blocker Item                                           | Verification Evidence                                                                                                                                                                                          | Current State & Impact                                                                                                                                                                                                                                                 | Action Required from Owner                                                                                                                                                                             |
| :------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B-01** | **Supabase Remote Database Migrations Unapplied**      | `npx supabase db push --dry-run` reports `ProjectRefNotLinkedError`. Live queries to `public.organizations` return 404.                                                                                        | **BLOCKING CLOUD DEPLOYMENT**<br>The 12 PostgreSQL migrations have been verified locally on PGlite WASM Postgres, but have **not** been applied to remote project `lrolhonkrjhuwgnmcdsj`. Live API requests will fail closed under rate limiting until migrations run. | Authenticate Supabase CLI (`npx supabase login`), link project (`npx supabase link --project-ref lrolhonkrjhuwgnmcdsj`), and run `npx supabase db push`.                                               |
| **B-02** | **Remote Storage Bucket `visit-evidence` Missing**     | Live HTTP probe to `https://lrolhonkrjhuwgnmcdsj.supabase.co/storage/v1/bucket/visit-evidence` with valid anon key returned HTTP 400: `{"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}`. | **BLOCKED / UNVERIFIED**<br>The required private storage bucket does not exist remotely. Photo evidence tickets and uploads cannot succeed in staging until created.                                                                                                   | Create private bucket `visit-evidence` (max 10MB; allowed MIME types: `image/jpeg`, `image/png`, `image/webp`) in the Supabase Dashboard, or verify migration 2 creates it once migrations are pushed. |
| **B-03** | **Supabase CLI Runner Authentication**                 | Runner environment lacks interactive TTY and `SUPABASE_ACCESS_TOKEN`. `supabase link` cannot authenticate autonomously.                                                                                        | **BLOCKED IN RUNNER**<br>Autonomous agents cannot apply migrations without cloud credentials.                                                                                                                                                                          | Owner must execute migrations from their local authenticated terminal or provide `SUPABASE_ACCESS_TOKEN` in CI/CD.                                                                                     |
| **B-04** | **Supabase Auth Email Delivery / Autoconfirm**         | Live signup requires email confirmation. External SMTP provider is not wired.                                                                                                                                  | **BLOCKING STAGING AUTH**<br>Test users cannot sign in after registration unless email is verified.                                                                                                                                                                    | In Supabase Dashboard -> **Authentication -> Providers -> Email**, enable **Enable Email Autoconfirm** for staging testing, or configure SMTP credentials.                                             |
| **B-05** | **Supabase Auth Redirect URLs**                        | Canonical staging domain is not allow-listed in remote GoTrue settings.                                                                                                                                        | **POTENTIAL AUTH REDIRECT BLOCKER**<br>Password recovery and signup callbacks will be rejected by Supabase Auth if the redirect origin is untrusted.                                                                                                                   | In Supabase Dashboard -> **Authentication -> URL Configuration**, set **Site URL** to the staging domain and add exact redirect URL `https://<staging-domain>/auth/callback`.                          |
| **B-06** | **Vercel Project Association & Environment Variables** | No `.vercel/` link exists; Vercel CLI is not installed locally; no preview deployment exists.                                                                                                                  | **BLOCKING PREVIEW HOSTING**<br>Application is ready to deploy, but host project is not linked.                                                                                                                                                                        | Link GitHub repository to Vercel, configure staging environment variables from `.env.example`, and trigger a Preview build.                                                                            |

---

## 3. Local Verification vs. Remote Cloud Testing Matrix

| Capability / Invariant                                    |         Verified Locally (PGlite & Unit Tests)          | Verified on Remote Cloud (`lrolhonkrjhuwgnmcdsj`) |   Status    |
| :-------------------------------------------------------- | :-----------------------------------------------------: | :-----------------------------------------------: | :---------: |
| **12 Schema Migrations Syntax & Safety**                  |       **YES** (migration lint & PGlite execution)       |            **NO** (unapplied remotely)            | **BLOCKED** |
| **Row-Level Security (RLS) on 100% of Tables**            |       **YES** (`FORCE ROW LEVEL SECURITY` tested)       |       **NO** (tables not present remotely)        | **BLOCKED** |
| **Multi-Tenant Isolation (2 Orgs)**                       |       **YES** (cross-tenant tests return 0 rows)        |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Self-Approval Ban (4 Layers)**                          |         **YES** (RPC + trigger + service + UI)          |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Audit Trail Immutability**                              |       **YES** (superuser updates/deletes blocked)       |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Anon Privilege Revocation (Mig 12)**                    |     **YES** (anon cannot read tables or call RPCs)      |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Rate Limiter RPC (`consume_rate_limit`)**               |         **YES** (fixed window counter verified)         |        **NO** (returns PGRST202 remotely)         | **BLOCKED** |
| **Point-in-Time Geolocation Consent**                     |             **YES** (W3C Geolocation mock)              |     **NO** (requires physical mobile device)      | **BLOCKED** |
| **Checklist Completion Validation**                       |          **YES** (premature checkout blocked)           |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Evidence Storage Path Sandboxing**                      |        **YES** (path regex constraint verified)         |      **NO** (bucket does not exist remotely)      | **BLOCKED** |
| **AI Visit Report Drafting**                              | **YES** (`requiresHumanReview=true`, quotas, injection) |   **NO** (mock provider in tests; spend capped)   | **BLOCKED** |
| **CSV Formula Injection Prevention**                      |        **YES** (OWASP prefix escaping verified)         |        **NO** (requires remote staging DB)        | **BLOCKED** |
| **Real GoTrue User Trigger (`handle_auth_user_created`)** |              **YES** (emulated in PGlite)               |      **NO** (untested on real Supabase Auth)      | **BLOCKED** |
| **Session Cookie Exchange via Proxy / Middleware**        |         **YES** (fail-closed middleware tested)         |      **NO** (requires deployed HTTPS origin)      | **BLOCKED** |

---

## 4. Environment Variable Verification (No Secrets Printed)

All staging environment variables defined in `.env.example` have been verified for purpose, privacy boundary, and presence:

- `NEXT_PUBLIC_SUPABASE_URL`: Public. Must equal `https://lrolhonkrjhuwgnmcdsj.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public. Client anon key.
- `NEXT_PUBLIC_APP_URL`: Public. Canonical staging preview origin (HTTPS strictly enforced).
- `APP_ENV`: Server-only. Must equal `staging`.
- `EXPECTED_SUPABASE_PROJECT_REF`: Server-only. Must equal `lrolhonkrjhuwgnmcdsj`.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only secret. Not required for standard client operations; used only for administrative migration verification.
- `AI_REPORTS_ENABLED`: Server-only kill switch (`true` / `false`).
- `UPLOADS_ENABLED`: Server-only kill switch (`true` / `false`).
- `OPENAI_API_KEY`: Server-only secret. Optional for staging; leave unset to test graceful manual report fallback.
- `OPENAI_REPORT_MODEL`: Server-only. Required if `OPENAI_API_KEY` is provided (`gpt-4o-mini`).
- `OPENAI_REQUEST_TIMEOUT_MS`: Server-only optional override (`15000`).
- `OPENAI_MAX_OUTPUT_TOKENS`: Server-only optional token cap (`1200`).

---

## 5. Ordered Action Plan for Repository Owner

To transition FieldTrack from local verification to a fully functional staging environment, the repository owner must execute these steps in exact order:

1. **Step 1: Authenticate and Link Supabase CLI:**
   ```bash
   npx supabase login
   npx supabase link --project-ref lrolhonkrjhuwgnmcdsj
   ```
2. **Step 2: Preview and Apply Migrations:**
   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```
3. **Step 3: Run Post-Release Verification SQL:**
   - Open Supabase SQL Editor for `lrolhonkrjhuwgnmcdsj`.
   - Run `supabase/verification/post-release.sql` to confirm RLS is active on 100% of tables and anon privileges are revoked.
4. **Step 4: Provision Private Storage Bucket & Auth Settings:**
   - Confirm private bucket `visit-evidence` exists (or create it with 10MB limit and MIME restrictions).
   - In Supabase Auth -> Providers -> Email, enable **Enable Email Autoconfirm** for testing.
   - In Supabase Auth -> URL Configuration, set **Site URL** to the staging domain and add `https://<staging-domain>/auth/callback`.
5. **Step 5: Configure Vercel and Deploy Preview Build:**
   - Import repository into Vercel.
   - Set staging environment variables from `.env.example` targeting **Preview**.
   - Trigger a Preview deployment and verify the 17 smoke tests in `STAGING_CHECKLIST.md`.
