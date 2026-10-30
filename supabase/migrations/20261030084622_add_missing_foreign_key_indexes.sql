-- Add covering indexes for foreign keys reported by the Supabase performance advisor.
-- This reduces parent-row delete/update checks and improves tenant-scoped joins.

CREATE INDEX IF NOT EXISTS idx_in_app_notification_reads_audit_event_id_fk ON public.in_app_notification_reads (audit_event_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_accepted_by_fk ON public.organization_invitations (accepted_by);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_organization_id_invited_by_fk ON public.organization_invitations (organization_id, invited_by);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id_manager_user_id_fk ON public.organization_members (organization_id, manager_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by_fk ON public.organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_digest_records_recipient_user_id_fk ON public.scheduled_digest_records (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_trip_audit_events_organization_id_actor_user_id_fk ON public.trip_audit_events (organization_id, actor_user_id);
CREATE INDEX IF NOT EXISTS idx_trip_audit_events_trip_id_organization_id_fk ON public.trip_audit_events (trip_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_trip_location_breadcrumbs_trip_id_organization_id_fk ON public.trip_location_breadcrumbs (trip_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_trip_location_breadcrumbs_organization_id_user_id_fk ON public.trip_location_breadcrumbs (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_store_id_organization_id_fk ON public.trip_stops (store_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id_organization_id_fk ON public.trip_stops (trip_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_trips_organization_id_decided_by_fk ON public.trips (organization_id, decided_by);
CREATE INDEX IF NOT EXISTS idx_visit_ai_report_drafts_visit_id_organization_id_fk ON public.visit_ai_report_drafts (visit_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_ai_report_drafts_created_by_fk ON public.visit_ai_report_drafts (created_by);
CREATE INDEX IF NOT EXISTS idx_visit_ai_report_drafts_reviewed_by_fk ON public.visit_ai_report_drafts (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_visit_ai_report_drafts_visit_id_fk ON public.visit_ai_report_drafts (visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_checklist_items_organization_id_completed_by_fk ON public.visit_checklist_items (organization_id, completed_by);
CREATE INDEX IF NOT EXISTS idx_visit_checklist_items_visit_id_organization_id_fk ON public.visit_checklist_items (visit_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_evidence_organization_id_uploaded_by_fk ON public.visit_evidence (organization_id, uploaded_by);
CREATE INDEX IF NOT EXISTS idx_visit_evidence_visit_id_organization_id_fk ON public.visit_evidence (visit_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_geofence_events_trip_stop_id_organization_id_fk ON public.visit_geofence_events (trip_stop_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_geofence_events_store_id_organization_id_fk ON public.visit_geofence_events (store_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_geofence_events_trip_id_organization_id_fk ON public.visit_geofence_events (trip_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_geofence_events_visit_id_fk ON public.visit_geofence_events (visit_id);
CREATE INDEX IF NOT EXISTS idx_visits_trip_stop_id_organization_id_fk ON public.visits (trip_stop_id, organization_id);
