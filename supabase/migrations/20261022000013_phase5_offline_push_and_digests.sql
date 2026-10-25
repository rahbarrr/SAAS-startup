-- ============================================================================
-- Migration: 20261022000013_phase5_offline_push_and_digests.sql
-- Purpose:
--   1. Create `public.web_push_subscriptions` for storing Web Push API credentials
--      scoped strictly to user and tenant organization with full RLS.
--   2. Create `public.scheduled_digest_records` for manager daily digest delivery
--      tracking and idempotency (unique on organization, recipient, and date).
-- ============================================================================

-- 1. Web Push Subscriptions Table
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_web_push_subscriptions unique (organization_id, user_id, endpoint)
);

create index if not exists idx_web_push_subscriptions_user_org
  on public.web_push_subscriptions (user_id, organization_id)
  where revoked = false;

alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_subscriptions force row level security;

drop policy if exists "web_push_subscriptions_select_own" on public.web_push_subscriptions;
create policy "web_push_subscriptions_select_own"
on public.web_push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

drop policy if exists "web_push_subscriptions_insert_own" on public.web_push_subscriptions;
create policy "web_push_subscriptions_insert_own"
on public.web_push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

drop policy if exists "web_push_subscriptions_update_own" on public.web_push_subscriptions;
create policy "web_push_subscriptions_update_own"
on public.web_push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

drop policy if exists "web_push_subscriptions_delete_own" on public.web_push_subscriptions;
create policy "web_push_subscriptions_delete_own"
on public.web_push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_org_member(organization_id)
);

grant select, insert, update, delete on public.web_push_subscriptions to authenticated;

-- 2. Scheduled Digest Records Table (Idempotent Daily Manager Digests)
create table if not exists public.scheduled_digest_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  digest_date date not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  summary jsonb not null default '{}'::jsonb,
  delivery_status text not null check (delivery_status in ('delivered', 'unconfigured', 'failed')),
  delivery_error text,
  sent_at timestamptz not null default now(),
  constraint uq_scheduled_digest_records unique (organization_id, recipient_user_id, digest_date)
);

create index if not exists idx_scheduled_digest_records_lookup
  on public.scheduled_digest_records (organization_id, digest_date, recipient_user_id);

alter table public.scheduled_digest_records enable row level security;
alter table public.scheduled_digest_records force row level security;

drop policy if exists "scheduled_digest_records_select_authorized" on public.scheduled_digest_records;
create policy "scheduled_digest_records_select_authorized"
on public.scheduled_digest_records
for select
to authenticated
using (
  public.is_active_org_member(organization_id)
  and (
    recipient_user_id = auth.uid()
    or public.has_active_org_role(organization_id, array['manager', 'admin']::public.org_role[])
  )
);

grant select on public.scheduled_digest_records to authenticated;
