-- migration-review: anon-grant-approved
-- Restore documented access to the bounded pre-authentication rate limiter.
-- Migration 11 explicitly requires anon access for sign-in, sign-up, and recovery.
-- The function allow-lists scopes, bounds quotas/windows, hashes the subject, and
-- has been verified not to allow anon direct table access. RLS stays enabled with no policies.

begin;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to anon, authenticated, service_role;

commit;
