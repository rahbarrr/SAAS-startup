-- Migration: 20261022000002_field_operations_schema.sql
-- Purpose: Complete MVP multi-tenant schema for FieldTrack field operations:
--   organizations (status), organization_members, stores, trips, trip_stops,
--   visits, visit_checklist_items, visit_evidence, trip_audit_events,
--   and private storage bucket/policies for visit evidence.
-- Note: `ai_summaries` is intentionally omitted until Phase 8 is approved.
-- Rule: Never use subqueries inside CHECK constraints. Cross-tenant integrity is
--   enforced via composite unique keys + matching composite foreign keys and triggers.

begin;

-- ============================================================================
-- 1. Enums for Organization & Field Operations Lifecycle
-- ============================================================================
create type public.organization_status as enum ('active', 'suspended', 'archived');

create type public.trip_status as enum (
  'draft',
  'submitted',
  'approved',
  'changes_requested',
  'rejected',
  'in_progress',
  'completed'
);

create type public.trip_stop_status as enum (
  'planned',
  'visited',
  'skipped'
);

create type public.visit_status as enum (
  'in_progress',
  'submitted',
  'reviewed'
);

create type public.checklist_answer_type as enum (
  'boolean',
  'text',
  'number',
  'select'
);

create type public.trip_audit_event_type as enum (
  'trip_created',
  'trip_submitted',
  'trip_approved',
  'trip_changes_requested',
  'trip_rejected',
  'trip_started',
  'trip_completed'
);

-- ============================================================================
-- 2. Evolve `organizations` and `organization_members`
-- ============================================================================
alter table public.organizations
  add column status public.organization_status not null default 'active';

-- Composite unique key so child tables can reference (id, status) or (id) safely
create index idx_organizations_status on public.organizations (status);

-- Align table and column naming to canonical `organization_members (organization_id, user_id)`
alter table public.organization_memberships
  rename to organization_members;

alter table public.organization_members
  rename column org_id to organization_id;

alter table public.organization_members
  rename constraint organization_memberships_org_user_key to organization_members_org_user_key;

alter table public.organization_members
  rename constraint organization_memberships_no_self_manager_chk to organization_members_no_self_manager_chk;

alter table public.organization_members
  rename constraint organization_memberships_same_org_manager_fk to organization_members_same_org_manager_fk;

alter index public.idx_org_memberships_user_status
  rename to idx_organization_members_user_status;

alter index public.idx_org_memberships_org_created_id
  rename to idx_organization_members_org_created_id;

-- Update RLS helper functions to query `public.organization_members` and verify org is 'active'
create or replace function public.is_active_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function public.has_active_org_role(
  target_org_id uuid,
  allowed_roles public.org_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

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
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug, status, created_by)
  values (trim(p_name), lower(trim(p_slug)), 'active', v_user_id)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org.id, v_user_id, 'admin', 'active');

  return v_org;
end;
$$;

-- Update profiles peer-visibility policy to reference `organization_members.organization_id`
drop policy if exists profiles_select_self_or_org_peers on public.profiles;
create policy profiles_select_self_or_org_peers
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members caller_m
      join public.organization_members peer_m
        on caller_m.organization_id = peer_m.organization_id
      where caller_m.user_id = auth.uid()
        and caller_m.status = 'active'
        and peer_m.user_id = public.profiles.id
    )
  );

-- ============================================================================
-- 3. `stores` Table (Tenant-scoped retail/FMCG locations)
-- ============================================================================
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  region text not null,
  address_line1 text not null,
  address_line2 text null,
  city text not null,
  state_province text null,
  postal_code text null,
  country_code char(2) not null default 'US',
  latitude double precision null,
  longitude double precision null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite unique constraint enabling same-org composite FK from `trip_stops`
  constraint stores_id_organization_id_key unique (id, organization_id),
  constraint stores_name_nonempty_chk check (char_length(trim(name)) between 1 and 160),
  constraint stores_region_nonempty_chk check (char_length(trim(region)) between 1 and 100),
  constraint stores_latitude_range_chk check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint stores_longitude_range_chk check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint stores_lat_lng_pair_chk check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create index idx_stores_org_active_region
  on public.stores (organization_id, active, region);

create index idx_stores_org_created_id
  on public.stores (organization_id, created_at desc, id desc);

