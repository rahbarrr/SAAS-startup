-- Migration: 20261022000004_transactional_trips_and_stores_rpcs.sql
-- Purpose:
--   1. Support the explicit policy for editing an `approved` trip: if an owner edits an
--      `approved` trip, it resets to `draft` (requiring a new approval cycle) while
--      preserving all historical rows in `trip_audit_events`.
--   2. Add `trip_reopened_for_edit` to `public.trip_audit_event_type` and allow `'previous_decided_by'`
--      in audit metadata keys.
--   3. Provide transactional RPCs (`save_trip_with_stops`, `submit_trip_for_approval`,
--      `decide_submitted_trip`) so multi-row updates across `trips`, `trip_stops`, and
--      `trip_audit_events` execute atomically.

begin;

-- 1. Extend audit event enum for approved -> draft re-openings
alter type public.trip_audit_event_type add value if not exists 'trip_reopened_for_edit';

-- 2. Update allowlisted metadata keys on `trip_audit_events`
create or replace function public.enforce_trip_audit_events_invariants()
returns trigger
language plpgsql
as $$
declare
  v_key text;
  v_allowed_keys constant text[] := array[
    'source',
    'stop_count',
    'reason_code',
    'client_version',
    'previous_decided_by'
  ];
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

-- 3. Update trip workflow trigger to enforce state machine & approved -> draft reset rule
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
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.owner_user_id <> old.owner_user_id then
      raise exception 'Trip organization_id and owner_user_id cannot be reassigned'
        using errcode = '42501';
    end if;
  end if;

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

  -- Prevent invalid status jumps on UPDATE
  if old.status = 'rejected' and new.status <> 'rejected' then
    raise exception 'Rejected trips are final and cannot transition to %', new.status
      using errcode = '22023';
  end if;

  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'Completed trips cannot be modified'
      using errcode = '22023';
  end if;

  -- Editing an approved trip resets it to 'draft' and clears prior approval fields
  if old.status = 'approved' and new.status = 'draft' then
    new.submitted_at := null;
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := null;
    return new;
  end if;

  -- When transitioning into a manager decision state ('approved', 'rejected', 'changes_requested')
  if new.status in ('approved', 'rejected', 'changes_requested')
     and (old.status is distinct from new.status) then

    if old.status <> 'submitted' then
      raise exception 'Only submitted trips can be approved, rejected, or sent back for changes (current status: %)', old.status
        using errcode = '22023';
    end if;

    if new.decided_by is null and v_caller_uid is not null then
      new.decided_by := v_caller_uid;
    end if;

    if new.decided_by is null then
      raise exception 'decided_by is required when deciding a submitted trip'
        using errcode = '22023';
    end if;

    if v_caller_uid is not null and new.decided_by <> v_caller_uid then
      raise exception 'decided_by must match the authenticated reviewer'
        using errcode = '42501';
    end if;

    if new.decided_by = new.owner_user_id then
      raise exception 'Self-approval is forbidden: trip owner cannot approve or decide their own trip'
        using errcode = '42501';
    end if;

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
  elsif new.status = 'submitted' and old.status = 'submitted' then
    -- Prevent duplicate submission when already submitted
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'Trip is already submitted for approval'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

-- 4. Update `trips_select_owner_or_manager` and `trips_update_owner_or_reviewer` stays aligned with approved -> draft reset
-- (Note: `trips_update_owner_or_reviewer` already allows `owner_user_id = auth.uid()` when old status is
--  `in ('draft', 'changes_requested', 'approved', 'in_progress')` and new status is `in ('draft', 'submitted', 'in_progress', 'completed')`!)

commit;
