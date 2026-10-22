-- Migration: 20261022000010_security_hardening_rls_and_triggers.sql
-- Purpose: Phase 10 security review remediations for confirmed database/RLS/storage findings:
--   1. [SEC-002] Harden `public.visits` RLS policy (`visits_update_owner_or_reviewer`) and
--      trigger (`public.enforce_visit_lifecycle_invariants`) so:
--      - A manager/admin cannot self-review their own visit (`employee_user_id <> auth.uid()`).
--      - Transitioning `'submitted'` -> `'reviewed'` requires active `admin` or `manager` role
--        in both RLS and trigger.
--      - Check-in location/timestamps are immutable after check-in, and checkout timestamps,
--        coordinates, and employee notes are immutable once a visit is `'submitted'` or `'reviewed'`.
--   2. [SEC-003] Harden `public.trip_stops` RLS policy (`trip_stops_update_owner`) and add trigger
--      `public.enforce_trip_stops_mutation_guard()` so authenticated clients cannot directly
--      mutate planned stops (`store_id`, `sequence_number`, `planned_at`) on an already
--      `approved` or `in_progress` trip without going through the re-approval workflow.
--   3. [SEC-004] Tighten `visit_evidence_storage_select` on `storage.objects` via
--      `public.can_read_visit_evidence_storage` so field employees can only read storage objects
--      for their own visits (while active managers/admins can read within their organization).
--   4. [SEC-005] Add `public.enforce_profile_identity_immutability()` trigger on `public.profiles`
--      so authenticated users cannot spoof another user's email address via direct profile UPDATE.
--   5. [SEC-007] Enforce a per-user organization creation cap (max 10 organizations created per user)
--      inside `public.create_organization_with_owner` to prevent tenant-creation abuse.

begin;

-- ============================================================================
-- 1. [SEC-002] Harden `public.visits` RLS and Lifecycle Trigger
-- ============================================================================
drop policy if exists visits_update_owner_or_reviewer on public.visits;

create policy visits_update_owner_or_reviewer
  on public.visits
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = auth.uid() and status = 'in_progress')
      or (
        employee_user_id <> auth.uid()
        and status = 'submitted'
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
      )
    )
  )
  with check (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = auth.uid() and status in ('in_progress', 'submitted'))
      or (
        employee_user_id <> auth.uid()
        and status = 'reviewed'
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
      )
    )
  );

