-- Preserve immutable audit history when an Auth account is deleted.
-- actor_user_id is a historical identifier, not a guarantee that the Auth user
-- still exists. ON DELETE SET NULL attempts to UPDATE the audit row and violates
-- the append-only trigger. Keep the UUID as a tombstone instead of mutating history.
-- The migration version matches the change already applied and recorded in production.

begin;

alter table public.organization_audit_events
  drop constraint if exists organization_audit_events_actor_user_id_fkey;

comment on column public.organization_audit_events.actor_user_id is
  'Historical actor UUID; intentionally not FK-constrained to auth.users so deleting an account does not mutate immutable audit records.';

commit;
