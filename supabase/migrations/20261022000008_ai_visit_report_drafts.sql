-- ============================================================================
-- Migration: 20261022000008_ai_visit_report_drafts.sql
-- Purpose:
--   1. Add organization-level feature flag (`ai_report_drafts_enabled`) and
--      daily quota (`ai_daily_draft_quota`) to `public.organizations`.
--   2. Create `public.visit_ai_report_drafts` to store structured AI-generated
--      visit report drafts with model/version provenance, allowlisted source
--      record IDs, uncertainty disclosures, and human review/approval status.
--   3. Enforce tenant isolation, quota limits, immutable provenance fields, and
--      human review invariants via database triggers and Row-Level Security.
-- ============================================================================

-- 1. Organization-level AI feature flag and daily quota
alter table public.organizations
  add column if not exists ai_report_drafts_enabled boolean not null default true,
  add column if not exists ai_daily_draft_quota integer not null default 25
    check (ai_daily_draft_quota >= 0 and ai_daily_draft_quota <= 10000);

-- 2. Structured AI Visit Report Drafts table
create table if not exists public.visit_ai_report_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  model_name text not null
    check (char_length(btrim(model_name)) between 1 and 120),
  model_version text null
    check (model_version is null or char_length(btrim(model_version)) <= 120),
  prompt_template_version text not null
    check (char_length(btrim(prompt_template_version)) between 1 and 64),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'approved', 'rejected')),
  summary text not null
    check (char_length(btrim(summary)) between 1 and 4000),
  completed_actions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_actions) = 'array'),
  issues jsonb not null default '[]'::jsonb
    check (jsonb_typeof(issues) = 'array'),
  follow_ups jsonb not null default '[]'::jsonb
    check (jsonb_typeof(follow_ups) = 'array'),
  uncertainty_notes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(uncertainty_notes) = 'array'),
  source_record_ids jsonb not null
    check (jsonb_typeof(source_record_ids) = 'object'),
  input_tokens integer null
    check (input_tokens is null or input_tokens >= 0),
  output_tokens integer null
    check (output_tokens is null or output_tokens >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null
    check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_visit_ai_report_drafts_visit_org
    foreign key (visit_id, organization_id)
    references public.visits (id, organization_id)
    on delete cascade
);

create index if not exists idx_visit_ai_drafts_org_created
  on public.visit_ai_report_drafts (organization_id, created_at desc);

create index if not exists idx_visit_ai_drafts_org_visit
  on public.visit_ai_report_drafts (organization_id, visit_id, created_at desc);

-- 3. Trigger enforcing quota, feature flag, provenance immutability, and human review invariants
create or replace function public.enforce_visit_ai_report_draft_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ai_enabled boolean;
  v_daily_quota integer;
  v_today_count integer;
begin
  if tg_op = 'INSERT' then
    select o.ai_report_drafts_enabled, o.ai_daily_draft_quota
      into v_ai_enabled, v_daily_quota
      from public.organizations o
     where o.id = new.organization_id;

    if not coalesce(v_ai_enabled, false) then
      raise exception 'AI report drafts are disabled for this organization.'
        using errcode = '42501';
    end if;

    select count(*)::integer
      into v_today_count
      from public.visit_ai_report_drafts d
     where d.organization_id = new.organization_id
       and d.created_at >= date_trunc('day', now() at time zone 'UTC');

    if v_today_count >= coalesce(v_daily_quota, 0) then
      raise exception 'Organization daily AI report draft quota (%) exceeded.', v_daily_quota
        using errcode = 'P0001';
    end if;

    if not (new.source_record_ids ? 'visit_id')
       or (new.source_record_ids ->> 'visit_id') <> new.visit_id::text then
      raise exception 'source_record_ids.visit_id must match visit_id.'
        using errcode = '22023';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id
       or new.visit_id <> old.visit_id
       or new.model_name <> old.model_name
       or new.model_version is distinct from old.model_version
       or new.prompt_template_version <> old.prompt_template_version
       or new.source_record_ids <> old.source_record_ids
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'AI draft provenance fields (model, version, source_record_ids, created_by, created_at) are immutable.'
        using errcode = '42501';
    end if;

    if new.review_status in ('approved', 'rejected') then
      if new.reviewed_by is null then
        new.reviewed_by := auth.uid();
      end if;
      if new.reviewed_at is null then
        new.reviewed_at := clock_timestamp();
      end if;
    end if;

    new.updated_at := clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_visit_ai_report_drafts_invariants on public.visit_ai_report_drafts;
create trigger trg_visit_ai_report_drafts_invariants
before insert or update on public.visit_ai_report_drafts
for each row execute function public.enforce_visit_ai_report_draft_invariants();

-- 4. Enable and force Row-Level Security on visit_ai_report_drafts
alter table public.visit_ai_report_drafts enable row level security;
alter table public.visit_ai_report_drafts force row level security;

drop policy if exists "visit_ai_report_drafts_select_authorized" on public.visit_ai_report_drafts;
create policy "visit_ai_report_drafts_select_authorized"
on public.visit_ai_report_drafts
for select
to authenticated
using (
  public.has_active_org_role(
    organization_id,
    array['admin', 'manager']::public.org_role[]
  )
  or exists (
    select 1
      from public.visits v
     where v.id = visit_ai_report_drafts.visit_id
       and v.organization_id = visit_ai_report_drafts.organization_id
       and v.employee_user_id = auth.uid()
       and public.is_active_org_member(visit_ai_report_drafts.organization_id)
  )
);

drop policy if exists "visit_ai_report_drafts_insert_authorized" on public.visit_ai_report_drafts;
create policy "visit_ai_report_drafts_insert_authorized"
on public.visit_ai_report_drafts
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.has_active_org_role(
      organization_id,
      array['admin', 'manager']::public.org_role[]
    )
    or exists (
      select 1
        from public.visits v
       where v.id = visit_ai_report_drafts.visit_id
         and v.organization_id = visit_ai_report_drafts.organization_id
         and v.employee_user_id = auth.uid()
         and public.is_active_org_member(visit_ai_report_drafts.organization_id)
    )
  )
);

drop policy if exists "visit_ai_report_drafts_update_authorized" on public.visit_ai_report_drafts;
create policy "visit_ai_report_drafts_update_authorized"
on public.visit_ai_report_drafts
for update
to authenticated
using (
  public.has_active_org_role(
    organization_id,
    array['admin', 'manager']::public.org_role[]
  )
  or exists (
    select 1
      from public.visits v
     where v.id = visit_ai_report_drafts.visit_id
       and v.organization_id = visit_ai_report_drafts.organization_id
       and v.employee_user_id = auth.uid()
       and public.is_active_org_member(visit_ai_report_drafts.organization_id)
  )
)
with check (
  public.has_active_org_role(
    organization_id,
    array['admin', 'manager']::public.org_role[]
  )
  or exists (
    select 1
      from public.visits v
     where v.id = visit_ai_report_drafts.visit_id
       and v.organization_id = visit_ai_report_drafts.organization_id
       and v.employee_user_id = auth.uid()
       and public.is_active_org_member(visit_ai_report_drafts.organization_id)
  )
);

grant select, insert, update on public.visit_ai_report_drafts to authenticated;
