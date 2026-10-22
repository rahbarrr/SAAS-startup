-- Migration: 20261022000006_visit_execution_and_evidence.sql
-- Purpose:
--   1. Add unverified device-reported location telemetry metadata (`check_in_accuracy_m`,
--      `check_in_location_status`, `check_out_accuracy_m`, `check_out_location_status`)
--      and idempotency keys (`check_in_idempotency_key`, `check_out_idempotency_key`) to `public.visits`.
--   2. Add `idempotency_key` to `public.visit_evidence`.
--   3. Prevent duplicate active visits per employee and duplicate visits per trip stop via
--      unique indexes (`idx_visits_one_visit_per_trip_stop`, `idx_visits_one_active_per_employee`).
--   4. Add database trigger `trg_visits_lifecycle_invariants` and atomic RPCs
--      (`public.check_in_trip_stop`, `public.check_out_visit`) to enforce:
--      - Check-in only on stops belonging to an `approved` or `in_progress` trip owned by the employee
--      - Server-captured check-in/out timestamps
--      - No checkout before check-in or while required checklist items are incomplete
--      - No edits by another employee
--      - Safe idempotent retries for check-in and check-out.

begin;

-- 1. Extend `public.visits` with unverified location metadata and idempotency keys
alter table public.visits
  add column if not exists check_in_accuracy_m double precision null,
  add column if not exists check_in_location_status text not null default 'unavailable',
  add column if not exists check_out_accuracy_m double precision null,
  add column if not exists check_out_location_status text not null default 'unavailable',
  add column if not exists check_in_idempotency_key text null,
  add column if not exists check_out_idempotency_key text null;

alter table public.visits
  drop constraint if exists visits_checkin_lat_lng_pair_chk,
  add constraint visits_checkin_lat_lng_pair_chk check (
    (check_in_lat is null and check_in_lng is null)
    or (check_in_lat is not null and check_in_lng is not null)
  ),
  drop constraint if exists visits_checkout_lat_lng_pair_chk,
  add constraint visits_checkout_lat_lng_pair_chk check (
    (check_out_lat is null and check_out_lng is null)
    or (check_out_lat is not null and check_out_lng is not null)
  ),
  drop constraint if exists visits_checkin_accuracy_chk,
  add constraint visits_checkin_accuracy_chk check (
    check_in_accuracy_m is null or (check_in_accuracy_m >= 0 and check_in_accuracy_m <= 100000)
  ),
  drop constraint if exists visits_checkout_accuracy_chk,
  add constraint visits_checkout_accuracy_chk check (
    check_out_accuracy_m is null or (check_out_accuracy_m >= 0 and check_out_accuracy_m <= 100000)
  ),
  drop constraint if exists visits_checkin_location_status_chk,
  add constraint visits_checkin_location_status_chk check (
    check_in_location_status in ('captured_unverified', 'permission_denied', 'unavailable')
  ),
  drop constraint if exists visits_checkout_location_status_chk,
  add constraint visits_checkout_location_status_chk check (
    check_out_location_status in ('captured_unverified', 'permission_denied', 'unavailable')
  );

-- 2. Unique indexes preventing duplicate visits per stop and concurrent active visits per employee
create unique index if not exists idx_visits_one_visit_per_trip_stop
  on public.visits (organization_id, trip_stop_id);

create unique index if not exists idx_visits_one_active_per_employee
  on public.visits (organization_id, employee_user_id)
  where status = 'in_progress';

create unique index if not exists idx_visits_checkin_idempotency
  on public.visits (organization_id, trip_stop_id, check_in_idempotency_key)
  where check_in_idempotency_key is not null;

create unique index if not exists idx_visits_checkout_idempotency
  on public.visits (organization_id, id, check_out_idempotency_key)
  where check_out_idempotency_key is not null;

-- 3. Add idempotency key to `public.visit_evidence`
alter table public.visit_evidence
  add column if not exists idempotency_key text null;

create unique index if not exists idx_visit_evidence_idempotency
  on public.visit_evidence (organization_id, visit_id, idempotency_key)
  where idempotency_key is not null;

-- 4. Trigger enforcing visit lifecycle invariants, approved-trip requirement, and owner-only edits
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

    if old.checked_in_at is not null and new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'Visit checked_in_at timestamp is immutable once recorded'
        using errcode = '22023';
    end if;

    if old.status in ('submitted', 'reviewed') then
      -- Only allow a manager/admin to transition 'submitted' -> 'reviewed'
      if not (old.status = 'submitted' and new.status = 'reviewed') then
        raise exception 'Visit in % status is locked and cannot be modified', old.status
          using errcode = '22023';
      end if;
    end if;

    -- Prevent another employee from editing an in_progress visit or checking it out
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

drop trigger if exists trg_visits_lifecycle_invariants on public.visits;
create trigger trg_visits_lifecycle_invariants
before insert or update on public.visits
for each row execute function public.enforce_visit_lifecycle_invariants();

