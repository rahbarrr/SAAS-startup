-- Reconciles the first of two reversible checks made directly in the hosted database.
-- The following migration restores the documented anon grant needed for pre-login
-- sign-in, sign-up, and recovery throttling. The rate-limit table itself remains private.

begin;

revoke execute on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to authenticated, service_role;

commit;
