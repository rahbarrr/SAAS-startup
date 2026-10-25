-- ============================================================================
-- Migration: 20261025000014_phase7_enterprise_audit_and_location.sql
-- Purpose:
--   1. Create `public.organization_audit_events` for immutable organization-wide
--      enterprise audit logging with append-only trigger protection and RLS.
--   2. Create `public.trip_location_breadcrumbs` for controlled, privacy-aware
--      point-in-time work-trip location tracking with append-only guarantees.
--   3. Add retention purge function `public.purge_expired_location_breadcrumbs`.
--   4. Add composite indexes for territory analytics and performance optimization.
-- ============================================================================

-- 1. Organization Audit Events Table
create table if not exists public.organization_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role public.org_role null,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  correlation_id text null,
  reason text null,
  changes jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint org_audit_events_action_type_len check (char_length(trim(action_type)) between 2 and 100),
  constraint org_audit_events_entity_type_len check (char_length(trim(entity_type)) between 2 and 50),
  constraint org_audit_events_entity_id_len check (char_length(trim(entity_id)) between 1 and 255),
  constraint org_audit_events_changes_is_object check (jsonb_typeof(changes) = 'object'),
  constraint org_audit_events_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_org_audit_events_org_created
  on public.organization_audit_events (organization_id, created_at desc);

create index if not exists idx_org_audit_events_org_entity
  on public.organization_audit_events (organization_id, entity_type, entity_id);

create index if not exists idx_org_audit_events_org_actor
  on public.organization_audit_events (organization_id, actor_user_id);

create index if not exists idx_org_audit_events_org_action
  on public.organization_audit_events (organization_id, action_type);

alter table public.organization_audit_events enable row level security;
alter table public.organization_audit_events force row level security;

-- Immutability & Security Invariant Trigger for organization_audit_events
create or replace function public.enforce_organization_audit_events_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_disallowed_keys constant text[] := array['password', 'token', 'access_token', 'refresh_token', 'secret', 'api_key', 'credentials', 'bearer'];
  v_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'organization_audit_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;

  -- Ensure no secret keys leak into changes or metadata
  for v_key in select jsonb_object_keys(new.changes)
  loop
    if lower(v_key) = any(v_disallowed_keys) then
      raise exception 'Disallowed secret key "%" in organization_audit_events changes', v_key
        using errcode = '22023';
    end if;
  end loop;

  for v_key in select jsonb_object_keys(new.metadata)
  loop
    if lower(v_key) = any(v_disallowed_keys) then
      raise exception 'Disallowed secret key "%" in organization_audit_events metadata', v_key
        using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.enforce_organization_audit_events_invariants() from public, anon, authenticated;

drop trigger if exists trg_enforce_org_audit_invariants on public.organization_audit_events;
create trigger trg_enforce_org_audit_invariants
before insert or update or delete on public.organization_audit_events
for each row execute function public.enforce_organization_audit_events_invariants();

-- RLS Policies for organization_audit_events
drop policy if exists "org_audit_events_select_admin_manager" on public.organization_audit_events;
create policy "org_audit_events_select_admin_manager"
on public.organization_audit_events
for select
to authenticated
using (
  public.has_active_org_role(organization_id, array['admin', 'manager']::public.org_role[])
);

drop policy if exists "org_audit_events_insert_member" on public.organization_audit_events;
create policy "org_audit_events_insert_member"
on public.organization_audit_events
for insert
to authenticated
with check (
  public.is_active_org_member(organization_id)
);

revoke all on table public.organization_audit_events from anon;
grant select, insert on public.organization_audit_events to authenticated;


-- 2. Trip Location Breadcrumbs Table
create table if not exists public.trip_location_breadcrumbs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  user_id uuid not null,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy_meters double precision null check (accuracy_meters is null or accuracy_meters >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint trip_breadcrumbs_same_org_trip_fk
    foreign key (trip_id, organization_id)
    references public.trips (id, organization_id)
    on delete cascade,
  constraint trip_breadcrumbs_same_org_user_fk
    foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id)
    on delete cascade
);

create index if not exists idx_trip_breadcrumbs_org_trip_recorded
  on public.trip_location_breadcrumbs (organization_id, trip_id, recorded_at desc);

create index if not exists idx_trip_breadcrumbs_org_recorded
  on public.trip_location_breadcrumbs (organization_id, recorded_at desc);

alter table public.trip_location_breadcrumbs enable row level security;
alter table public.trip_location_breadcrumbs force row level security;

-- Immutability Trigger for trip_location_breadcrumbs
create or replace function public.enforce_trip_location_breadcrumbs_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'trip_location_breadcrumbs is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_trip_location_breadcrumbs_invariants() from public, anon, authenticated;

drop trigger if exists trg_enforce_trip_breadcrumbs_invariants on public.trip_location_breadcrumbs;
create trigger trg_enforce_trip_breadcrumbs_invariants
before insert or update or delete on public.trip_location_breadcrumbs
for each row execute function public.enforce_trip_location_breadcrumbs_invariants();

-- RLS Policies for trip_location_breadcrumbs
drop policy if exists "trip_breadcrumbs_select_authorized" on public.trip_location_breadcrumbs;
create policy "trip_breadcrumbs_select_authorized"
on public.trip_location_breadcrumbs
for select
to authenticated
using (
  public.has_active_org_role(organization_id, array['admin', 'manager']::public.org_role[])
  or (
    user_id = auth.uid()
    and public.is_active_org_member(organization_id)
  )
);

drop policy if exists "trip_breadcrumbs_insert_own_active" on public.trip_location_breadcrumbs;
create policy "trip_breadcrumbs_insert_own_active"
on public.trip_location_breadcrumbs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

revoke all on table public.trip_location_breadcrumbs from anon;
grant select, insert on public.trip_location_breadcrumbs to authenticated;


-- 3. Location Retention Purge Function (Admin-Scoped)
-- migration-review: bulk-delete-approved
create or replace function public.purge_expired_location_breadcrumbs(
  p_org_id uuid,
  p_retention_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_count integer := 0;
  v_cutoff timestamptz;
begin
  if not public.has_active_org_role(p_org_id, array['admin']::public.org_role[]) then
    raise exception 'Only organization administrators can purge location breadcrumb records'
      using errcode = '42501';
  end if;

  if p_retention_days < 7 then
    raise exception 'Minimum retention period is 7 days'
      using errcode = '22023';
  end if;

  v_cutoff := now() - make_interval(days => p_retention_days);

  delete from public.trip_location_breadcrumbs
   where organization_id = p_org_id
     and recorded_at < v_cutoff;

  get diagnostics v_deleted_count = row_count;

  return v_deleted_count;
end;
$$;

revoke all on function public.purge_expired_location_breadcrumbs(uuid, integer) from public, anon;
grant execute on function public.purge_expired_location_breadcrumbs(uuid, integer) to authenticated;


-- 4. Composite Performance Indexes for Territory Analytics
create index if not exists idx_trip_stops_org_planned
  on public.trip_stops (organization_id, planned_at desc);

create index if not exists idx_trips_org_owner_status
  on public.trips (organization_id, owner_user_id, status);

create index if not exists idx_stores_org_region_active
  on public.stores (organization_id, region, active);
