-- Migration: 20261022000001_init_orgs_and_memberships.sql
-- Purpose: Core multi-tenant schema for FieldTrack (organizations, profiles, memberships, roles, and RLS policies).
-- Rule: Never use subqueries inside CHECK constraints. Cross-row invariants use composite foreign keys, unique indexes, or triggers.

begin;

-- 1. Domain Enums
create type public.org_role as enum ('admin', 'manager', 'field_employee');
create type public.membership_status as enum ('invited', 'active', 'deactivated');

-- 2. Updated-at timestamp trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. User Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_nonempty_chk check (char_length(trim(email)) > 3)
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 4. Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length_chk check (char_length(trim(name)) between 2 and 120),
  constraint organizations_slug_format_chk check (
    char_length(slug) between 2 and 63
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint organizations_slug_key unique (slug)
);

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- 5. Organization Memberships (multi-org support: a user may belong to multiple orgs)
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_role not null,
  status public.membership_status not null default 'active',
  manager_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One membership record per (org_id, user_id); also serves as target for same-org composite FK
  constraint organization_memberships_org_user_key unique (org_id, user_id),
  -- Prevent self-reporting without any subquery
  constraint organization_memberships_no_self_manager_chk check (
    manager_user_id is null or manager_user_id <> user_id
  ),
  -- Guarantee assigned manager belongs to the SAME organization via composite foreign key
  constraint organization_memberships_same_org_manager_fk
    foreign key (org_id, manager_user_id)
    references public.organization_memberships (org_id, user_id)
    on delete set null
);

create index idx_org_memberships_user_status
  on public.organization_memberships (user_id, status);

create index idx_org_memberships_org_created_id
  on public.organization_memberships (org_id, created_at desc, id desc);

create trigger trg_organization_memberships_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

-- 6. RLS Helper Functions (Security Definer with locked search_path)
create or replace function public.is_active_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
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
    from public.organization_memberships m
    where m.org_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_active_org_member(uuid) from public;
grant execute on function public.is_active_org_member(uuid) to authenticated;

revoke all on function public.has_active_org_role(uuid, public.org_role[]) from public;
grant execute on function public.has_active_org_role(uuid, public.org_role[]) to authenticated;

-- 7. Transactional helper to create an organization and bootstrap caller as active admin
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

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_user_id)
  returning * into v_org;

  insert into public.organization_memberships (org_id, user_id, role, status)
  values (v_org.id, v_user_id, 'admin', 'active');

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

-- 8. Row-Level Security (RLS) Policies
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;

-- Profiles: users can view their own profile or profiles of members in shared active organizations
create policy profiles_select_self_or_org_peers
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships caller_m
      join public.organization_memberships peer_m
        on caller_m.org_id = peer_m.org_id
      where caller_m.user_id = auth.uid()
        and caller_m.status = 'active'
        and peer_m.user_id = public.profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Organizations: only active members can view the organization; only active admins can update it
create policy organizations_select_active_member
  on public.organizations
  for select
  to authenticated
  using (public.is_active_org_member(id));

create policy organizations_update_admin_only
  on public.organizations
  for update
  to authenticated
  using (public.has_active_org_role(id, array['admin']::public.org_role[]))
  with check (public.has_active_org_role(id, array['admin']::public.org_role[]));

-- Organization Memberships:
-- Active members of an org can view memberships in that org, or users can see their own memberships
create policy org_memberships_select_member_or_self
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_active_org_member(org_id)
  );

-- Only active organization admins can add, update, or remove memberships in their organization
create policy org_memberships_insert_admin_only
  on public.organization_memberships
  for insert
  to authenticated
  with check (public.has_active_org_role(org_id, array['admin']::public.org_role[]));

create policy org_memberships_update_admin_only
  on public.organization_memberships
  for update
  to authenticated
  using (public.has_active_org_role(org_id, array['admin']::public.org_role[]))
  with check (public.has_active_org_role(org_id, array['admin']::public.org_role[]));

create policy org_memberships_delete_admin_only
  on public.organization_memberships
  for delete
  to authenticated
  using (public.has_active_org_role(org_id, array['admin']::public.org_role[]));

commit;
