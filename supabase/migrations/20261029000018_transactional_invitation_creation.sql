-- Migration 18: serialize invitation replacement and prevent duplicate pending invites.
-- This migration is intentionally separate from migration 17 so the protected release
-- workflow can review the database change independently.

begin;

create unique index if not exists organization_invitations_one_pending_per_email_idx
  on public.organization_invitations (organization_id, invited_email)
  where status = 'pending';

create or replace function public.create_organization_invitation(
  p_organization_id uuid,
  p_invited_email text,
  p_role public.org_role,
  p_token_hash text,
  p_expires_at timestamptz
)
returns public.organization_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.organization_invitations;
  v_email text := lower(trim(p_invited_email));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_active_org_role(
    p_organization_id,
    array['admin']::public.org_role[]
  ) then
    raise exception 'Only active organization administrators can issue invitations'
      using errcode = '42501';
  end if;

  if v_email is null or char_length(v_email) <= 3 then
    raise exception 'Invitation email is invalid' using errcode = '22023';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation token is invalid' using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future' using errcode = '22023';
  end if;

  -- Serialize replacements for the same organization and email. The operation is
  -- atomic: a failed insert cannot revoke the prior valid invitation.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || v_email, 0)
  );

  update public.organization_invitations
     set status = 'revoked'
   where organization_id = p_organization_id
     and invited_email = v_email
     and status = 'pending';

  insert into public.organization_invitations (
    organization_id,
    invited_email,
    role,
    token_hash,
    invited_by,
    status,
    expires_at
  )
  values (
    p_organization_id,
    v_email,
    p_role,
    p_token_hash,
    v_user_id,
    'pending',
    p_expires_at
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function public.create_organization_invitation(
  uuid, text, public.org_role, text, timestamptz
) from public, anon;
grant execute on function public.create_organization_invitation(
  uuid, text, public.org_role, text, timestamptz
) to authenticated;

commit;
