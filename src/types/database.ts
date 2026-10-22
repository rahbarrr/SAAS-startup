/**
 * Explicit PostgreSQL database schema types corresponding to versioned migrations
 * under `supabase/migrations/`.
 * Note: `ai_summaries` is intentionally omitted until Phase 8 is approved.
 */
export type DbOrgRole = "admin" | "manager" | "field_employee";
export type DbMembershipStatus = "invited" | "active" | "deactivated";
export type DbOrganizationStatus = "active" | "suspended" | "archived";
export type DbInvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

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
export type DbChecklistAnswerType = "boolean" | "text" | "number" | "select";

export type DbTripAuditEventType =
  | "trip_created"
  | "trip_submitted"
  | "trip_approved"
  | "trip_changes_requested"
  | "trip_rejected"
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  check_out_lat: number | null;
  check_out_lng: number | null;
  notes: string;
  status: DbVisitStatus;
  created_at: string;
  updated_at: string;
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
      create_organization_with_owner: {
        Args: { p_name: string; p_slug: string };
        Returns: DbOrganizationRow;
      };
      accept_organization_invitation: {
        Args: { p_token_hash: string };
        Returns: DbOrganizationMemberRow;
      };
    };
  };
}
