-- Migration 19: durable invitation email delivery state and retry claims.
-- Raw invitation tokens are stored only as authenticated ciphertext created by the
-- server. The encryption key never enters Postgres or client-visible code.

begin;

create table if not exists public.organization_invitation_email_deliveries (
  invitation_id uuid primary key references public.organization_invitations(id) on delete cascade,
  token_ciphertext text,
  status text not null default 'unavailable',
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  attempted_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitation_email_status_chk
    check (status in ('unavailable', 'pending', 'processing', 'accepted', 'failed')),
  constraint organization_invitation_email_attempts_chk
    check (attempts >= 0)
);

create index if not exists organization_invitation_email_retry_idx
  on public.organization_invitation_email_deliveries (status, next_attempt_at);

create trigger trg_organization_invitation_email_deliveries_updated_at
before update on public.organization_invitation_email_deliveries
for each row execute function public.set_updated_at();

alter table public.organization_invitation_email_deliveries enable row level security;
alter table public.organization_invitation_email_deliveries force row level security;

create policy org_invitation_email_delivery_admin_only
  on public.organization_invitation_email_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_invitations i
      where i.id = invitation_id
        and public.has_active_org_role(i.organization_id, array['admin']::public.org_role[])
    )
  );

drop function if exists public.create_organization_invitation(
  uuid, text, public.org_role, text, timestamptz
);

create or replace function public.create_organization_invitation(
  p_organization_id uuid,
  p_invited_email text,
  p_role public.org_role,
  p_token_hash text,
  p_expires_at timestamptz,
  p_token_ciphertext text default null
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

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || v_email, 0)
  );

  update public.organization_invitations
     set status = 'revoked'
   where organization_id = p_organization_id
     and invited_email = v_email
     and status = 'pending';

  insert into public.organization_invitations (
    organization_id, invited_email, role, token_hash, invited_by, status, expires_at
  )
  values (
    p_organization_id, v_email, p_role, p_token_hash, v_user_id, 'pending', p_expires_at
  )
  returning * into v_invitation;

  insert into public.organization_invitation_email_deliveries (
    invitation_id,
    token_ciphertext,
    status
  )
  values (
    v_invitation.id,
    p_token_ciphertext,
    case when p_token_ciphertext is null then 'unavailable' else 'pending' end
  );

  return v_invitation;
end;
$$;

revoke all on function public.create_organization_invitation(
  uuid, text, public.org_role, text, timestamptz, text
) from public, anon;
grant execute on function public.create_organization_invitation(
  uuid, text, public.org_role, text, timestamptz, text
) to authenticated;

create or replace function public.claim_organization_invitation_email(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns table (
  invitation_id uuid,
  organization_id uuid,
  recipient_email text,
  organization_name text,
  role public.org_role,
  expires_at timestamptz,
  token_ciphertext text,
  attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_delivery public.organization_invitation_email_deliveries;
  v_invitation public.organization_invitations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select d.* into v_delivery
    from public.organization_invitation_email_deliveries d
    join public.organization_invitations i on i.id = d.invitation_id
   where d.invitation_id = p_invitation_id
     and i.organization_id = p_organization_id
     and i.status = 'pending'
     and i.expires_at > now()
     and public.has_active_org_role(i.organization_id, array['admin']::public.org_role[])
     and d.token_ciphertext is not null
     and (
       d.status in ('pending', 'failed')
       or (d.status = 'processing' and d.attempted_at < now() - interval '10 minutes')
     )
     and d.next_attempt_at <= now()
   for update of d;

  if not found then
    return;
  end if;

  update public.organization_invitation_email_deliveries
     set status = 'processing',
         attempts = v_delivery.attempts + 1,
         attempted_at = now()
   where invitation_id = p_invitation_id;

  select i.* into v_invitation
    from public.organization_invitations i
   where i.id = p_invitation_id;

  return query
  select v_invitation.id,
         v_invitation.organization_id,
         v_invitation.invited_email,
         o.name,
         v_invitation.role,
         v_invitation.expires_at,
         v_delivery.token_ciphertext,
         v_delivery.attempts + 1
    from public.organizations o
   where o.id = v_invitation.organization_id;
end;
$$;

revoke all on function public.claim_organization_invitation_email(uuid, uuid)
  from public, anon;
grant execute on function public.claim_organization_invitation_email(uuid, uuid)
  to authenticated;

create or replace function public.record_organization_invitation_email(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_delivered boolean,
  p_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
      from public.organization_invitations i
     where i.id = p_invitation_id
       and i.organization_id = p_organization_id
       and public.has_active_org_role(i.organization_id, array['admin']::public.org_role[])
  ) then
    raise exception 'Invitation delivery is not authorized' using errcode = '42501';
  end if;

  update public.organization_invitation_email_deliveries
     set status = case when p_delivered then 'accepted' else 'failed' end,
         provider_message_id = case when p_delivered then p_message_id else provider_message_id end,
         last_error = case when p_delivered then null else left(p_error, 500) end,
         next_attempt_at = case when p_delivered then now() else now() + interval '5 minutes' end
   where invitation_id = p_invitation_id;
end;
$$;

revoke all on function public.record_organization_invitation_email(uuid, uuid, boolean, text, text)
  from public, anon;
grant execute on function public.record_organization_invitation_email(uuid, uuid, boolean, text, text)
  to authenticated;

commit;
