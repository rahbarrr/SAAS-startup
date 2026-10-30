-- Migration: 20261030000020_live_location_and_store_geofences.sql
-- Purpose:
--   1. Create `public.store_geofences` for configurable per-store geofence boundaries.
--   2. Create `public.trip_tracking_sessions` for explicit opt-in employee live tracking.
--   3. Create `public.location_events` for append-only raw location updates with speed/heading.
--   4. Create `public.latest_employee_locations` for fast live map queries and Realtime publication.
--   5. Create `public.geofence_events` for normalized native geofence telemetry with RLS.
--   6. Enforce RLS, composite multi-tenant constraints, and append-only triggers.

begin;

-- ============================================================================
-- 1. store_geofences
-- ============================================================================
create table if not exists public.store_geofences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_m double precision not null default 150.0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_geofences_same_org_store_fk
    foreign key (store_id, org_id)
    references public.stores (id, organization_id)
    on delete cascade,
  constraint store_geofences_org_store_unique unique (org_id, store_id),
  constraint store_geofences_lat_chk check (latitude >= -90 and latitude <= 90),
  constraint store_geofences_lng_chk check (longitude >= -180 and longitude <= 180),
  constraint store_geofences_radius_chk check (radius_m >= 10.0 and radius_m <= 2000.0)
);

create index if not exists idx_store_geofences_org_enabled
  on public.store_geofences (org_id, enabled);

alter table public.store_geofences enable row level security;
alter table public.store_geofences force row level security;

create or replace function public.set_store_geofences_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_geofences_updated_at on public.store_geofences;
create trigger trg_store_geofences_updated_at
before update on public.store_geofences
for each row execute function public.set_store_geofences_updated_at();

revoke all on function public.set_store_geofences_updated_at() from public, anon, authenticated;

-- RLS: all active members can read geofences in their organization; managers/admins can write
drop policy if exists "store_geofences_select_org_members" on public.store_geofences;
create policy "store_geofences_select_org_members"
on public.store_geofences
for select
to authenticated
using (
  public.is_active_org_member(org_id)
);

drop policy if exists "store_geofences_write_managers_admins" on public.store_geofences;
create policy "store_geofences_write_managers_admins"
on public.store_geofences
for all
to authenticated
using (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
)
with check (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
);

grant select, insert, update, delete on public.store_geofences to authenticated;
revoke all on public.store_geofences from anon;


-- ============================================================================
-- 2. trip_tracking_sessions
-- ============================================================================
create table if not exists public.trip_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  employee_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  consent_recorded_at timestamptz not null default now(),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint trip_tracking_sessions_same_org_trip_fk
    foreign key (trip_id, org_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint trip_tracking_sessions_same_org_member_fk
    foreign key (org_id, employee_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade,
  constraint trip_tracking_sessions_status_chk check (
    status in ('active', 'stopped', 'completed', 'expired')
  ),
  constraint trip_tracking_sessions_time_order_chk check (
    ended_at is null or ended_at >= started_at
  )
);

create index if not exists idx_trip_tracking_sessions_org_employee_status
  on public.trip_tracking_sessions (org_id, employee_id, status);

create index if not exists idx_trip_tracking_sessions_org_trip
  on public.trip_tracking_sessions (org_id, trip_id);

alter table public.trip_tracking_sessions enable row level security;
alter table public.trip_tracking_sessions force row level security;

-- RLS: Employees can view their own sessions and create/update their own. Managers/Admins can read all.
drop policy if exists "trip_tracking_sessions_select" on public.trip_tracking_sessions;
create policy "trip_tracking_sessions_select"
on public.trip_tracking_sessions
for select
to authenticated
using (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
  or (
    employee_id = auth.uid()
    and public.is_active_org_member(org_id)
  )
);

drop policy if exists "trip_tracking_sessions_insert_own" on public.trip_tracking_sessions;
create policy "trip_tracking_sessions_insert_own"
on public.trip_tracking_sessions
for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.is_active_org_member(org_id)
);

drop policy if exists "trip_tracking_sessions_update_own" on public.trip_tracking_sessions;
create policy "trip_tracking_sessions_update_own"
on public.trip_tracking_sessions
for update
to authenticated
using (
  employee_id = auth.uid()
  and public.is_active_org_member(org_id)
)
with check (
  employee_id = auth.uid()
  and public.is_active_org_member(org_id)
);

grant select, insert, update on public.trip_tracking_sessions to authenticated;
revoke all on public.trip_tracking_sessions from anon;


