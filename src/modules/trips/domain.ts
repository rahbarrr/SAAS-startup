export const TRIP_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
  "in_progress",
  "completed",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_DECISION_STATUSES = [
  "approved",
  "changes_requested",
  "rejected",
] as const;

export type TripDecisionStatus = (typeof TRIP_DECISION_STATUSES)[number];

export const TRIP_STOP_STATUSES = ["planned", "visited", "skipped"] as const;
export type TripStopStatus = (typeof TRIP_STOP_STATUSES)[number];

export const TRIP_AUDIT_EVENT_TYPES = [
  "trip_created",
  "trip_updated",
  "trip_submitted",
  "trip_resubmitted",
  "trip_approved",
  "trip_changes_requested",
  "trip_rejected",
  "trip_reopened_for_edit",
  "trip_started",
  "trip_completed",
] as const;

export type TripAuditEventType = (typeof TRIP_AUDIT_EVENT_TYPES)[number];

export const TRIP_AUDIT_METADATA_ALLOWED_KEYS = [
  "source",
  "stop_count",
  "reason_code",
  "client_version",
  "previous_decided_by",
  "changed_fields",
] as const;

export type TripAuditMetadataKey = (typeof TRIP_AUDIT_METADATA_ALLOWED_KEYS)[number];

export type TripAuditMetadata = Partial<
  Record<TripAuditMetadataKey, string | number | boolean | null>
>;

export const APPROVAL_INBOX_STATUS_FILTERS = [
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
  "all",
] as const;

export type ApprovalInboxStatusFilter = (typeof APPROVAL_INBOX_STATUS_FILTERS)[number];

export interface Trip {
  id: string;
  orgId: string;
  ownerUserId: string;
  title: string;
  startDate: string;
  endDate: string;
  purpose: string;
  startLocation?: string | null;
  destinationCity?: string | null;
  status: TripStatus;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripStop {
  id: string;
  orgId: string;
  tripId: string;
  storeId: string;
  sequenceNumber: number;
  plannedAt: string | null;
  status: TripStopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TripAuditEvent {
  id: string;
  orgId: string;
  tripId: string;
  actorUserId: string;
  eventType: TripAuditEventType;
  oldStatus: TripStatus | null;
  newStatus: TripStatus;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TripDetail {
  trip: Trip;
  stops: TripStop[];
  auditEvents: TripAuditEvent[];
}

export interface EmployeeDecisionHistoryItem {
  auditEventId: string;
  eventType: Extract<
    TripAuditEventType,
    "trip_approved" | "trip_changes_requested" | "trip_rejected"
  >;
  decisionStatus: TripDecisionStatus;
  reviewerUserId: string;
  note: string | null;
  decidedAt: string;
}

export interface InAppDecisionNotification {
  channel: "in_app_only";
  tripId: string;
  currentStatus: TripStatus;
  headline: string;
  detail: string;
  requiresEmployeeAction: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
}

/**
 * Extracts structured manager decision history and current in-app notification state
 * from a TripDetail. Explicitly marks `channel: "in_app_only"` so the UI never claims
 * email or push delivery when no external notification provider is configured.
 */
export function buildEmployeeDecisionHistory(detail: TripDetail): {
  decisions: EmployeeDecisionHistoryItem[];
  notification: InAppDecisionNotification;
} {
  const decisions: EmployeeDecisionHistoryItem[] = detail.auditEvents
    .filter(
      (
        evt
      ): evt is TripAuditEvent & {
        eventType: "trip_approved" | "trip_changes_requested" | "trip_rejected";
      } =>
        evt.eventType === "trip_approved" ||
        evt.eventType === "trip_changes_requested" ||
        evt.eventType === "trip_rejected"
    )
    .map((evt) => ({
      auditEventId: evt.id,
      eventType: evt.eventType,
      decisionStatus:
        evt.eventType === "trip_approved"
          ? "approved"
          : evt.eventType === "trip_changes_requested"
            ? "changes_requested"
            : "rejected",
      reviewerUserId: evt.actorUserId,
      note: evt.note,
      decidedAt: evt.createdAt,
    }));

  const { trip } = detail;

  if (trip.status === "changes_requested") {
    return {
      decisions,
      notification: {
        channel: "in_app_only",
        tripId: trip.id,
        currentStatus: trip.status,
        headline: "Action required: Manager requested changes to this trip plan",
        detail:
          trip.decisionNote ??
          "Review the manager feedback below, update your trip plan, and resubmit.",
        requiresEmployeeAction: true,
        decidedBy: trip.decidedBy,
        decidedAt: trip.decidedAt,
      },
    };
  }

  if (trip.status === "approved") {
    return {
      decisions,
      notification: {
        channel: "in_app_only",
        tripId: trip.id,
        currentStatus: trip.status,
        headline: "Trip plan approved for field execution",
        detail:
          trip.decisionNote ??
          "Your manager approved this trip. Editing the plan now will reopen it as a draft and require re-approval.",
        requiresEmployeeAction: false,
        decidedBy: trip.decidedBy,
        decidedAt: trip.decidedAt,
      },
    };
  }

  if (trip.status === "rejected") {
    return {
      decisions,
      notification: {
        channel: "in_app_only",
        tripId: trip.id,
        currentStatus: trip.status,
        headline: "Trip plan rejected by manager",
        detail:
          trip.decisionNote ?? "This trip was rejected and is closed to further edits.",
        requiresEmployeeAction: false,
        decidedBy: trip.decidedBy,
        decidedAt: trip.decidedAt,
      },
    };
  }

  if (trip.status === "submitted") {
    return {
      decisions,
      notification: {
        channel: "in_app_only",
        tripId: trip.id,
        currentStatus: trip.status,
        headline: "Submitted — awaiting manager review",
        detail:
          "Your trip is in the organization manager approval inbox. Plan edits are locked while under review.",
        requiresEmployeeAction: false,
        decidedBy: null,
        decidedAt: null,
      },
    };
  }

  return {
    decisions,
    notification: {
      channel: "in_app_only",
      tripId: trip.id,
      currentStatus: trip.status,
      headline: "Draft trip plan",
      detail:
        "Add at least one active store stop and submit when ready for manager review.",
      requiresEmployeeAction: true,
      decidedBy: null,
      decidedAt: null,
    },
  };
}