create trigger trg_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. `trips` Table (Field trip plans & approval state machine)
-- ============================================================================
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  purpose text not null default '',
  status public.trip_status not null default 'draft',
  submitted_at timestamptz null,
  decided_by uuid null,
  decided_at timestamptz null,
  decision_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite unique key enabling same-org composite FKs from `trip_stops` and `trip_audit_events`
  constraint trips_id_organization_id_key unique (id, organization_id),
  -- Ensure trip owner is a member of the SAME organization
  constraint trips_same_org_owner_fk
    foreign key (organization_id, owner_user_id)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  -- Ensure approver/decider (if set) is a member of the SAME organization
  constraint trips_same_org_decider_fk
    foreign key (organization_id, decided_by)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  constraint trips_title_length_chk check (char_length(trim(title)) between 2 and 160),
  constraint trips_date_order_chk check (end_date >= start_date),
  -- Row-level self-approval guard (additionally enforced in trigger below)
  constraint trips_no_self_decision_chk check (
    decided_by is null or decided_by <> owner_user_id
  )
);

create index idx_trips_org_status_dates
  on public.trips (organization_id, status, start_date desc, id desc);

create index idx_trips_org_owner_status
  on public.trips (organization_id, owner_user_id, status, created_at desc);

create trigger trg_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. `trip_stops` Table (Ordered store stops within a trip)
-- ============================================================================
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  store_id uuid not null,
  sequence_number integer not null,
  planned_at timestamptz null,
  status public.trip_stop_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stops_id_organization_id_key unique (id, organization_id),
  constraint trip_stops_trip_sequence_key unique (trip_id, sequence_number),
  constraint trip_stops_sequence_positive_chk check (sequence_number >= 1),
  -- Composite FK guarantees `trip_id` belongs to `organization_id`
  constraint trip_stops_same_org_trip_fk
    foreign key (trip_id, organization_id)
    references public.trips (id, organization_id)
    on delete cascade,
  -- Composite FK guarantees `store_id` belongs to `organization_id` (prevents cross-org store reference!)
  constraint trip_stops_same_org_store_fk
    foreign key (store_id, organization_id)
    references public.stores (id, organization_id)
    on delete restrict
);

create index idx_trip_stops_org_trip_seq
  on public.trip_stops (organization_id, trip_id, sequence_number asc);

create index idx_trip_stops_org_store
  on public.trip_stops (organization_id, store_id);

create trigger trg_trip_stops_updated_at
before update on public.trip_stops
for each row execute function public.set_updated_at();

-- ============================================================================
-- 6. `visits` Table (Store visit execution records)
-- ============================================================================
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_stop_id uuid not null,
  employee_user_id uuid not null,
  checked_in_at timestamptz null,
  checked_out_at timestamptz null,
  check_in_lat double precision null,
  check_in_lng double precision null,
  check_out_lat double precision null,
  check_out_lng double precision null,
  notes text not null default '',
  status public.visit_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visits_id_organization_id_key unique (id, organization_id),
  -- Composite FK guarantees `trip_stop_id` belongs to `organization_id`
  constraint visits_same_org_trip_stop_fk
    foreign key (trip_stop_id, organization_id)
    references public.trip_stops (id, organization_id)
    on delete cascade,
  -- Composite FK guarantees `employee_user_id` is a member of `organization_id`
  constraint visits_same_org_employee_fk
    foreign key (organization_id, employee_user_id)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  constraint visits_checkout_after_checkin_chk check (
    checked_out_at is null
    or (checked_in_at is not null and checked_out_at >= checked_in_at)
  ),
  constraint visits_checkin_lat_chk check (check_in_lat is null or (check_in_lat >= -90 and check_in_lat <= 90)),
  constraint visits_checkin_lng_chk check (check_in_lng is null or (check_in_lng >= -180 and check_in_lng <= 180)),
  constraint visits_checkout_lat_chk check (check_out_lat is null or (check_out_lat >= -90 and check_out_lat <= 90)),
  constraint visits_checkout_lng_chk check (check_out_lng is null or (check_out_lng >= -180 and check_out_lng <= 180))
);

create index idx_visits_org_employee_status
  on public.visits (organization_id, employee_user_id, status, created_at desc);

create index idx_visits_org_trip_stop
  on public.visits (organization_id, trip_stop_id);

