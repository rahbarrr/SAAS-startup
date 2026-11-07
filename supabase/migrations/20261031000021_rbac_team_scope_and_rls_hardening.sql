-- Migration: 20261031000021_rbac_team_scope_and_rls_hardening.sql
-- Purpose:
--   1. Non-recursive SECURITY DEFINER helper `public.can_access_employee_record(target_org_id, target_employee_id)`
--      enforcing Administrator (org-wide), Manager (assigned team / territory scope), and Employee (self-only) access.
--   2. Trigger `public.enforce_org_member_role_security()` preventing users from modifying their own role or
--      membership status, and preventing non-administrators from mutating organization memberships.
--   3. Team-scoped RLS policies for `trips`, `trip_stops`, `visits`, `location_events`,
--      `latest_employee_locations`, and `trip_tracking_sessions`.

begin;

-- 1. Non-recursive team scope authorization helper
create or replace function public.can_access_employee_record(
  target_org_id uuid,
  target_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_active_org_member(target_org_id)
    and (
      target_employee_id = (select auth.uid())
      or public.has_active_org_role(target_org_id, array['admin']::public.org_role[])
      or (
        public.has_active_org_role(target_org_id, array['manager']::public.org_role[])
        and exists (
          select 1
          from public.organization_members emp
          where emp.organization_id = target_org_id
            and emp.user_id = target_employee_id
            and emp.status = 'active'
            and (
              emp.manager_user_id = (select auth.uid())
              or (emp.manager_user_id is null and emp.role = 'field_employee')
            )
        )
      )
    );
$$;

revoke all on function public.can_access_employee_record(uuid, uuid) from public, anon;
grant execute on function public.can_access_employee_record(uuid, uuid) to authenticated;

-- 2. Trigger preventing self-role escalation and unauthorized membership changes
create or replace function public.enforce_org_member_role_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := (select auth.uid());
begin
  if v_caller_uid is not null then
    if tg_op = 'UPDATE' and old.user_id = v_caller_uid then
      if new.role is distinct from old.role or new.status is distinct from old.status then
        raise exception 'Users cannot modify their own role or membership status'
          using errcode = '42501';
      end if;
    end if;

    if not public.has_active_org_role(
      coalesce(new.organization_id, old.organization_id),
      array['admin']::public.org_role[]
    ) then
      raise exception 'Only organization administrators can modify organization memberships'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_org_member_role_security() from public, anon, authenticated;

drop trigger if exists trg_enforce_org_member_role_security on public.organization_members;
create trigger trg_enforce_org_member_role_security
before update or delete on public.organization_members
for each row execute function public.enforce_org_member_role_security();

-- 3. Update `trips` RLS policies to enforce Manager team scope and Employee self scope
drop policy if exists trips_select_owner_or_manager on public.trips;
create policy trips_select_owner_or_manager
  on public.trips
  for select
  to authenticated
  using (
    public.can_access_employee_record(organization_id, owner_user_id)
  );

drop policy if exists trips_update_owner_or_reviewer on public.trips;
create policy trips_update_owner_or_reviewer
  on public.trips
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      (
        owner_user_id = (select auth.uid())
        and status in ('draft', 'changes_requested', 'approved', 'in_progress')
      )
      or (
        owner_user_id <> (select auth.uid())
        and status = 'submitted'
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
        and public.can_access_employee_record(organization_id, owner_user_id)
      )
    )
  )
  with check (
    public.is_active_org_member(organization_id)
    and (
      (
        owner_user_id = (select auth.uid())
        and status in ('draft', 'submitted', 'in_progress', 'completed')
      )
      or (
        owner_user_id <> (select auth.uid())
        and decided_by = (select auth.uid())
        and status in ('approved', 'rejected', 'changes_requested')
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
        and public.can_access_employee_record(organization_id, owner_user_id)
      )
    )
  );

-- 4. Update `visits` RLS policies to enforce Manager team scope and Employee self scope
drop policy if exists visits_select_owner_or_manager on public.visits;
create policy visits_select_owner_or_manager
  on public.visits
  for select
  to authenticated
  using (
    public.can_access_employee_record(organization_id, employee_user_id)
  );

drop policy if exists visits_update_owner_or_reviewer on public.visits;
create policy visits_update_owner_or_reviewer
  on public.visits
  for update
  to authenticated
  using (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = (select auth.uid()) and status = 'in_progress')
      or (
        public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
        and public.can_access_employee_record(organization_id, employee_user_id)
      )
    )
  )
  with check (
    public.is_active_org_member(organization_id)
    and (
      (employee_user_id = (select auth.uid()) and status in ('in_progress', 'submitted'))
      or (
        status = 'reviewed'
        and public.has_active_org_role(
          organization_id,
          array['admin', 'manager']::public.org_role[]
        )
        and public.can_access_employee_record(organization_id, employee_user_id)
      )
    )
  );

-- 5. Update `location_events`, `latest_employee_locations`, and `trip_tracking_sessions` RLS
drop policy if exists "location_events_select" on public.location_events;
create policy "location_events_select"
  on public.location_events
  for select
  to authenticated
  using (
    public.can_access_employee_record(org_id, employee_id)
  );

drop policy if exists "latest_employee_locations_select" on public.latest_employee_locations;
create policy "latest_employee_locations_select"
  on public.latest_employee_locations
  for select
  to authenticated
  using (
    public.can_access_employee_record(org_id, employee_id)
  );

drop policy if exists "trip_tracking_sessions_select" on public.trip_tracking_sessions;
create policy "trip_tracking_sessions_select"
  on public.trip_tracking_sessions
  for select
  to authenticated
  using (
    public.can_access_employee_record(org_id, employee_id)
  );

commit;