-- 5. Atomic Check-In RPC with Idempotency Key Support
create or replace function public.check_in_trip_stop(
  p_org_id uuid,
  p_trip_stop_id uuid,
  p_idempotency_key text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_location_status text default 'unavailable'
)
returns public.visits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_stop public.trip_stops;
  v_trip public.trips;
  v_existing public.visits;
  v_created public.visits;
  v_clean_idem text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_active_org_member(p_org_id) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;

  -- Lock the stop row to serialize concurrent check-in attempts
  select *
    into v_stop
    from public.trip_stops s
   where s.id = p_trip_stop_id
     and s.organization_id = p_org_id
     for update;

  if not found then
    raise exception 'Trip stop not found in organization' using errcode = 'P0002';
  end if;

  -- Lock the parent trip row
  select *
    into v_trip
    from public.trips t
   where t.id = v_stop.trip_id
     and t.organization_id = p_org_id
     for update;

  if v_trip.owner_user_id <> v_caller_uid then
    raise exception 'Only the assigned trip owner employee can check in to this trip stop'
      using errcode = '42501';
  end if;

  -- Check if a visit already exists for this stop (idempotent retry vs duplicate check-in)
  select *
    into v_existing
    from public.visits v
   where v.organization_id = p_org_id
     and v.trip_stop_id = p_trip_stop_id;

  if found then
    if v_clean_idem is not null
       and v_existing.check_in_idempotency_key = v_clean_idem
       and v_existing.employee_user_id = v_caller_uid then
      return v_existing;
    end if;

    raise exception 'Duplicate check-in: a visit has already been started for this stop'
      using errcode = '23505';
  end if;

  if v_trip.status not in ('approved', 'in_progress') then
    raise exception 'Cannot check in to a stop unless its parent trip is approved or in_progress (current status: %)', v_trip.status
      using errcode = '22023';
  end if;

  insert into public.visits (
    organization_id,
    trip_stop_id,
    employee_user_id,
    checked_in_at,
    check_in_lat,
    check_in_lng,
    check_in_accuracy_m,
    check_in_location_status,
    check_in_idempotency_key,
    status
  ) values (
    p_org_id,
    p_trip_stop_id,
    v_caller_uid,
    clock_timestamp(),
    p_lat,
    p_lng,
    p_accuracy_m,
    coalesce(p_location_status, 'unavailable'),
    v_clean_idem,
    'in_progress'
  )
  returning * into v_created;

  -- Seed standard required store audit checklist items for the new visit
  insert into public.visit_checklist_items (
    organization_id,
    visit_id,
    question_key,
    label,
    answer_type,
    required
  ) values
    (p_org_id, v_created.id, 'shelf_planogram_compliant', 'Primary shelf display matches current planogram', 'boolean', true),
    (p_org_id, v_created.id, 'promo_signage_visible', 'Promotional price tags and POS signage are visible', 'boolean', true),
    (p_org_id, v_created.id, 'out_of_stock_count', 'Number of out-of-stock SKUs observed', 'number', false)
  on conflict (visit_id, question_key) do nothing;

  return v_created;
end;
$$;

revoke all on function public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text) from public;
grant execute on function public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text) to authenticated;

-- 6. Atomic Check-Out RPC with Idempotency Key Support
create or replace function public.check_out_visit(
  p_org_id uuid,
  p_visit_id uuid,
  p_notes text default null,
  p_idempotency_key text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_location_status text default 'unavailable'
)
returns public.visits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_visit public.visits;
  v_updated public.visits;
  v_clean_idem text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_active_org_member(p_org_id) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;

  select *
    into v_visit
    from public.visits v
   where v.id = p_visit_id
     and v.organization_id = p_org_id
     for update;

  if not found then
    raise exception 'Visit not found in organization' using errcode = 'P0002';
  end if;

  if v_visit.employee_user_id <> v_caller_uid then
    raise exception 'Only the assigned visit employee can check out this visit'
      using errcode = '42501';
  end if;

  -- Safe idempotent retry if already checked out with the same idempotency key
  if v_visit.status = 'submitted'
     and v_clean_idem is not null
     and v_visit.check_out_idempotency_key = v_clean_idem then
    return v_visit;
  end if;

  if v_visit.status <> 'in_progress' then
    raise exception 'Visit is already in % status and cannot be checked out again', v_visit.status
      using errcode = '40001';
  end if;

  update public.visits v
     set status = 'submitted',
         checked_out_at = clock_timestamp(),
         notes = coalesce(p_notes, v.notes),
         check_out_lat = p_lat,
         check_out_lng = p_lng,
         check_out_accuracy_m = p_accuracy_m,
         check_out_location_status = coalesce(p_location_status, 'unavailable'),
         check_out_idempotency_key = v_clean_idem
   where v.id = p_visit_id
     and v.organization_id = p_org_id
     and v.status = 'in_progress'
  returning * into v_updated;

  update public.trip_stops s
     set status = 'visited'
   where s.id = v_visit.trip_stop_id
     and s.organization_id = p_org_id;

  return v_updated;
end;
$$;

revoke all on function public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text) from public;
grant execute on function public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text) to authenticated;

commit;