create trigger trg_visits_updated_at
before update on public.visits
for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. `visit_checklist_items` Table (Structured store audit answers)
-- ============================================================================
create table public.visit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  question_key text not null,
  label text not null,
  answer_type public.checklist_answer_type not null,
  answer_value jsonb null,
  answer_text text null,
  flagged boolean not null default false,
  required boolean not null default true,
  completed_at timestamptz null,
  completed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_checklist_items_visit_question_key unique (visit_id, question_key),
  constraint visit_checklist_items_question_key_chk check (
    char_length(trim(question_key)) between 1 and 80
  ),
  constraint visit_checklist_items_label_chk check (
    char_length(trim(label)) between 1 and 240
  ),
  -- Composite FK guarantees `visit_id` belongs to `organization_id`
  constraint visit_checklist_items_same_org_visit_fk
    foreign key (visit_id, organization_id)
    references public.visits (id, organization_id)
    on delete cascade,
  -- Composite FK guarantees `completed_by` belongs to `organization_id`
  constraint visit_checklist_items_same_org_completed_by_fk
    foreign key (organization_id, completed_by)
    references public.organization_members (organization_id, user_id)
    on delete set null
);

create index idx_visit_checklist_org_visit
  on public.visit_checklist_items (organization_id, visit_id);

create trigger trg_visit_checklist_items_updated_at
before update on public.visit_checklist_items
for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. `visit_evidence` Table (Tenant-scoped photo/document evidence metadata)
-- ============================================================================
create table public.visit_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  storage_path text not null,
  file_type text not null,
  file_size integer not null,
  caption text not null default '',
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  constraint visit_evidence_storage_path_key unique (storage_path),
  -- Composite FK guarantees `visit_id` belongs to `organization_id`
  constraint visit_evidence_same_org_visit_fk
    foreign key (visit_id, organization_id)
    references public.visits (id, organization_id)
    on delete cascade,
  -- Composite FK guarantees `uploaded_by` is a member of `organization_id`
  constraint visit_evidence_same_org_uploader_fk
    foreign key (organization_id, uploaded_by)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  constraint visit_evidence_file_size_chk check (file_size > 0 and file_size <= 26214400),
  constraint visit_evidence_mime_type_chk check (
    file_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  -- Enforce tenant-scoped object path prefix: "<organization_id>/<visit_id>/<filename>" without traversal
  constraint visit_evidence_tenant_storage_path_chk check (
    split_part(storage_path, '/', 1) = organization_id::text
    and split_part(storage_path, '/', 2) = visit_id::text
    and char_length(split_part(storage_path, '/', 3)) >= 1
    and position('..' in storage_path) = 0
  )
);

create index idx_visit_evidence_org_visit
  on public.visit_evidence (organization_id, visit_id, created_at desc);

-- ============================================================================
-- 9. `trip_audit_events` Table (Append-only audit trail for trip lifecycle)
-- ============================================================================
create table public.trip_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  actor_user_id uuid not null,
  event_type public.trip_audit_event_type not null,
  old_status public.trip_status null,
  new_status public.trip_status not null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Composite FK guarantees `trip_id` belongs to `organization_id`
  constraint trip_audit_events_same_org_trip_fk
    foreign key (trip_id, organization_id)
    references public.trips (id, organization_id)
    on delete cascade,
  -- Composite FK guarantees `actor_user_id` belongs to `organization_id`
  constraint trip_audit_events_same_org_actor_fk
    foreign key (organization_id, actor_user_id)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  constraint trip_audit_events_metadata_is_object_chk check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index idx_trip_audit_events_org_trip_created
  on public.trip_audit_events (organization_id, trip_id, created_at desc);

-- ============================================================================
-- 10. Database Triggers for Self-Approval Prevention, Role Enforcement & Audit Immutability
-- ============================================================================

-- 10a. Validate allowlisted metadata keys and prevent UPDATE/DELETE on `trip_audit_events`
create or replace function public.enforce_trip_audit_events_invariants()
returns trigger
language plpgsql
as $$
declare
  v_key text;
  v_allowed_keys constant text[] := array['source', 'stop_count', 'reason_code', 'client_version'];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'trip_audit_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;

  for v_key in select jsonb_object_keys(new.metadata)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'Disallowed metadata key "%" in trip_audit_events', v_key
        using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_trip_audit_events_invariants
before insert or update or delete on public.trip_audit_events
for each row execute function public.enforce_trip_audit_events_invariants();

