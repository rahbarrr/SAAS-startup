-- Migration: 20261022000005_approval_inbox_and_atomic_decisions.sql
-- Purpose:
--   1. Extend `public.trip_audit_event_type` with `trip_resubmitted` and `trip_updated` so
--      all state-changing and relevant edit actions (submission, approval, rejection,
--      change request, resubmission, and edits) have explicit audit event types.
--   2. Harden `public.enforce_trip_audit_events_invariants()` to enforce allowlisted keys
--      and prevent non-scalar or oversized metadata values (no secrets/PII).
--   3. Add an index for the manager approval inbox (`idx_trips_org_approval_inbox`).
--   4. Create `public.decide_submitted_trip(...)` atomic transaction RPC with `FOR UPDATE`
--      row locking, conditional status check (`status = 'submitted'`), reviewer role and
--      non-owner verification, required explanation check for rejection/changes_requested,
--      and atomic `trip_audit_events` insertion.

begin;

-- 1. Extend `trip_audit_event_type` enum for resubmission and relevant edits
alter type public.trip_audit_event_type add value if not exists 'trip_resubmitted';
alter type public.trip_audit_event_type add value if not exists 'trip_updated';

-- 2. Harden allowlisted metadata validation on `trip_audit_events`
create or replace function public.enforce_trip_audit_events_invariants()
returns trigger
language plpgsql
as $$
declare
  v_key text;
  v_val jsonb;
  v_allowed_keys constant text[] := array[
    'source',
    'stop_count',
    'reason_code',
    'client_version',
    'previous_decided_by',
    'changed_fields'
  ];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'trip_audit_events is append-only and cannot be modified or deleted'
      using errcode = '42501';
  end if;

  if jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'trip_audit_events metadata must be a JSON object'
      using errcode = '22023';
  end if;

  for v_key, v_val in select * from jsonb_each(new.metadata)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'Disallowed metadata key "%" in trip_audit_events', v_key
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_val) not in ('string', 'number', 'boolean', 'null') then
      raise exception 'Metadata key "%" in trip_audit_events must be a scalar value', v_key
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_val) = 'string' and char_length(v_val #>> '{}') > 120 then
      raise exception 'Metadata key "%" exceeds maximum allowed length (120 chars)', v_key
        using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

-- 3. Index for Manager Approval Inbox filtering and sorting
create index if not exists idx_trips_org_approval_inbox
  on public.trips (organization_id, status, submitted_at desc, created_at desc);

-- 4. Atomic concurrency-safe manager decision transaction RPC
create or replace function public.decide_submitted_trip(
  p_org_id uuid,
  p_trip_id uuid,
  p_decision public.trip_status,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_trip public.trips;
  v_updated_trip public.trips;
  v_clean_note text := nullif(trim(coalesce(p_note, '')), '');
  v_event_type public.trip_audit_event_type;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required to decide a trip'
      using errcode = '28000';
  end if;

  if not public.has_active_org_role(
    p_org_id,
    array['admin'::public.org_role, 'manager'::public.org_role]
  ) then
    raise exception 'Only an active manager or admin of the organization can decide a trip'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid decision status "%": must be approved, changes_requested, or rejected', p_decision
      using errcode = '22023';
  end if;

  if p_decision in ('changes_requested', 'rejected')
     and (v_clean_note is null or char_length(v_clean_note) < 3) then
    raise exception 'A decision note of at least 3 characters is required when requesting changes or rejecting a trip'
      using errcode = '22023';
  end if;

  -- Lock the target trip row within the organization to serialize concurrent decision attempts
  select *
    into v_trip
    from public.trips t
   where t.id = p_trip_id
     and t.organization_id = p_org_id
     for update;

  if not found then
    raise exception 'Trip not found in organization'
      using errcode = 'P0002';
  end if;

  if v_trip.owner_user_id = v_caller_uid then
    raise exception 'Self-approval is forbidden: trip owner cannot approve or decide their own trip'
      using errcode = '42501';
  end if;

  if v_trip.status <> 'submitted' then
    raise exception 'Stale trip status: only submitted trips can be decided (current status: %)', v_trip.status
      using errcode = '40001';
  end if;

  -- Conditional update verifying status is still 'submitted'
  update public.trips t
     set status = p_decision,
         decided_by = v_caller_uid,
         decided_at = clock_timestamp(),
         decision_note = v_clean_note
   where t.id = p_trip_id
     and t.organization_id = p_org_id
     and t.status = 'submitted'
  returning * into v_updated_trip;

  if not found then
    raise exception 'Concurrent decision conflict: trip is no longer in submitted status'
      using errcode = '40001';
  end if;

  v_event_type := case p_decision
    when 'approved' then 'trip_approved'::public.trip_audit_event_type
    when 'changes_requested' then 'trip_changes_requested'::public.trip_audit_event_type
    when 'rejected' then 'trip_rejected'::public.trip_audit_event_type
  end;

  insert into public.trip_audit_events (
    organization_id,
    trip_id,
    actor_user_id,
    event_type,
    old_status,
    new_status,
    note,
    metadata,
    created_at
  ) values (
    p_org_id,
    p_trip_id,
    v_caller_uid,
    v_event_type,
    'submitted',
    p_decision,
    coalesce(v_clean_note, 'Trip approved by manager'),
    coalesce(p_metadata, '{}'::jsonb),
    clock_timestamp()
  );

  return v_updated_trip;
end;
$$;

revoke all on function public.decide_submitted_trip(uuid, uuid, public.trip_status, text, jsonb) from public;
grant execute on function public.decide_submitted_trip(uuid, uuid, public.trip_status, text, jsonb) to authenticated;

commit;
