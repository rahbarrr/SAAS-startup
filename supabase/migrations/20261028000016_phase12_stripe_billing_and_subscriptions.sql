-- Migration: 20261028000016_phase12_stripe_billing_and_subscriptions.sql
-- Purpose:
--   1. Create `public.organization_subscriptions` for organization-level SaaS billing,
--      seat limits, trial periods, 7-day payment failure grace periods, and plan entitlements.
--   2. Create `public.billing_webhook_events` for cryptographic webhook idempotency and
--      out-of-order timestamp protection.
--   3. Automatically provision a 14-day Pilot trial subscription when an organization is
--      created and safely backfill existing organizations without expiring pre-existing workspaces.
--   4. Enforce server-side subscription write-access (read-only lock on expired trial/grace period
--      or canceled/unpaid status) and plan/seat entitlement limits across stores, memberships,
--      invitations, trips, visits, and AI report drafts.
--   5. Enforce strict RLS, FORCE RLS, and privilege hardening across all billing objects.

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
    "max_stores": 15,
    "max_members": 5,
    "max_monthly_visits": 50,
    "ai_daily_draft_quota": 5,
    "storage_limit_bytes": 2147483648
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

create or replace function public.set_subscription_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.updated_at is null or new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_subscription_updated_at() from public, anon, authenticated;

drop trigger if exists trg_org_subscriptions_set_updated_at on public.organization_subscriptions;
create trigger trg_org_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_subscription_updated_at();

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
      "max_stores": 15,
      "max_members": 5,
      "max_monthly_visits": 50,
      "ai_daily_draft_quota": 5,
      "storage_limit_bytes": 2147483648
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

-- Sync `organizations.ai_daily_draft_quota` when subscription tier/entitlements are inserted or updated,
-- capping quota by plan tier ceiling so subscription updates cannot grant unintended AI entitlements.
create or replace function public.sync_org_ai_quota_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ai_quota integer;
  v_tier_cap integer;
begin
  v_tier_cap := case new.plan_tier
    when 'enterprise' then 2000
    when 'pro' then 50
    else 10
  end;
  v_ai_quota := least(
    v_tier_cap,
    greatest(0, coalesce((new.entitlements->>'ai_daily_draft_quota')::integer, 5))
  );
  update public.organizations
     set ai_daily_draft_quota = v_ai_quota
   where id = new.organization_id;
  return new;
end;
$$;

revoke all on function public.sync_org_ai_quota_from_subscription() from public, anon, authenticated;

drop trigger if exists trg_org_subscriptions_sync_ai_quota on public.organization_subscriptions;
create trigger trg_org_subscriptions_sync_ai_quota
after insert or update of plan_tier, entitlements on public.organization_subscriptions
for each row execute function public.sync_org_ai_quota_from_subscription();

-- 4. Database-level enforcement of subscription write-access and plan/seat entitlements
create or replace function public.enforce_organization_subscription_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.organization_subscriptions;
  v_new_json jsonb := to_jsonb(new);
  v_old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_org_id uuid := (v_new_json->>'organization_id')::uuid;
  v_row_id uuid := nullif(v_new_json->>'id', '')::uuid;
  v_write_allowed boolean := true;
  v_permitted_readonly_downsize boolean := false;
  v_active_stores integer;
  v_max_stores integer;
  v_current_seats integer;
  v_pending_invites integer;
  v_effective_seat_limit integer;
  v_member_email text;
  v_invited_email text;
  v_expires_at timestamptz;
  v_monthly_visits integer;
  v_max_monthly_visits integer;
  v_daily_ai_drafts integer;
  v_max_daily_ai_drafts integer;