-- 10b. Enforce trip approval workflow, self-approval ban, and decider role verification
-- Explicit product policy: Active 'manager' or 'admin' in the organization may review/approve trips,
-- EXCEPT no user (not even an admin or manager) may approve/reject/decide their own trip.
create or replace function public.enforce_trip_workflow_and_decision_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decider_role public.org_role;
  v_decider_status public.membership_status;
  v_caller_uid uuid := auth.uid();
begin
  -- Owner and organization of an existing trip are immutable
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.owner_user_id <> old.owner_user_id then
      raise exception 'Trip organization_id and owner_user_id cannot be reassigned'
        using errcode = '42501';
    end if;
  end if;

  -- New trips must start as 'draft' or 'submitted' without pre-populated approval fields
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'New trips must be created in draft or submitted status'
        using errcode = '22023';
    end if;
    if new.decided_by is not null or new.decided_at is not null then
      raise exception 'New trips cannot be inserted with a pre-populated decision'
        using errcode = '22023';
    end if;
    if new.status = 'submitted' and new.submitted_at is null then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  -- When transitioning into a manager decision state ('approved', 'rejected', 'changes_requested')
  if new.status in ('approved', 'rejected', 'changes_requested')
     and (old.status is distinct from new.status) then

    if old.status <> 'submitted' then
      raise exception 'Only submitted trips can be approved, rejected, or sent back for changes (current status: %)', old.status
        using errcode = '22023';
    end if;

    -- Default decided_by to authenticated caller if not explicitly provided
    if new.decided_by is null and v_caller_uid is not null then
      new.decided_by := v_caller_uid;
    end if;

    if new.decided_by is null then
      raise exception 'decided_by is required when deciding a submitted trip'
        using errcode = '22023';
    end if;

    -- If called in an authenticated user session, decided_by must match auth.uid()
    if v_caller_uid is not null and new.decided_by <> v_caller_uid then
      raise exception 'decided_by must match the authenticated reviewer'
        using errcode = '42501';
    end if;

    -- Self-approval prevention (enforced in trigger in addition to row constraint)
    if new.decided_by = new.owner_user_id then
      raise exception 'Self-approval is forbidden: trip owner cannot approve or decide their own trip'
        using errcode = '42501';
    end if;

    -- Verify decider is an active manager or admin in the trip's organization
    select m.role, m.status
      into v_decider_role, v_decider_status
      from public.organization_members m
     where m.organization_id = new.organization_id
       and m.user_id = new.decided_by;

    if v_decider_status is distinct from 'active'
       or v_decider_role not in ('admin', 'manager') then
      raise exception 'Only an active manager or admin of the organization can decide a trip'
        using errcode = '42501';
    end if;

    if new.decided_at is null then
      new.decided_at := now();
    end if;
  end if;

  -- When an owner submits a draft or changes_requested trip
  if new.status = 'submitted' and old.status in ('draft', 'changes_requested') then
    new.submitted_at := coalesce(new.submitted_at, now());
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := null;
  end if;

  return new;
end;
$$;

create trigger trg_trips_workflow_and_decision
before insert or update on public.trips
for each row execute function public.enforce_trip_workflow_and_decision_rules();

-- ============================================================================
-- 11. Helper Functions for Visit & Trip Ownership in RLS (Safe search_path, non-recursive)
-- ============================================================================
create or replace function public.can_employee_edit_visit(
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
      and v.employee_user_id = auth.uid()
      and v.status = 'in_progress'
      and public.is_active_org_member(target_org_id)
  );
$$;

revoke all on function public.can_employee_edit_visit(uuid, uuid) from public;
grant execute on function public.can_employee_edit_visit(uuid, uuid) to authenticated;

-- ============================================================================
-- 12. Row-Level Security (RLS) Policies for All Exposed Tables
-- ============================================================================
alter table public.stores enable row level security;
alter table public.stores force row level security;

alter table public.trips enable row level security;
alter table public.trips force row level security;

alter table public.trip_stops enable row level security;
alter table public.trip_stops force row level security;

alter table public.visits enable row level security;
alter table public.visits force row level security;

alter table public.visit_checklist_items enable row level security;
alter table public.visit_checklist_items force row level security;

alter table public.visit_evidence enable row level security;
alter table public.visit_evidence force row level security;

alter table public.trip_audit_events enable row level security;
alter table public.trip_audit_events force row level security;

