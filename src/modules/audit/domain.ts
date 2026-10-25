import type { CursorPaginationMeta } from "@/lib/http/envelope";
import type { OrgRole } from "@/modules/tenancy/domain";

export const AUDIT_ACTION_TYPES = [
  "trip.created",
  "trip.updated",
  "trip.submitted",
  "trip.resubmitted",
  "trip.approved",
  "trip.rejected",
  "trip.changes_requested",
  "trip.reopened",
  "trip.route_optimized",
  "trip.started",
  "trip.completed",
  "trip.cancelled",
  "visit.checked_in",
  "visit.checked_out",
  "visit.checklist_saved",
  "evidence.uploaded",
  "evidence.deleted",
  "member.invited",
  "member.role_changed",
  "member.revoked",
  "org.settings_updated",
  "audit.exported",
  "location.tracking_started",
  "location.tracking_stopped",
  "location.breadcrumbs_purged",
  "ai.trip_plan_recommended",
  "ai.trip_plan_applied",
  "ai.manager_briefing_generated",
  "ai.briefing_action_updated",
  "ai.visit_report_drafted",
  "ai.visit_report_approved",
  "ai.visit_report_rejected",
] as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number] | (string & {});

export const AUDIT_ENTITY_TYPES = [
  "trip",
  "trip_stop",
  "visit",
  "visit_evidence",
  "member",
  "invitation",
  "organization",
  "audit_export",
  "location_breadcrumbs",
  "ai_trip_plan",
  "ai_manager_briefing",
  "ai_visit_report",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number] | (string & {});

export interface OrganizationAuditEvent {
  id: string;
  orgId: string;
  actorUserId: string | null;
  actorRole: OrgRole | null;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  correlationId: string | null;
  reason: string | null;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilter {
  actionType?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  startDateFrom?: string; // ISO 8601
  startDateTo?: string; // ISO 8601
  limit?: number;
  cursor?: string | null;
}

export interface PaginatedAuditEventsResult {
  items: OrganizationAuditEvent[];
  pagination: CursorPaginationMeta;
}

export interface InsertAuditEventInput {
  orgId: string;
  actorUserId?: string | null;
  actorRole?: OrgRole | null;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  correlationId?: string | null;
  reason?: string | null;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditExportFilter {
  startDateFrom?: string;
  startDateTo?: string;
  actionType?: string;
  entityType?: string;
  actorUserId?: string;
  limit?: number;
}
