-- Fix mutable search_path advisor warnings on trigger functions.
-- These functions use trusted public objects and do not need caller-controlled
-- schema resolution. The settings match the migration already applied to production.

begin;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.enforce_trip_audit_events_invariants()
  set search_path = public, pg_temp;

commit;
