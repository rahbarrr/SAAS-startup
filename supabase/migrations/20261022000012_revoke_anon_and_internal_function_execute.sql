-- Migration 12: Revoke direct anon privileges and internal trigger function execution.
-- Rationale:
-- Hosted Supabase grants ALL on objects created in public to anon, authenticated, and service_role
-- via DEFAULT PRIVILEGES. While RLS protects table data, revoking table/sequence privileges from
-- anon provides defense-in-depth against unauthorized access and schema introspection.
-- Furthermore, trigger functions must never be directly executable by client roles, and business
-- logic RPCs (except pre-auth consume_rate_limit) must not be executable by anon.

begin;

-- 1. Revoke default privileges on future objects in schema public from anon
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 2. Revoke table and sequence privileges from anon on existing objects
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 3. Revoke EXECUTE from anon and public on business logic functions (authenticated retained)
revoke execute on function public.accept_organization_invitation(text) from public, anon;
revoke execute on function public.can_employee_edit_visit(uuid, uuid) from public, anon;
revoke execute on function public.can_read_visit_evidence_storage(uuid, uuid) from public, anon;
revoke execute on function public.check_in_trip_stop(uuid, uuid, text, double precision, double precision, double precision, text) from public, anon;
revoke execute on function public.check_out_visit(uuid, uuid, text, text, double precision, double precision, double precision, text) from public, anon;
revoke execute on function public.create_organization_with_owner(text, text) from public, anon;
revoke execute on function public.decide_submitted_trip(uuid, uuid, public.trip_status, text, jsonb) from public, anon;
revoke execute on function public.has_active_org_role(uuid, public.org_role[]) from public, anon;
revoke execute on function public.is_active_org_member(uuid) from public, anon;
revoke execute on function public.mark_in_app_notification_read(uuid, uuid) from public, anon;

-- 4. Revoke EXECUTE from public, anon, and authenticated on trigger functions
revoke execute on function public.enforce_in_app_notification_read_invariants() from public, anon, authenticated;
revoke execute on function public.enforce_profile_identity_immutability() from public, anon, authenticated;
revoke execute on function public.enforce_trip_audit_events_invariants() from public, anon, authenticated;
revoke execute on function public.enforce_trip_stops_mutation_guard() from public, anon, authenticated;
revoke execute on function public.enforce_trip_workflow_and_decision_rules() from public, anon, authenticated;
revoke execute on function public.enforce_visit_ai_report_draft_invariants() from public, anon, authenticated;
revoke execute on function public.enforce_visit_lifecycle_invariants() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

commit;