-- ============================================================================
-- 3. location_events (append-only)
-- ============================================================================
create table if not exists public.location_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  employee_id uuid not null,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy_m double precision null check (accuracy_m is null or accuracy_m >= 0),
  speed_mps double precision null check (speed_mps is null or speed_mps >= 0),
  heading double precision null check (heading is null or (heading >= 0 and heading <= 360)),
  recorded_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  source text not null default 'mobile_foreground',
  created_at timestamptz not null default now(),
  constraint location_events_same_org_trip_fk
    foreign key (trip_id, org_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint location_events_same_org_member_fk
    foreign key (org_id, employee_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade,
  constraint location_events_source_chk check (
    source in ('mobile_foreground', 'mobile_background', 'manual_refresh', 'geofence_trigger')
  )
);

create index if not exists idx_location_events_org_trip_recorded
  on public.location_events (org_id, trip_id, recorded_at desc);

create index if not exists idx_location_events_org_employee_recorded
  on public.location_events (org_id, employee_id, recorded_at desc);

alter table public.location_events enable row level security;
alter table public.location_events force row level security;

-- Immutability trigger for location_events
create or replace function public.enforce_location_events_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'location_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_location_events_invariants on public.location_events;
create trigger trg_enforce_location_events_invariants
before update or delete on public.location_events
for each row execute function public.enforce_location_events_invariants();

revoke all on function public.enforce_location_events_invariants() from public, anon, authenticated;

-- RLS: Employees can view their own and insert their own; Managers/Admins can select
drop policy if exists "location_events_select" on public.location_events;
create policy "location_events_select"
on public.location_events
for select
to authenticated
using (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
  or (
    employee_id = auth.uid()
    and public.is_active_org_member(org_id)
  )
);

drop policy if exists "location_events_insert_own" on public.location_events;
create policy "location_events_insert_own"
on public.location_events
for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.is_active_org_member(org_id)
);

grant select, insert on public.location_events to authenticated;
revoke all on public.location_events from anon;


-- ============================================================================
-- 4. latest_employee_locations
-- ============================================================================
create table if not exists public.latest_employee_locations (
  employee_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy_m double precision null check (accuracy_m is null or accuracy_m >= 0),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  tracking_status text not null default 'active',
  primary key (employee_id, org_id),
  constraint latest_loc_same_org_trip_fk
    foreign key (trip_id, org_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint latest_loc_same_org_member_fk
    foreign key (org_id, employee_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade,
  constraint latest_loc_tracking_status_chk check (
    tracking_status in ('active', 'stationary', 'delayed', 'stale', 'offline', 'stopped')
  )
);

create index if not exists idx_latest_emp_loc_org_status
  on public.latest_employee_locations (org_id, tracking_status);

alter table public.latest_employee_locations enable row level security;
alter table public.latest_employee_locations force row level security;

-- Trigger to sync latest_employee_locations on location_events insertion
create or replace function public.sync_latest_employee_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.latest_employee_locations (
    employee_id,
    org_id,
    trip_id,
    latitude,
    longitude,
    accuracy_m,
    recorded_at,
    received_at,
    tracking_status
  ) values (
    new.employee_id,
    new.org_id,
    new.trip_id,
    new.latitude,
    new.longitude,
    new.accuracy_m,
    new.recorded_at,
    new.received_at,
    'active'
  )
  on conflict (employee_id, org_id) do update set
    trip_id = excluded.trip_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    recorded_at = excluded.recorded_at,
    received_at = excluded.received_at,
    tracking_status = 'active'
  where excluded.recorded_at >= latest_employee_locations.recorded_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_latest_employee_location on public.location_events;
create trigger trg_sync_latest_employee_location
after insert on public.location_events
for each row execute function public.sync_latest_employee_location();

revoke all on function public.sync_latest_employee_location() from public, anon, authenticated;

-- RLS: Managers/Admins can select all org latest locations; Employees can read their own
drop policy if exists "latest_locations_select" on public.latest_employee_locations;
create policy "latest_locations_select"
on public.latest_employee_locations
for select
to authenticated
using (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
  or (
    employee_id = auth.uid()
    and public.is_active_org_member(org_id)
  )
);

grant select, insert, update on public.latest_employee_locations to authenticated;
revoke all on public.latest_employee_locations from anon;


-- ============================================================================
-- 5. geofence_events (append-only)
-- ============================================================================
create table if not exists public.geofence_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  visit_id uuid null references public.visits(id) on delete set null,
  store_id uuid not null,
  employee_id uuid not null,
  event_type text not null,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy_m double precision null check (accuracy_m is null or accuracy_m >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint geofence_events_same_org_trip_fk
    foreign key (trip_id, org_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint geofence_events_same_org_store_fk
    foreign key (store_id, org_id)
    references public.stores (id, organization_id)
    on delete cascade,
  constraint geofence_events_same_org_member_fk
    foreign key (org_id, employee_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade,
  constraint geofence_events_event_type_chk check (
    event_type in ('enter', 'exit')
  )
);

create index if not exists idx_geofence_events_org_trip_recorded
  on public.geofence_events (org_id, trip_id, recorded_at desc);

create index if not exists idx_geofence_events_org_store
  on public.geofence_events (org_id, store_id, recorded_at desc);

alter table public.geofence_events enable row level security;
alter table public.geofence_events force row level security;

-- Immutability trigger for geofence_events
create or replace function public.enforce_geofence_events_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'geofence_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_geofence_events_invariants on public.geofence_events;
create trigger trg_enforce_geofence_events_invariants
before update or delete on public.geofence_events
for each row execute function public.enforce_geofence_events_invariants();

revoke all on function public.enforce_geofence_events_invariants() from public, anon, authenticated;

drop policy if exists "geofence_events_select" on public.geofence_events;
create policy "geofence_events_select"
on public.geofence_events
for select
to authenticated
using (
  public.has_active_org_role(org_id, array['admin', 'manager']::public.org_role[])
  or (
    employee_id = auth.uid()
    and public.is_active_org_member(org_id)
  )
);

drop policy if exists "geofence_events_insert_own" on public.geofence_events;
create policy "geofence_events_insert_own"
on public.geofence_events
for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.is_active_org_member(org_id)
);

grant select, insert on public.geofence_events to authenticated;
revoke all on public.geofence_events from anon;

commit;
