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

  -- Company onboarding must be present before the web deployment is promoted.
  perform 'public.create_organization_with_company_profile(text, text, text, text, text, text, text)'::regprocedure;
  perform 'public.create_organization_invitation(uuid, text, public.org_role, text, timestamptz, text)'::regprocedure;
  perform 'public.claim_organization_invitation_email(uuid, uuid)'::regprocedure;
  perform 'public.record_organization_invitation_email(uuid, uuid, boolean, text, text)'::regprocedure;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'industry'
  ) then
    raise exception 'organizations.industry is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'company_size'
  ) then
    raise exception 'organizations.company_size is missing';
  end if;
  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and tablename = 'organization_invitations'
       and indexname = 'organization_invitations_one_pending_per_email_idx'
  ) then
    raise exception 'organization_invitations pending uniqueness index is missing';
  end if;

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

  -- 5. Anon cannot EXECUTE any public function except consume_rate_limit.
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_missing
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.proname <> 'consume_rate_limit'
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_missing is not null then
    raise exception 'Public functions executable by anon: %', v_missing;
  end if;

  -- 6. Anon holds no SELECT/INSERT/UPDATE/DELETE privileges on public tables.
  select string_agg(c.relname, ', ')
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and (
       has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
       or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE')
     );
  if v_missing is not null then
    raise exception 'Public tables accessible by anon: %', v_missing;
  end if;
end;
$$;

select 'post-release verification passed' as result;