-- 12a. `stores` policies:
-- Any active member of the organization can view stores; active managers and admins can create/update stores; only admins can delete stores.
create policy stores_select_org_member
  on public.stores
  for select
  to authenticated
  using (public.is_active_org_member(organization_id));

create policy stores_insert_manager_or_admin
  on public.stores
  for insert
  to authenticated
  with check (
    public.has_active_org_role(
      organization_id,
      array['admin', 'manager']::public.org_role[]
    )
  );

create policy stores_update_manager_or_admin
  on public.stores
  for update
  to authenticated
  using (
    public.has_active_org_role(
      organization_id,
      array['admin', 'manager']::public.org_role[]
    )
  )
  with check (
    public.has_active_org_role(
      organization_id,
      array['admin', 'manager']::public.org_role[]
    )
  );

create policy stores_delete_admin_only
  on public.stores
  for delete
  to authenticated
  using (
    public.has_active_org_role(
      organization_id,
      array['admin']::public.org_role[]
    )
  );

-- 12b. `trips` policies:
-- SELECT: Employees can view their own trips; managers and admins can view all trips in their active organization.
create policy trips_select_owner_or_manager
  on public.trips
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      owner_user_id = auth.uid()
      or public.has_active_org_role(
        organization_id,
        array['admin', 'manager']::public.org_role[]
      )
    )
  );

-- INSERT: Active members can create their own trips in 'draft' or 'submitted' state.
create policy trips_insert_own
  on public.trips
  for insert
  to authenticated
  with check (
    public.is_active_org_member(organization_id)
    and owner_user_id = auth.uid()
    and status in ('draft', 'submitted')
    and decided_by is null
  );

-- UPDATE:
--   1. Trip owner (active member) can update their own trip while in 'draft'/'changes_requested'
--      (to edit or submit) or transition their own 'approved' trip to 'in_progress' / 'completed'.
--   2. Active manager or admin (who is NOT owner_user_id) can update a 'submitted' trip in their org
--      to record an approval decision ('approved', 'rejected', 'changes_requested').
create policy trips_update_owner_or_reviewer
  on public.trips
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      (
        owner_user_id = auth.uid()
        and status in ('draft', 'changes_requested', 'approved', 'in_progress')
      )
      or (
        owner_user_id <> auth.uid()
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
      (
        owner_user_id = auth.uid()
        and status in ('draft', 'submitted', 'in_progress', 'completed')
      )
      or (
        owner_user_id <> auth.uid()
        and decided_by = auth.uid()
        and status in ('approved', 'rejected', 'changes_requested')
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
      )
    )
  );

-- DELETE: Trip owner can delete their own trip only while it is still a 'draft'; admins can delete draft trips.
create policy trips_delete_draft_only
  on public.trips
  for delete
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and status = 'draft'
    and (
      owner_user_id = auth.uid()
      or public.has_active_org_role(
        organization_id,
        array['admin']::public.org_role[]
      )
    )
  );

-- 12c. `trip_stops` policies:
-- Visible to trip owner or org managers/admins; editable by trip owner while trip is in editable state ('draft' or 'changes_requested' or 'in_progress').
create policy trip_stops_select_visible_trip
  on public.trip_stops
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.trips t
      where t.id = public.trip_stops.trip_id
        and t.organization_id = public.trip_stops.organization_id
        and (
          t.owner_user_id = auth.uid()
          or public.has_active_org_role(
            t.organization_id,
            array['admin', 'manager']::public.org_role[]
          )
        )
    )
  );

create policy trip_stops_insert_editable_trip
  on public.trip_stops
  for insert
  to authenticated
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
        and t.status in ('draft', 'changes_requested', 'approved', 'in_progress')
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
        and t.status in ('draft', 'changes_requested', 'approved', 'in_progress')
    )
  );

create policy trip_stops_delete_editable_trip
  on public.trip_stops
  for delete
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
  );

-- 12d. `visits` policies:
-- Employees can view and edit their own visits (while 'in_progress'); managers/admins can view and mark visits 'reviewed'.
create policy visits_select_owner_or_manager
  on public.visits
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      employee_user_id = auth.uid()
      or public.has_active_org_role(
        organization_id,
        array['admin', 'manager']::public.org_role[]
      )
    )
  );

