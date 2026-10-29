-- migration-review: anon-grant-approved
-- Restore documented access to the bounded pre-authentication rate limiter.
-- Migration 11 requires anon access for sign-in, sign-up, and recovery.
-- The function allow-lists scopes, bounds quotas/windows, and hashes subjects.
-- The rate-limit table remains private (RLS enabled, no policies/client grants).

begin;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to anon, authenticated;

-- Supabase has this role in hosted projects; local PGlite integration tests do not.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role';
  end if;
end;
$$;

commit;
