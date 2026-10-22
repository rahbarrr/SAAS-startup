-- Post-release verification: fails (non-zero exit with ON_ERROR_STOP) if invariants are broken.
-- Read-only: performs no writes.
do $$
declare
  v_missing text;
begin
  -- 1. Every public table must have RLS enabled AND forced.
  select string_agg(c.relname, ', ')
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and (not c.relrowsecurity or not c.relforcerowsecurity);
  if v_missing is not null then
    raise exception 'Tables without enabled+forced RLS: %', v_missing;
  end if;

  -- 2. Core security functions must exist.
  perform 'public.is_active_org_member(uuid)'::regprocedure;
  perform 'public.has_active_org_role(uuid, public.org_role[])'::regprocedure;
  perform 'public.consume_rate_limit(text, text, integer, integer)'::regprocedure;
  perform 'public.decide_submitted_trip(uuid, uuid, public.trip_status, text, jsonb)'::regprocedure;

  -- 3. Audit immutability trigger must be present.
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.trip_audit_events'::regclass
      and t.tgname = 'trg_trip_audit_events_invariants'
      and not t.tgisinternal
  ) then
    raise exception 'trip_audit_events immutability trigger is missing';
  end if;

  -- 4. The rate-limit table must not be directly writable via policies.
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rate_limit_buckets'
  ) then
    raise exception 'rate_limit_buckets must have no RLS policies';
  end if;
end;
$$;

select 'post-release verification passed' as result;