begin
  select *
    into v_sub
    from public.organization_subscriptions s
   where s.organization_id = v_org_id;

  -- If no subscription record exists yet (e.g. initial owner insert during org creation), allow
  if not found then
    return new;
  end if;

  if v_sub.status = 'active' then
    v_write_allowed := true;
  elsif v_sub.status = 'trialing' then
    v_write_allowed := (v_sub.trial_end is null or v_sub.trial_end > clock_timestamp());
  elsif v_sub.status = 'past_due' then
    v_write_allowed := (v_sub.grace_period_ends_at is not null and v_sub.grace_period_ends_at > clock_timestamp());
  else
    v_write_allowed := false;
  end if;

  -- Permit narrowly-scoped administrative downsizing/cancellation operations even in read-only mode
  if tg_op = 'UPDATE' then
    if tg_table_name = 'stores' and (v_old_json->>'active') = 'true' and (v_new_json->>'active') = 'false' then
      v_permitted_readonly_downsize := true;
    elsif tg_table_name = 'organization_members' and coalesce(v_old_json->>'status', '') <> 'deactivated' and (v_new_json->>'status') = 'deactivated' then
      v_permitted_readonly_downsize := true;
    elsif tg_table_name = 'organization_invitations' and coalesce(v_old_json->>'status', '') <> 'revoked' and (v_new_json->>'status') = 'revoked' then
      v_permitted_readonly_downsize := true;
    elsif tg_table_name = 'trips' and coalesce(v_old_json->>'status', '') <> 'cancelled' and (v_new_json->>'status') = 'cancelled' then
      v_permitted_readonly_downsize := true;
    end if;
  end if;

  if not v_write_allowed and not v_permitted_readonly_downsize then
    raise exception 'Organization subscription is inactive or expired (status: %). Workspace is in read-only mode until billing is updated.', v_sub.status
      using errcode = '42501';
  end if;

  if v_permitted_readonly_downsize then
    return new;
  end if;

  if tg_table_name = 'stores' then
    if (v_new_json->>'active') = 'true' and (tg_op = 'INSERT' or (v_old_json->>'active') = 'false') then
      v_max_stores := coalesce((v_sub.entitlements->>'max_stores')::integer, 15);
      select count(*)::integer
        into v_active_stores
        from public.stores st
       where st.organization_id = v_org_id
         and st.active = true
         and (tg_op = 'INSERT' or st.id is distinct from v_row_id);

      if v_active_stores >= v_max_stores then
        raise exception 'Plan store limit reached (%/% active stores). Upgrade your subscription plan to add more stores.', v_active_stores, v_max_stores
          using errcode = '22023';
      end if;
    end if;
  elsif tg_table_name = 'organization_members' then
    if (v_new_json->>'status') in ('active', 'invited') and (
      tg_op = 'INSERT'
      or (v_old_json->>'status') = 'deactivated'
      or ((v_old_json->>'status') = 'invited' and (v_new_json->>'status') = 'active')
    ) then
      v_effective_seat_limit := least(
        v_sub.seat_count,
        coalesce((v_sub.entitlements->>'max_members')::integer, v_sub.seat_count)
      );

      select count(*)::integer
        into v_current_seats
        from public.organization_members m
       where m.organization_id = v_org_id
         and m.status in ('active', 'invited')
         and (tg_op = 'INSERT' or m.id is distinct from v_row_id);

      select lower(trim(p.email))
        into v_member_email
        from public.profiles p
       where p.id = nullif(v_new_json->>'user_id', '')::uuid;

      select count(distinct lower(trim(i.invited_email)))::integer
        into v_pending_invites
        from public.organization_invitations i
       where i.organization_id = v_org_id
         and i.status = 'pending'
         and i.expires_at > clock_timestamp()
         and (v_member_email is null or lower(trim(i.invited_email)) <> v_member_email)
         and not exists (
           select 1
             from public.organization_members m2
             join public.profiles p2 on p2.id = m2.user_id
            where m2.organization_id = v_org_id
              and m2.status in ('active', 'invited')
              and lower(trim(p2.email)) = lower(trim(i.invited_email))
         );

      if (v_current_seats + v_pending_invites) >= v_effective_seat_limit then
        raise exception 'Workspace seat limit reached (%/% seats used). Increase your seat limit or upgrade your subscription plan.', (v_current_seats + v_pending_invites), v_effective_seat_limit
          using errcode = '22023';
      end if;
    end if;
  elsif tg_table_name = 'organization_invitations' then
    v_invited_email := lower(trim(coalesce(v_new_json->>'invited_email', '')));
    v_expires_at := nullif(v_new_json->>'expires_at', '')::timestamptz;
    if (v_new_json->>'status') = 'pending'
      and (tg_op = 'INSERT' or coalesce(v_old_json->>'status', '') <> 'pending')
      and (v_expires_at is null or v_expires_at > clock_timestamp())
    then
      v_effective_seat_limit := least(
        v_sub.seat_count,
        coalesce((v_sub.entitlements->>'max_members')::integer, v_sub.seat_count)
      );

      select count(*)::integer
        into v_current_seats
        from public.organization_members m
       where m.organization_id = v_org_id
         and m.status in ('active', 'invited');

      select count(distinct lower(trim(i.invited_email)))::integer
        into v_pending_invites
        from public.organization_invitations i
       where i.organization_id = v_org_id
         and i.status = 'pending'
         and i.expires_at > clock_timestamp()
         and (tg_op = 'INSERT' or i.id is distinct from v_row_id)
         and lower(trim(i.invited_email)) <> v_invited_email
         and not exists (
           select 1
             from public.organization_members m2
             join public.profiles p2 on p2.id = m2.user_id
            where m2.organization_id = v_org_id
              and m2.status in ('active', 'invited')
              and lower(trim(p2.email)) = lower(trim(i.invited_email))
         );

      if (v_current_seats + v_pending_invites) >= v_effective_seat_limit then
        raise exception 'Workspace seat limit reached (%/% seats allocated including pending invitations). Increase your seat limit or upgrade your plan.', (v_current_seats + v_pending_invites), v_effective_seat_limit
          using errcode = '22023';
      end if;
    end if;
  elsif tg_table_name = 'visits' then
    if tg_op = 'INSERT' then
      v_max_monthly_visits := coalesce((v_sub.entitlements->>'max_monthly_visits')::integer, 50);
      select count(*)::integer
        into v_monthly_visits
        from public.visits v
       where v.organization_id = v_org_id
         and v.checked_in_at >= date_trunc('month', clock_timestamp());

      if v_monthly_visits >= v_max_monthly_visits then
        raise exception 'Monthly visit limit reached (%/% visits this month). Upgrade your subscription plan to record additional visits.', v_monthly_visits, v_max_monthly_visits
          using errcode = '22023';
      end if;
    end if;
  elsif tg_table_name = 'visit_ai_report_drafts' then
    if tg_op = 'INSERT' then
      v_max_daily_ai_drafts := coalesce((v_sub.entitlements->>'ai_daily_draft_quota')::integer, 5);
      select count(*)::integer
        into v_daily_ai_drafts
        from public.visit_ai_report_drafts d
       where d.organization_id = v_org_id
         and d.created_at >= date_trunc('day', clock_timestamp());

      if v_daily_ai_drafts >= v_max_daily_ai_drafts then
        raise exception 'Daily AI report draft quota reached (%/% drafts today). Upgrade your subscription plan for higher AI capacity.', v_daily_ai_drafts, v_max_daily_ai_drafts
          using errcode = '22023';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_organization_subscription_entitlements() from public, anon, authenticated;

