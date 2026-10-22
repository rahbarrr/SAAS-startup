-- Migration: 20261022000003_auth_invitations_and_onboarding.sql
-- Purpose:
--   1. Automatic profile bootstrap trigger on `auth.users` + transactional profile guarantee
--      in `create_organization_with_owner` so onboarding never leaves partial/orphaned records.
--   2. `organization_invitations` table with hashed one-time tokens, expiration timestamps,
--      and RLS policies so only active org admins can issue or revoke invitations.
--   3. Transactional `accept_organization_invitation(p_token_hash text)` RPC that verifies
--      token hash, expiration, one-time use, and email match server-side, and assigns ONLY
--      the role authorized by the inviter.

begin;

-- ============================================================================
-- 1. Automatic Profile Bootstrap on `auth.users` Insert
-- ============================================================================
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is not null and char_length(trim(new.email)) > 3 then
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      lower(trim(new.email)),
      coalesce(new.raw_user_meta_data ->> 'full_name', '')
    )
    on conflict (id) do update
      set email = excluded.email;
  end if;
  return new;
exception
  when undefined_column then
    -- Fallback for minimal local/test `auth.users` tables without `raw_user_meta_data`
    insert into public.profiles (id, email, full_name)
    values (new.id, lower(trim(new.email)), '')
    on conflict (id) do update
      set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

-- ============================================================================
-- 2. Harden `create_organization_with_owner` for Atomic Onboarding
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
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Ensure caller has a profile record inside the same transaction so FK never fails or orphans
  select u.email into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null then
    raise exception 'Authenticated user record not found' using errcode = '42501';
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

-- ============================================================================
-- 3. `organization_invitations` Table & Enum
-- ============================================================================
create type public.invitation_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  role public.org_role not null,
  token_hash text not null,
  invited_by uuid not null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  accepted_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_token_hash_key unique (token_hash),
  -- Ensure inviter belongs to the SAME organization
  constraint organization_invitations_same_org_inviter_fk
    foreign key (organization_id, invited_by)
    references public.organization_members (organization_id, user_id)
    on delete restrict,
  constraint organization_invitations_email_chk check (
    char_length(trim(invited_email)) > 3
    and invited_email = lower(trim(invited_email))
  ),
  -- Token hash must be a 64-character lowercase hex SHA-256 digest (never raw token)
  constraint organization_invitations_token_hash_format_chk check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint organization_invitations_expiry_after_create_chk check (
    expires_at > created_at
  ),
  constraint organization_invitations_accepted_state_chk check (
    (status = 'accepted' and accepted_at is not null and accepted_by is not null)
    or (status <> 'accepted' and accepted_at is null and accepted_by is null)
  )
);

create index idx_organization_invitations_org_status
  on public.organization_invitations (organization_id, status, expires_at desc);

create index idx_organization_invitations_email_status
  on public.organization_invitations (invited_email, status);

create trigger trg_organization_invitations_updated_at
before update on public.organization_invitations
for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;
alter table public.organization_invitations force row level security;

-- Only active admins of the organization can view, create, or update/revoke invitations
create policy org_invitations_select_admin_only
  on public.organization_invitations
  for select
  to authenticated
  using (
    public.has_active_org_role(
      organization_id,
      array['admin']::public.org_role[]
    )
  );

create policy org_invitations_insert_admin_only
  on public.organization_invitations
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and status = 'pending'
    and public.has_active_org_role(
      organization_id,
      array['admin']::public.org_role[]
    )
  );

create policy org_invitations_update_admin_only
  on public.organization_invitations
  for update
  to authenticated
  using (
    public.has_active_org_role(
      organization_id,
      array['admin']::public.org_role[]
    )
  )
  with check (
    public.has_active_org_role(
      organization_id,
      array['admin']::public.org_role[]
    )
  );

-- ============================================================================
-- 4. Transactional Invitation Acceptance RPC
--    - Verifies SHA-256 token hash server-side
--    - Enforces one-time use (`status = 'pending'` and `accepted_at IS NULL`)
--    - Enforces expiry (`expires_at > now()`)
--    - Verifies authenticated user's email matches `invited_email`
--    - Assigns ONLY `v_invitation.role` authorized by the inviter
-- ============================================================================
create or replace function public.accept_organization_invitation(
  p_token_hash text
)
returns public.organization_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.organization_invitations;
  v_org_status public.organization_status;
  v_membership public.organization_members;
begin
  if v_user_id is null then
    raise exception 'Authentication required to accept an invitation'
      using errcode = '42501';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid or expired invitation'
      using errcode = '22023';
  end if;

  select lower(trim(u.email))
    into v_user_email
    from auth.users u
   where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'Authenticated user email could not be verified'
      using errcode = '42501';
  end if;

  -- Lock the invitation row for atomic one-time use verification
  select *
    into v_invitation
    from public.organization_invitations i
   where i.token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'Invalid or expired invitation'
      using errcode = '22023';
  end if;

  if v_invitation.status <> 'pending' or v_invitation.accepted_at is not null then
    raise exception 'Invitation has already been used or revoked'
      using errcode = '22023';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'Invitation has expired'
      using errcode = '22023';
  end if;

  if v_invitation.invited_email <> v_user_email then
    raise exception 'Invitation email does not match the signed-in account'
      using errcode = '42501';
  end if;

  select o.status
    into v_org_status
    from public.organizations o
   where o.id = v_invitation.organization_id;

  if v_org_status is distinct from 'active' then
    raise exception 'Organization is not active'
      using errcode = '42501';
  end if;

  -- Ensure profile row exists for the accepting user
  insert into public.profiles (id, email)
  values (v_user_id, v_user_email)
  on conflict (id) do nothing;

  -- Mark invitation as accepted (one-time use)
  update public.organization_invitations
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id
   where id = v_invitation.id;

  -- Create or activate membership with ONLY the role authorized by the inviter
  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    'active'
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
  returning * into v_membership;

  return v_membership;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;

commit;
