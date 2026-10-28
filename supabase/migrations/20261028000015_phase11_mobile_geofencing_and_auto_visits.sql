-- Migration: 20261028000015_phase11_mobile_geofencing_and_auto_visits.sql
-- Purpose:
--   1. Extend `public.visits` with event source tracking (`check_in_source`, `check_out_source`),
--      device-side timestamps (`check_in_device_timestamp`, `check_out_device_timestamp`),
--      verification statuses (`verification_status`, `verification_notes`), and geofence radius.
--   2. Create `public.visit_geofence_events` for append-only audit & sync logs of native geofence
--      entry/exit telemetry events with composite same-org foreign keys, RLS policies, and
--      server-side idempotency.
--   3. Extend `check_in_trip_stop`, `check_out_visit`, and `enforce_visit_lifecycle_invariants`
--      to record and protect event sources and device timestamps.

begin;

-- 1. Extend `public.visits` with event source and verification metadata
alter table public.visits
  add column if not exists check_in_source text not null default 'manual',
  add column if not exists check_out_source text not null default 'manual',
  add column if not exists check_in_device_timestamp timestamptz null,
  add column if not exists check_out_device_timestamp timestamptz null,
  add column if not exists verification_status text not null default 'verified',
  add column if not exists verification_notes text null,
  add column if not exists geofence_radius_meters double precision null;

alter table public.visits
  drop constraint if exists visits_check_in_source_chk,
  add constraint visits_check_in_source_chk check (
    check_in_source in ('manual', 'automatic_geofence')
  ),
  drop constraint if exists visits_check_out_source_chk,
  add constraint visits_check_out_source_chk check (
    check_out_source in ('manual', 'automatic_geofence')
  ),
  drop constraint if exists visits_verification_status_chk,
  add constraint visits_verification_status_chk check (
    verification_status in ('verified', 'pending_review', 'manual_override')
  ),
  drop constraint if exists visits_geofence_radius_chk,
  add constraint visits_geofence_radius_chk check (
    geofence_radius_meters is null or (geofence_radius_meters >= 10 and geofence_radius_meters <= 1000)
  );

