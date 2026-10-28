-- Migration: 20261028000016_phase12_stripe_billing_and_subscriptions.sql
-- Purpose:
--   1. Create `public.organization_subscriptions` for organization-level SaaS billing,
--      seat limits, trial periods, 7-day payment failure grace periods, and plan entitlements.
--   2. Create `public.billing_webhook_events` for cryptographic webhook idempotency and
--      out-of-order timestamp protection.
--   3. Automatically provision a 14-day Pilot trial subscription when an organization is
--      created and backfill existing organizations.
--   4. Enforce strict RLS, FORCE RLS, and privilege hardening across all billing objects.

begin;

-- 1. Create `public.organization_subscriptions`
create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_provider text not null default 'stripe',
  provider_customer_id text unique,
  provider_subscription_id text unique,
  plan_tier text not null default 'pilot',
  status text not null default 'trialing',
  seat_count integer not null default 5,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  trial_start timestamptz null default now(),
  trial_end timestamptz null default (now() + interval '14 days'),
  grace_period_ends_at timestamptz null,
  entitlements jsonb not null default '{
    "max_stores": 25,
    "max_members": 5,
    "max_monthly_visits": 250,
    "ai_daily_draft_quota": 25,
    "storage_limit_bytes": 1073741824
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_provider_chk check (
    billing_provider in ('stripe', 'manual')
  ),
  constraint organization_subscriptions_plan_tier_chk check (
    plan_tier in ('pilot', 'pro', 'enterprise')
  ),
  constraint organization_subscriptions_status_chk check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')
  ),
  constraint organization_subscriptions_seat_count_chk check (
    seat_count >= 1 and seat_count <= 10000
  )
);

create index if not exists idx_org_subscriptions_status
  on public.organization_subscriptions (status);

create index if not exists idx_org_subscriptions_customer
  on public.organization_subscriptions (provider_customer_id);

alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscriptions force row level security;

drop trigger if exists trg_org_subscriptions_set_updated_at on public.organization_subscriptions;
create trigger trg_org_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

-- RLS: Active members of the organization can view their workspace subscription & entitlements.
-- Client roles cannot directly INSERT, UPDATE, or DELETE subscription records.
drop policy if exists "organization_subscriptions_select" on public.organization_subscriptions;
create policy "organization_subscriptions_select"
on public.organization_subscriptions
for select
to authenticated
using (public.is_active_org_member(organization_id));

revoke all on table public.organization_subscriptions from public, anon, authenticated;
grant select on table public.organization_subscriptions to authenticated;

-- 2. Create `public.billing_webhook_events` for idempotent webhook processing
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  event_id text not null,
  event_type text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'processed',
  error_message text null,
  provider_created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  constraint billing_webhook_events_provider_event_uniq unique (provider, event_id),
  constraint billing_webhook_events_provider_chk check (
    provider in ('stripe', 'manual')
  ),
  constraint billing_webhook_events_status_chk check (
    status in ('processed', 'ignored_outdated', 'failed')
  )
);

create index if not exists idx_billing_webhook_events_org_created
  on public.billing_webhook_events (organization_id, processed_at desc);

alter table public.billing_webhook_events enable row level security;
alter table public.billing_webhook_events force row level security;

-- Webhook event log is strictly server/service_role only (no client access)
revoke all on table public.billing_webhook_events from public, anon, authenticated;

-- 3. Trigger to auto-provision a 14-day Pilot trial subscription when an organization is created
create or replace function public.provision_default_org_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_subscriptions (
    organization_id,
    billing_provider,
    plan_tier,
    status,
    seat_count,
    trial_start,
    trial_end,
    entitlements
  ) values (
    new.id,
    'stripe',
    'pilot',
    'trialing',
    5,
    clock_timestamp(),
    clock_timestamp() + interval '14 days',
    '{
      "max_stores": 25,
      "max_members": 5,
      "max_monthly_visits": 250,
      "ai_daily_draft_quota": 25,
      "storage_limit_bytes": 1073741824
    }'::jsonb
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_default_org_subscription() from public, anon, authenticated;

drop trigger if exists trg_organizations_provision_subscription on public.organizations;
create trigger trg_organizations_provision_subscription
after insert on public.organizations
for each row execute function public.provision_default_org_subscription();

-- Backfill any existing organizations that do not yet have a subscription row
insert into public.organization_subscriptions (
  organization_id,
  billing_provider,
  plan_tier,
  status,
  seat_count,
  trial_start,
  trial_end,
  entitlements
)
select
  o.id,
  'stripe',
  'pilot',
  'trialing',
  5,
  o.created_at,
  o.created_at + interval '14 days',
  '{
    "max_stores": 25,
    "max_members": 5,
    "max_monthly_visits": 250,
    "ai_daily_draft_quota": 25,
    "storage_limit_bytes": 1073741824
  }'::jsonb
from public.organizations o
where not exists (
  select 1
    from public.organization_subscriptions s
   where s.organization_id = o.id
);

commit;