drop trigger if exists trg_stores_enforce_subscription_entitlements on public.stores;
create trigger trg_stores_enforce_subscription_entitlements
before insert or update on public.stores
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_org_members_enforce_subscription_entitlements on public.organization_members;
create trigger trg_org_members_enforce_subscription_entitlements
before insert or update on public.organization_members
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_org_invitations_enforce_subscription_entitlements on public.organization_invitations;
create trigger trg_org_invitations_enforce_subscription_entitlements
before insert or update on public.organization_invitations
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_trips_enforce_subscription_entitlements on public.trips;
create trigger trg_trips_enforce_subscription_entitlements
before insert or update on public.trips
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_trip_stops_enforce_subscription_entitlements on public.trip_stops;
create trigger trg_trip_stops_enforce_subscription_entitlements
before insert or update on public.trip_stops
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_visits_enforce_subscription_entitlements on public.visits;
create trigger trg_visits_enforce_subscription_entitlements
before insert or update on public.visits
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_visit_checklist_enforce_subscription_entitlements on public.visit_checklist_items;
create trigger trg_visit_checklist_enforce_subscription_entitlements
before insert or update on public.visit_checklist_items
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_visit_evidence_enforce_subscription_entitlements on public.visit_evidence;
create trigger trg_visit_evidence_enforce_subscription_entitlements
before insert or update on public.visit_evidence
for each row execute function public.enforce_organization_subscription_entitlements();

drop trigger if exists trg_ai_drafts_enforce_subscription_entitlements on public.visit_ai_report_drafts;
create trigger trg_ai_drafts_enforce_subscription_entitlements
before insert or update on public.visit_ai_report_drafts
for each row execute function public.enforce_organization_subscription_entitlements();

-- 5. Backfill existing organizations safely:
--    - Grants a full 14-day Pilot trial from migration execution (`clock_timestamp() + interval '14 days'`)
--      so pre-existing organizations created >14 days ago are not immediately locked out.
--    - Preserves at least the organization's current active+invited member count in `seat_count` and `max_members`.
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
  greatest(
    5,
    (
      select count(*)::integer
        from public.organization_members m
       where m.organization_id = o.id
         and m.status in ('active', 'invited')
    )
  ),
  clock_timestamp(),
  clock_timestamp() + interval '14 days',
  jsonb_build_object(
    'max_stores', 15,
    'max_members', greatest(
      5,
      (
        select count(*)::integer
          from public.organization_members m
         where m.organization_id = o.id
           and m.status in ('active', 'invited')
      )
    ),
    'max_monthly_visits', 50,
    'ai_daily_draft_quota', coalesce(o.ai_daily_draft_quota, 5),
    'storage_limit_bytes', 2147483648
  )
from public.organizations o
where not exists (
  select 1
    from public.organization_subscriptions s
   where s.organization_id = o.id
)
on conflict (organization_id) do nothing;

commit;
