-- Migration: 20261022000007_trip_completion_and_reporting_indexes.sql
-- Purpose:
--   1. Enforce the documented trip completion rule in `public.check_out_visit(...)`:
--      - When the first stop on an `approved` trip is checked out (or checked in), the trip
--        transitions to `in_progress` (`trip_started`).
--      - When all planned stops on an `approved` or `in_progress` trip have been checked out
--        (`trip_stops.status = 'visited'`), the parent trip automatically transitions to
--        `completed` and records `trip_completed` in `public.trip_audit_events`.
--   2. Add composite indexes for manager dashboard aggregation and filtering.

begin;

-- 1. Indexes for Manager Dashboard & Reporting Queries
create index if not exists idx_visits_org_status_checkin
  on public.visits (organization_id, status, checked_in_at desc, id desc);

create index if not exists idx_visit_checklist_org_visit_flags
  on public.visit_checklist_items (organization_id, visit_id, flagged, required, completed_at);

-- 2. Update `public.check_in_trip_stop` to transition `approved` trip -> `in_progress` on first check-in
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

  select *
    into v_stop
    from public.trip_stops s
   where s.id = p_trip_stop_id
     and s.organization_id = p_org_id
     for update;

  if not found then
    raise exception 'Trip stop not found in organization' using errcode = 'P0002';
  end if;

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

  if v_trip.status = 'approved' then
    update public.trips
       set status = 'in_progress'
     where id = v_trip.id
       and organization_id = p_org_id;

    insert into public.trip_audit_events (
      organization_id,
      trip_id,
      actor_user_id,
      event_type,
      old_status,
      new_status,
      note,
      metadata,
      created_at
    ) values (
      p_org_id,
      v_trip.id,
      v_caller_uid,
      'trip_started',
      'approved',
      'in_progress',
      'Field employee checked in to first trip stop',
      '{"source": "rpc"}'::jsonb,
      clock_timestamp()
    );
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

-- 3. Update `public.check_out_visit` to automatically complete the parent trip when all stops are visited
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
  v_stop public.trip_stops;
  v_trip public.trips;
  v_remaining_planned integer;
  v_total_stops integer;
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
     and s.organization_id = p_org_id
  returning * into v_stop;

  select *
    into v_trip
    from public.trips t
   where t.id = v_stop.trip_id
     and t.organization_id = p_org_id
     for update;

  select count(*)::integer,
         count(*) filter (where s.status = 'planned')::integer
    into v_total_stops, v_remaining_planned
    from public.trip_stops s
   where s.organization_id = p_org_id
     and s.trip_id = v_trip.id;

  if v_total_stops > 0 and v_remaining_planned = 0 and v_trip.status in ('approved', 'in_progress') then
    update public.trips
       set status = 'completed'
     where id = v_trip.id
       and organization_id = p_org_id;

    insert into public.trip_audit_events (
      organization_id,
      trip_id,
      actor_user_id,
      event_type,
      old_status,
      new_status,
      note,
      metadata,
      created_at
    ) values (
      p_org_id,
      v_trip.id,
      v_caller_uid,
      'trip_completed',
      v_trip.status,
      'completed',
      'All planned trip stops checked out',
      jsonb_build_object('source', 'rpc', 'stop_count', v_total_stops),
      clock_timestamp()
    );
  end if;

  return v_updated;
end;
$$;

commit;