create or replace function public.enforce_visit_lifecycle_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip_id uuid;
  v_trip_status public.trip_status;
  v_trip_owner uuid;
  v_incomplete_required_count integer;
  v_caller_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    select s.trip_id, t.status, t.owner_user_id
      into v_trip_id, v_trip_status, v_trip_owner
      from public.trip_stops s
      join public.trips t
        on t.id = s.trip_id
       and t.organization_id = s.organization_id
     where s.id = new.trip_stop_id
       and s.organization_id = new.organization_id;

    if not found then
      raise exception 'Trip stop not found in organization'
        using errcode = 'P0002';
    end if;

    if v_trip_status not in ('approved', 'in_progress') then
      raise exception 'Cannot check in to a stop unless its parent trip is approved or in_progress (current trip status: %)', v_trip_status
        using errcode = '22023';
    end if;

    if new.employee_user_id <> v_trip_owner then
      raise exception 'Only the assigned trip owner employee can check in to this trip stop'
        using errcode = '42501';
    end if;

    if v_caller_uid is not null and new.employee_user_id <> v_caller_uid then
      raise exception 'Authenticated user must match visit employee_user_id'
        using errcode = '42501';
    end if;

    if new.status <> 'in_progress' or new.checked_out_at is not null then
      raise exception 'New visits must start in in_progress status without a checkout timestamp'
        using errcode = '22023';
    end if;

    new.checked_in_at := coalesce(new.checked_in_at, clock_timestamp());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id
       or new.trip_stop_id <> old.trip_stop_id
       or new.employee_user_id <> old.employee_user_id then
      raise exception 'Visit organization_id, trip_stop_id, and employee_user_id are immutable'
        using errcode = '42501';
    end if;

    -- Check-in timestamp and initial check-in telemetry are immutable once recorded
    if old.checked_in_at is not null and new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'Visit checked_in_at timestamp is immutable once recorded'
        using errcode = '22023';
    end if;

    if new.check_in_lat is distinct from old.check_in_lat
       or new.check_in_lng is distinct from old.check_in_lng
       or new.check_in_accuracy_m is distinct from old.check_in_accuracy_m
       or new.check_in_location_status is distinct from old.check_in_location_status
       or new.check_in_idempotency_key is distinct from old.check_in_idempotency_key then
      raise exception 'Visit check-in telemetry and idempotency key are immutable once recorded'
        using errcode = '22023';
    end if;

    if old.status in ('submitted', 'reviewed') then
      -- Only allow an active manager/admin (who is NOT the visit employee) to transition 'submitted' -> 'reviewed'
      if not (old.status = 'submitted' and new.status = 'reviewed') then
        raise exception 'Visit in % status is locked and cannot be modified', old.status
          using errcode = '22023';
      end if;

      if v_caller_uid is not null then
        if old.employee_user_id = v_caller_uid then
          raise exception 'Self-review is forbidden: visit employee cannot mark their own visit as reviewed'
            using errcode = '42501';
        end if;

        if not public.has_active_org_role(
          new.organization_id,
          array['admin', 'manager']::public.org_role[]
        ) then
          raise exception 'Only an active manager or admin can mark a submitted visit as reviewed'
            using errcode = '42501';
        end if;
      end if;

      -- Historical checkout timestamps, coordinates, and employee field notes cannot be altered during review
      if new.checked_out_at is distinct from old.checked_out_at
         or new.check_out_lat is distinct from old.check_out_lat
         or new.check_out_lng is distinct from old.check_out_lng
         or new.check_out_accuracy_m is distinct from old.check_out_accuracy_m
         or new.check_out_location_status is distinct from old.check_out_location_status
         or new.check_out_idempotency_key is distinct from old.check_out_idempotency_key
         or new.notes is distinct from old.notes then
        raise exception 'Submitted visit timestamps, location telemetry, and employee notes are immutable during review'
          using errcode = '22023';
      end if;

      return new;
    end if;

    -- Prevent another employee or manager from editing an in_progress visit or checking it out
    if v_caller_uid is not null
       and old.status = 'in_progress'
       and old.employee_user_id <> v_caller_uid then
      raise exception 'Only the assigned visit employee can edit or check out this visit'
        using errcode = '42501';
    end if;

    -- Checkout transition ('in_progress' -> 'submitted')
    if old.status = 'in_progress' and new.status = 'submitted' then
      if old.checked_in_at is null then
        raise exception 'Cannot check out a visit before check-in'
          using errcode = '22023';
      end if;

      select count(*)::integer
        into v_incomplete_required_count
        from public.visit_checklist_items c
       where c.organization_id = new.organization_id
         and c.visit_id = new.id
         and c.required = true
         and c.completed_at is null;

      if v_incomplete_required_count > 0 then
        raise exception 'Cannot check out while % required checklist item(s) remain incomplete', v_incomplete_required_count
          using errcode = '22023';
      end if;

      new.checked_out_at := coalesce(new.checked_out_at, clock_timestamp());
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 2. [SEC-003] Harden `public.trip_stops` Against Direct Edits on Approved Trips
-- ============================================================================
drop policy if exists trip_stops_update_owner on public.trip_stops;

create policy trip_stops_update_owner
  on public.trip_stops
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.trips t
      where t.id = public.trip_stops.trip_id
        and t.organization_id = public.trip_stops.organization_id
        and t.owner_user_id = auth.uid()
        and t.status in ('draft', 'changes_requested')
    )
  )
  with check (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.trips t
      where t.id = public.trip_stops.trip_id
        and t.organization_id = public.trip_stops.organization_id
        and t.owner_user_id = auth.uid()
        and t.status in ('draft', 'changes_requested')
    )
  );

