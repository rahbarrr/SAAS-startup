/**
 * Explicit PostgreSQL database schema types corresponding to versioned migrations
 * under `supabase/migrations/`.
 */
export type DbOrgRole = "admin" | "manager" | "field_employee";
export type DbMembershipStatus = "invited" | "active" | "deactivated";
export type DbOrganizationStatus = "active" | "suspended" | "archived";
export type DbInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type DbTripStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "changes_requested"
  | "rejected"
  | "in_progress"
  | "completed";

export type DbTripStopStatus = "planned" | "visited" | "skipped";
export type DbVisitStatus = "in_progress" | "submitted" | "reviewed";
export type DbVisitLocationStatus =
  "captured_unverified" | "permission_denied" | "unavailable";
export type DbChecklistAnswerType = "boolean" | "text" | "number" | "select";
export type DbAiDraftReviewStatus = "pending_review" | "approved" | "rejected";

export type DbTripAuditEventType =
  | "trip_created"
  | "trip_updated"
  | "trip_submitted"
  | "trip_resubmitted"
  | "trip_approved"
  | "trip_changes_requested"
  | "trip_rejected"
  | "trip_reopened_for_edit"
  | "trip_started"
  | "trip_completed";

export interface DbProfileRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface DbOrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: DbOrganizationStatus;
  ai_report_drafts_enabled: boolean;
  ai_daily_draft_quota: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  industry?: string;
  company_size?: string;
  country?: string;
  website?: string | null;
  phone?: string | null;
}

