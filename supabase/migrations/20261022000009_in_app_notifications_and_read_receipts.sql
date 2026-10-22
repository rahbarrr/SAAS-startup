-- ============================================================================
-- Migration: 20261022000009_in_app_notifications_and_read_receipts.sql
-- Purpose:
--   1. Create `public.in_app_notification_reads` to track per-user read state
--      for in-app notifications derived deterministically from committed
--      `public.trip_audit_events` rows (`trip_submitted`, `trip_resubmitted`,
--      `trip_approved`, `trip_changes_requested`, `trip_rejected`).
--   2. Enforce tenant consistency and idempotent read receipts via composite
--      primary key `(organization_id, audit_event_id, user_id)` and an atomic
--      `public.mark_in_app_notification_read` RPC (`ON CONFLICT DO NOTHING`).
-- ============================================================================

create table if not exists public.in_app_notification_reads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_event_id uuid not null references public.trip_audit_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (organization_id, audit_event_id, user_id)
);

create index if not exists idx_in_app_notification_reads_user_org
  on public.in_app_notification_reads (user_id, organization_id, read_at desc);

-- Trigger ensuring `audit_event_id` belongs to the same `organization_id`
create or replace function public.enforce_in_app_notification_read_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_org_id uuid;
begin
  select e.organization_id
    into v_event_org_id
    from public.trip_audit_events e
   where e.id = new.audit_event_id;

  if v_event_org_id is null or v_event_org_id <> new.organization_id then
    raise exception 'Notification audit event does not belong to the specified organization.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_in_app_notification_reads_invariants on public.in_app_notification_reads;
create trigger trg_in_app_notification_reads_invariants
before insert or update on public.in_app_notification_reads
for each row execute function public.enforce_in_app_notification_read_invariants();

alter table public.in_app_notification_reads enable row level security;
alter table public.in_app_notification_reads force row level security;

drop policy if exists "in_app_notification_reads_select_own" on public.in_app_notification_reads;
create policy "in_app_notification_reads_select_own"
on public.in_app_notification_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

drop policy if exists "in_app_notification_reads_insert_own" on public.in_app_notification_reads;
create policy "in_app_notification_reads_insert_own"
on public.in_app_notification_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

grant select, insert on public.in_app_notification_reads to authenticated;

-- Atomic, idempotent RPC to mark a committed event notification as read
create or replace function public.mark_in_app_notification_read(
  p_org_id uuid,
  p_audit_event_id uuid
)
returns public.in_app_notification_reads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_receipt public.in_app_notification_reads;
begin
  if v_caller_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not public.is_active_org_member(p_org_id) then
    raise exception 'Active organization membership required'
      using errcode = '42501';
  end if;

  insert into public.in_app_notification_reads (
    organization_id,
    audit_event_id,
    user_id,
    read_at
  )
  values (
    p_org_id,
    p_audit_event_id,
    v_caller_id,
    clock_timestamp()
  )
  on conflict (organization_id, audit_event_id, user_id) do nothing;

  select *
    into v_receipt
    from public.in_app_notification_reads r
   where r.organization_id = p_org_id
     and r.audit_event_id = p_audit_event_id
     and r.user_id = v_caller_id;

  return v_receipt;
end;
$$;

revoke all on function public.mark_in_app_notification_read(uuid, uuid) from public;
grant execute on function public.mark_in_app_notification_read(uuid, uuid) to authenticated;