-- 2. Create `public.visit_geofence_events` with composite same-org foreign keys
create table if not exists public.visit_geofence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  trip_stop_id uuid not null,
  store_id uuid not null,
  employee_user_id uuid not null,
  visit_id uuid null references public.visits(id) on delete set null,
  event_type text not null,
  client_event_id text not null,
  device_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision null,
  geofence_radius_meters double precision not null default 120,
  dwell_time_seconds integer null,
  status text not null default 'processed',
  rejection_reason text null,
  created_at timestamptz not null default now(),
  constraint visit_geofence_events_same_org_trip_fk
    foreign key (trip_id, organization_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint visit_geofence_events_same_org_stop_fk
    foreign key (trip_stop_id, organization_id)
    references public.trip_stops (id, organization_id)
    on delete cascade,
  constraint visit_geofence_events_same_org_store_fk
    foreign key (store_id, organization_id)
    references public.stores (id, organization_id)
    on delete cascade,
  constraint visit_geofence_events_same_org_member_fk
    foreign key (organization_id, employee_user_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade,
  constraint visit_geofence_events_event_type_chk check (
    event_type in ('geofence_entry', 'geofence_exit')
  ),
  constraint visit_geofence_events_status_chk check (
    status in ('processed', 'pending_review', 'rejected', 'duplicate')
  ),
  constraint visit_geofence_events_lat_chk check (latitude >= -90 and latitude <= 90),
  constraint visit_geofence_events_lng_chk check (longitude >= -180 and longitude <= 180),
  constraint visit_geofence_events_accuracy_chk check (
    accuracy_meters is null or (accuracy_meters >= 0 and accuracy_meters <= 100000)
  ),
  constraint visit_geofence_events_radius_chk check (
    geofence_radius_meters >= 10 and geofence_radius_meters <= 1000
  ),
  constraint visit_geofence_events_dwell_chk check (
    dwell_time_seconds is null or (dwell_time_seconds >= 0 and dwell_time_seconds <= 86400)
  )
);

create unique index if not exists idx_visit_geofence_events_idempotency
  on public.visit_geofence_events (organization_id, client_event_id);

create index if not exists idx_visit_geofence_events_org_stop
  on public.visit_geofence_events (organization_id, trip_stop_id, created_at desc);

create index if not exists idx_visit_geofence_events_org_employee
  on public.visit_geofence_events (organization_id, employee_user_id, created_at desc);

alter table public.visit_geofence_events enable row level security;
alter table public.visit_geofence_events force row level security;

-- Immutability invariant trigger for geofence event logs
create or replace function public.enforce_visit_geofence_events_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'visit_geofence_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_visit_geofence_events_invariants() from public, anon, authenticated;

drop trigger if exists trg_enforce_visit_geofence_invariants on public.visit_geofence_events;
create trigger trg_enforce_visit_geofence_invariants
before update or delete on public.visit_geofence_events
for each row execute function public.enforce_visit_geofence_events_invariants();

-- RLS policies for visit_geofence_events
drop policy if exists "visit_geofence_events_select" on public.visit_geofence_events;
create policy "visit_geofence_events_select"
on public.visit_geofence_events
for select
to authenticated
using (
  public.has_active_org_role(organization_id, array['admin', 'manager']::public.org_role[])
  or (employee_user_id = auth.uid() and public.is_active_org_member(organization_id))
);

drop policy if exists "visit_geofence_events_insert" on public.visit_geofence_events;
create policy "visit_geofence_events_insert"
on public.visit_geofence_events
for insert
to authenticated
with check (
  employee_user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

revoke all on table public.visit_geofence_events from anon;
grant select, insert on public.visit_geofence_events to authenticated;

-- 3. Harden `enforce_visit_lifecycle_invariants` to protect event source & device timestamps
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
       or new.check_in_idempotency_key is distinct from old.check_in_idempotency_key
       or new.check_in_source is distinct from old.check_in_source
       or new.check_in_device_timestamp is distinct from old.check_in_device_timestamp
       or new.geofence_radius_meters is distinct from old.geofence_radius_meters then
      raise exception 'Visit check-in telemetry, source, and idempotency key are immutable once recorded'
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

      -- Historical checkout timestamps, coordinates, sources, and employee field notes cannot be altered during review
      if new.checked_out_at is distinct from old.checked_out_at
         or new.check_out_lat is distinct from old.check_out_lat
         or new.check_out_lng is distinct from old.check_out_lng
         or new.check_out_accuracy_m is distinct from old.check_out_accuracy_m
         or new.check_out_location_status is distinct from old.check_out_location_status
         or new.check_out_idempotency_key is distinct from old.check_out_idempotency_key
         or new.check_out_source is distinct from old.check_out_source
         or new.check_out_device_timestamp is distinct from old.check_out_device_timestamp
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

revoke all on function public.enforce_visit_lifecycle_invariants() from public, anon, authenticated;

-- 4. Update atomic check_in_trip_stop with source, device timestamp, and radius
drop function if exists public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text);
create or replace function public.check_in_trip_stop(
  p_org_id uuid,
  p_trip_stop_id uuid,
  p_idempotency_key text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_location_status text default 'unavailable',
  p_source text default 'manual',
  p_device_timestamp timestamptz default null,
  p_radius_m double precision default null,
  p_verification_status text default 'verified',
  p_verification_notes text default null
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

  if v_trip.status not in ('approved', 'in_progress') then
    raise exception 'Cannot check in to a stop unless its parent trip is approved or in_progress (current status: %)', v_trip.status
      using errcode = '40001';
  end if;

  select *
    into v_existing
    from public.visits v
   where v.trip_stop_id = p_trip_stop_id
     and v.organization_id = p_org_id;

  if found then
    if v_clean_idem is not null
       and v_existing.check_in_idempotency_key = v_clean_idem
       and v_existing.employee_user_id = v_caller_uid then
      return v_existing;
    end if;

    raise exception 'Duplicate check-in: a visit has already been started for this stop'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.visits v
     where v.organization_id = p_org_id
       and v.employee_user_id = v_caller_uid
       and v.status = 'in_progress'
       and v.trip_stop_id <> p_trip_stop_id
  ) then
    raise exception 'Another visit is already in progress for this employee'
      using errcode = '40001';
  end if;

  if v_trip.status = 'approved' then
    update public.trips t
       set status = 'in_progress'
     where t.id = v_trip.id
       and t.organization_id = p_org_id;
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
    check_in_source,
    check_in_device_timestamp,
    geofence_radius_meters,
    verification_status,
    verification_notes,
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
    coalesce(p_source, 'manual'),
    p_device_timestamp,
    p_radius_m,
    coalesce(p_verification_status, 'verified'),
    p_verification_notes,
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

revoke all on function public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text, text, timestamptz, double precision, text, text) from public, anon;
grant execute on function public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text, text, timestamptz, double precision, text, text) to authenticated;

-- 5. Update atomic check_out_visit with source, device timestamp, and verification
drop function if exists public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text);
create or replace function public.check_out_visit(
  p_org_id uuid,
  p_visit_id uuid,
  p_notes text default null,
  p_idempotency_key text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_location_status text default 'unavailable',
  p_source text default 'manual',
  p_device_timestamp timestamptz default null,
  p_verification_status text default null,
  p_verification_notes text default null
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
         check_out_idempotency_key = v_clean_idem,
         check_out_source = coalesce(p_source, v.check_out_source),
         check_out_device_timestamp = coalesce(p_device_timestamp, v.check_out_device_timestamp),
         verification_status = coalesce(p_verification_status, v.verification_status),
         verification_notes = coalesce(p_verification_notes, v.verification_notes)
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

revoke all on function public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text, text, timestamptz, text, text) to authenticated;

commit;
