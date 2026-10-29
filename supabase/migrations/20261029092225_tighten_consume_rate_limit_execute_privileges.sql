-- Reconciles the first of two reversible checks made directly in the hosted database.
-- The next migration restores the documented anon grant needed for pre-login
-- sign-in, sign-up, and recovery throttling. The rate-limit table remains private.

begin;

revoke execute on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to authenticated;

-- Supabase has this role in hosted projects; local PGlite integration tests do not.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role';
  end if;
end;
$$;

commit;