create policy visits_insert_own
  on public.visits
  for insert
  to authenticated
  with check (
    public.is_active_org_member(organization_id)
    and employee_user_id = auth.uid()
    and status = 'in_progress'
  );

create policy visits_update_owner_or_reviewer
  on public.visits
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = auth.uid() and status = 'in_progress')
      or public.has_active_org_role(
        organization_id,
        array['admin', 'manager']::public.org_role[]
      )
    )
  )
  with check (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = auth.uid() and status in ('in_progress', 'submitted'))
      or (
        status = 'reviewed'
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
      )
    )
  );

-- 12e. `visit_checklist_items` policies:
create policy visit_checklist_select_owner_or_manager
  on public.visit_checklist_items
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.visits v
      where v.id = public.visit_checklist_items.visit_id
        and v.organization_id = public.visit_checklist_items.organization_id
        and (
          v.employee_user_id = auth.uid()
          or public.has_active_org_role(
            v.organization_id,
            array['admin', 'manager']::public.org_role[]
          )
        )
    )
  );

create policy visit_checklist_insert_editable_visit
  on public.visit_checklist_items
  for insert
  to authenticated
  with check (
    public.can_employee_edit_visit(organization_id, visit_id)
    and (completed_by is null or completed_by = auth.uid())
  );

create policy visit_checklist_update_editable_visit
  on public.visit_checklist_items
  for update
  to authenticated
  using (public.can_employee_edit_visit(organization_id, visit_id))
  with check (
    public.can_employee_edit_visit(organization_id, visit_id)
    and (completed_by is null or completed_by = auth.uid())
  );

-- 12f. `visit_evidence` policies:
create policy visit_evidence_select_owner_or_manager
  on public.visit_evidence
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.visits v
      where v.id = public.visit_evidence.visit_id
        and v.organization_id = public.visit_evidence.organization_id
        and (
          v.employee_user_id = auth.uid()
          or public.has_active_org_role(
            v.organization_id,
            array['admin', 'manager']::public.org_role[]
          )
        )
    )
  );

create policy visit_evidence_insert_editable_visit
  on public.visit_evidence
  for insert
  to authenticated
  with check (
    public.can_employee_edit_visit(organization_id, visit_id)
    and uploaded_by = auth.uid()
  );

-- 12g. `trip_audit_events` policies (Append-Only):
-- SELECT: Trip owner or org managers/admins.
-- INSERT: Active member whose actor_user_id = auth.uid() and has access to the trip.
-- UPDATE / DELETE: No policies granted (and blocked by trigger).
create policy trip_audit_events_select_owner_or_manager
  on public.trip_audit_events
  for select
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and exists (
      select 1
      from public.trips t
      where t.id = public.trip_audit_events.trip_id
        and t.organization_id = public.trip_audit_events.organization_id
        and (
          t.owner_user_id = auth.uid()
          or public.has_active_org_role(
            t.organization_id,
            array['admin', 'manager']::public.org_role[]
          )
        )
    )
  );

create policy trip_audit_events_insert_actor_only
  on public.trip_audit_events
  for insert
  to authenticated
  with check (
    public.is_active_org_member(organization_id)
    and actor_user_id = auth.uid()
    and exists (
      select 1
      from public.trips t
      where t.id = public.trip_audit_events.trip_id
        and t.organization_id = public.trip_audit_events.organization_id
        and (
          t.owner_user_id = auth.uid()
          or public.has_active_org_role(
            t.organization_id,
            array['admin', 'manager']::public.org_role[]
          )
        )
    )
  );

-- ============================================================================
-- 13. Private Storage Bucket & Tenant-Scoped Policies (if Supabase `storage` schema exists)
-- ============================================================================
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'visit-evidence',
      'visit-evidence',
      false,
      26214400,
      array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    execute $policy$
      drop policy if exists visit_evidence_storage_select on storage.objects;
      create policy visit_evidence_storage_select
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'visit-evidence'
          and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and public.is_active_org_member((split_part(name, '/', 1))::uuid)
        );

      drop policy if exists visit_evidence_storage_insert on storage.objects;
      create policy visit_evidence_storage_insert
        on storage.objects
        for insert
        to authenticated
        with check (
          bucket_id = 'visit-evidence'
          and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and public.can_employee_edit_visit(
            (split_part(name, '/', 1))::uuid,
            (split_part(name, '/', 2))::uuid
          )
        );
    $policy$;
  end if;
end;
$$;

commit;