export interface DbOrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: DbOrgRole;
  status: DbMembershipStatus;
  manager_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrganizationInvitationRow {
  id: string;
  organization_id: string;
  invited_email: string;
  role: DbOrgRole;
  token_hash: string;
  invited_by: string;
  status: DbInvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbStoreRow {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_province: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbTripRow {
  id: string;
  organization_id: string;
  owner_user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  purpose: string;
  start_location: string | null;
  destination_city: string | null;
  status: DbTripStatus;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTripStopRow {
  id: string;
  organization_id: string;
  trip_id: string;
  store_id: string;
  sequence_number: number;
  planned_at: string | null;
  status: DbTripStopStatus;
  created_at: string;
  updated_at: string;
}

export interface DbVisitRow {
  id: string;
  organization_id: string;
  trip_stop_id: string;
  employee_user_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_location_status: DbVisitLocationStatus;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy_m: number | null;
  check_out_location_status: DbVisitLocationStatus;
  check_in_idempotency_key: string | null;
  check_out_idempotency_key: string | null;
  check_in_source?: string | null;
  check_out_source?: string | null;
  check_in_device_timestamp?: string | null;
  check_out_device_timestamp?: string | null;
  verification_status?: string | null;
  verification_notes?: string | null;
  geofence_radius_meters?: number | null;
  notes: string;
  status: DbVisitStatus;
  created_at: string;
  updated_at: string;
}

export interface DbVisitGeofenceEventRow {
  id: string;
  organization_id: string;
  trip_id: string;
  trip_stop_id: string;
  store_id: string;
  employee_user_id: string;
  visit_id: string | null;
  event_type: string;
  client_event_id: string;
  device_recorded_at: string;
  server_received_at: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  geofence_radius_meters: number;
  dwell_time_seconds: number | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export interface DbVisitChecklistItemRow {
  id: string;
  organization_id: string;
  visit_id: string;
  question_key: string;
  label: string;
  answer_type: DbChecklistAnswerType;
  answer_value: unknown;
  answer_text: string | null;
  flagged: boolean;
  required: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVisitEvidenceRow {
  id: string;
  organization_id: string;
  visit_id: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  caption: string;
  uploaded_by: string;
  idempotency_key: string | null;
  created_at: string;
}

export interface DbTripAuditEventRow {
  id: string;
  organization_id: string;
  trip_id: string;
  actor_user_id: string;
  event_type: DbTripAuditEventType;
  old_status: DbTripStatus | null;
  new_status: DbTripStatus;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbVisitAiReportDraftRow {
  id: string;
  organization_id: string;
  visit_id: string;
  model_name: string;
  model_version: string | null;
  prompt_template_version: string;
  review_status: DbAiDraftReviewStatus;
  summary: string;
  completed_actions: unknown[];
  issues: unknown[];
  follow_ups: unknown[];
  uncertainty_notes: string[];
  source_record_ids: {
    visit_id: string;
    checklist_item_ids: string[];
    evidence_ids: string[];
  };
  input_tokens: number | null;
  output_tokens: number | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInAppNotificationReadRow {
  organization_id: string;
  audit_event_id: string;
  user_id: string;
  read_at: string;
}

export interface DbOrganizationAuditEventRow {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_role: DbOrgRole | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  correlation_id: string | null;
  reason: string | null;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbTripLocationBreadcrumbRow {
  id: string;
  organization_id: string;
  trip_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: DbProfileRow;
      };
      organizations: {
        Row: DbOrganizationRow;
      };
      organization_members: {
        Row: DbOrganizationMemberRow;
      };
      organization_invitations: {
        Row: DbOrganizationInvitationRow;
      };
      stores: {
        Row: DbStoreRow;
      };
      trips: {
        Row: DbTripRow;
      };
      trip_stops: {
        Row: DbTripStopRow;
      };
      visits: {
        Row: DbVisitRow;
      };
      visit_checklist_items: {
        Row: DbVisitChecklistItemRow;
      };
      visit_evidence: {
        Row: DbVisitEvidenceRow;
      };
      trip_audit_events: {
        Row: DbTripAuditEventRow;
      };
      visit_ai_report_drafts: {
        Row: DbVisitAiReportDraftRow;
      };
      in_app_notification_reads: {
        Row: DbInAppNotificationReadRow;
      };
      organization_audit_events: {
        Row: DbOrganizationAuditEventRow;
      };
      trip_location_breadcrumbs: {
        Row: DbTripLocationBreadcrumbRow;
      };
    };
    Enums: {
      org_role: DbOrgRole;
      membership_status: DbMembershipStatus;
      organization_status: DbOrganizationStatus;
      invitation_status: DbInvitationStatus;
      trip_status: DbTripStatus;
      trip_stop_status: DbTripStopStatus;
      visit_status: DbVisitStatus;
      checklist_answer_type: DbChecklistAnswerType;
      trip_audit_event_type: DbTripAuditEventType;
    };
    Functions: {
      is_active_org_member: {
        Args: { target_org_id: string };
        Returns: boolean;
      };
      has_active_org_role: {
        Args: { target_org_id: string; allowed_roles: DbOrgRole[] };
        Returns: boolean;
      };
      can_employee_edit_visit: {
        Args: { target_org_id: string; target_visit_id: string };
        Returns: boolean;
      };
      create_organization_with_company_profile: {
        Args: {
          p_name: string;
          p_slug: string;
          p_industry: string;
          p_company_size: string;
          p_country: string;
          p_website: string | null;
          p_phone: string | null;
        };
        Returns: DbOrganizationRow;
      };
      accept_organization_invitation: {
        Args: { p_token_hash: string };
        Returns: DbOrganizationMemberRow;
      };
      decide_submitted_trip: {
        Args: {
          p_org_id: string;
          p_trip_id: string;
          p_decision: DbTripStatus;
          p_note?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: DbTripRow;
      };
      check_in_trip_stop: {
        Args: {
          p_org_id: string;
          p_trip_stop_id: string;
          p_idempotency_key?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_accuracy_m?: number | null;
          p_location_status?: DbVisitLocationStatus;
        };
        Returns: DbVisitRow;
      };
      check_out_visit: {
        Args: {
          p_org_id: string;
          p_visit_id: string;
          p_notes?: string | null;
          p_idempotency_key?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_accuracy_m?: number | null;
          p_location_status?: DbVisitLocationStatus;
        };
        Returns: DbVisitRow;
      };
      mark_in_app_notification_read: {
        Args: {
          p_org_id: string;
          p_audit_event_id: string;
        };
        Returns: DbInAppNotificationReadRow;
      };
    };
  };
}
