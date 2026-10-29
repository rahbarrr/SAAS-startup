-- Restore documented access to the bounded pre-authentication rate limiter.
-- Migration 11 explicitly requires anon access for sign-in, sign-up, and recovery.
-- Direct client access to public.rate_limit_buckets remains denied by grants and RLS.

begin;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to anon, authenticated, service_role;

commit;