create or replace function public.enforce_trip_stops_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip_status public.trip_status;
begin
  if new.organization_id <> old.organization_id
     or new.trip_id <> old.trip_id then
    raise exception 'trip_stops organization_id and trip_id are immutable'
      using errcode = '42501';
  end if;

  select t.status
    into v_trip_status
    from public.trips t
   where t.id = new.trip_id
     and t.organization_id = new.organization_id;

  -- If the parent trip is outside editable planning states ('draft', 'changes_requested'),
  -- only `status` may transition (e.g., 'planned' -> 'visited' via check_out_visit RPC).
  if v_trip_status not in ('draft', 'changes_requested') then
    if new.store_id is distinct from old.store_id
       or new.sequence_number is distinct from old.sequence_number
       or new.planned_at is distinct from old.planned_at then
      raise exception 'Planned stop store, sequence, and schedule cannot be modified while trip is in % status without reopening the trip for approval', v_trip_status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trip_stops_mutation_guard on public.trip_stops;
create trigger trg_trip_stops_mutation_guard
before update on public.trip_stops
for each row execute function public.enforce_trip_stops_mutation_guard();

-- ============================================================================
-- 3. [SEC-004] Tighten Intra-Tenant `storage.objects` SELECT Policy for Evidence
-- ============================================================================
create or replace function public.can_read_visit_evidence_storage(
  target_org_id uuid,
  target_visit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.visits v
    where v.id = target_visit_id
      and v.organization_id = target_org_id
      and public.is_active_org_member(target_org_id)
      and (
        v.employee_user_id = auth.uid()
        or public.has_active_org_role(
          target_org_id,
          array['admin', 'manager']::public.org_role[]
        )
      )
  );
$$;

revoke all on function public.can_read_visit_evidence_storage(uuid, uuid) from public;
grant execute on function public.can_read_visit_evidence_storage(uuid, uuid) to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    execute $policy$
      drop policy if exists visit_evidence_storage_select on storage.objects;
      create policy visit_evidence_storage_select
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'visit-evidence'
          and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and public.can_read_visit_evidence_storage(
            (split_part(name, '/', 1))::uuid,
            (split_part(name, '/', 2))::uuid
          )
        );
    $policy$;
  end if;
end;
$$;

-- ============================================================================
-- 4. [SEC-005] Prevent Authenticated Users from Spoofing `public.profiles.email`
-- ============================================================================
create or replace function public.enforce_profile_identity_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'Profile id and created_at are immutable'
      using errcode = '42501';
  end if;

  -- When called by an authenticated client session, email cannot be directly edited in public.profiles
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'Profile email is synchronized from authentication records and cannot be modified directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_immutable_identity on public.profiles;
create trigger trg_profiles_immutable_identity
before update on public.profiles
for each row execute function public.enforce_profile_identity_immutability();

-- ============================================================================
-- 5. [SEC-007] Cap Per-User Organization Creation in `create_organization_with_owner`
-- ============================================================================
create or replace function public.create_organization_with_owner(
  p_name text,
  p_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_created_count integer;
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null then
    raise exception 'Authenticated user record not found' using errcode = '42501';
  end if;

  -- Prevent unbounded organization creation abuse by a single account
  select count(*)::integer
    into v_created_count
    from public.organizations o
   where o.created_by = v_user_id;

  if v_created_count >= 10 then
    raise exception 'Organization creation limit reached for this account (maximum 10 organizations)'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email)
  values (v_user_id, lower(trim(v_email)))
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, status, created_by)
  values (trim(p_name), lower(trim(p_slug)), 'active', v_user_id)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org.id, v_user_id, 'admin', 'active');

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

commit;
