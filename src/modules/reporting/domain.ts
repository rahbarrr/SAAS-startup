import type { Store } from "@/modules/stores/domain";
import type {
  Trip,
  TripAuditEvent,
  TripStatus,
  TripStop,
  TripStopStatus,
} from "@/modules/trips/domain";
import type {
  UnverifiedDeviceLocation,
  Visit,
  VisitChecklistItem,
  VisitEvidence,
  VisitStatus,
} from "@/modules/visits/domain";

export interface MetricDefinition {
  key:
    | "tripsAwaitingApproval"
    | "approvedTrips"
    | "completedVisits"
    | "pendingVisits"
    | "exceptionsRequiringAttention";
  label: string;
  formulaSummary: string;
  completionRuleNote: string;
}

/**
 * Authoritative, documented definitions for every metric displayed on the Manager Dashboard.
 */
export const DASHBOARD_METRIC_DEFINITIONS: Readonly<
  Record<MetricDefinition["key"], MetricDefinition>
> = {
  tripsAwaitingApproval: {
    key: "tripsAwaitingApproval",
    label: "Trips Awaiting Approval",
    formulaSummary:
      "Count of trips in the active organization matching the active filters with status = 'submitted'.",
    completionRuleNote:
      "Submitted trips are locked from employee edits until a non-owner manager or admin records a decision.",
  },
  approvedTrips: {
    key: "approvedTrips",
    label: "Approved Trips",
    formulaSummary:
      "Count of trips in the active organization matching the active filters that have been approved for execution (status in ['approved', 'in_progress', 'completed']).",
    completionRuleNote:
      "Trip Completion Rule: An approved trip transitions to 'in_progress' on its first stop check-in and is marked 'completed' when 100% of its planned stops have a checked-out visit (visit status in ['submitted', 'reviewed']).",
  },
  completedVisits: {
    key: "completedVisits",
    label: "Completed Visits",
    formulaSummary:
      "Count of store visits on matching stops where the employee has checked in, completed all required checklist items, and checked out (visit status in ['submitted', 'reviewed']).",
    completionRuleNote:
      "A visit is only counted as completed after server-verified check-out.",
  },
  pendingVisits: {
    key: "pendingVisits",
    label: "Pending Visits",
    formulaSummary:
      "Count of planned stops belonging to 'approved' or 'in_progress' trips matching the active filters that have not yet been checked out (no visit started yet, or visit status = 'in_progress').",
    completionRuleNote:
      "Includes both not-yet-started stops on approved trips and currently active in-progress visits.",
  },
  exceptionsRequiringAttention: {
    key: "exceptionsRequiringAttention",
    label: "Exceptions / Requiring Attention",
    formulaSummary:
      "Count of matching trips or visits with at least one operational exception: (1) trip status in ['changes_requested', 'rejected'], (2) overdue 'approved'/'in_progress' trip with unvisited stops past end_date (UTC), (3) visit with any flagged checklist item (flagged = true), or (4) visit where check-in/out device location permission was denied or unavailable.",
    completionRuleNote:
      "Surfaces anomalies for manager review without treating unverified device coordinates as proof of identity.",
  },
};

export interface DashboardMetricsSummary {
  tripsAwaitingApproval: number;
  approvedTrips: number;
  approvedTripsBreakdown: {
    approvedNotStarted: number;
    inProgress: number;
    completedAllStopsCheckedOut: number;
  };
  completedVisits: number;
  pendingVisits: number;
  exceptionsRequiringAttention: number;
  definitions: typeof DASHBOARD_METRIC_DEFINITIONS;
  timezoneBoundaryNote: string;
  referenceDateUtc: string;
}

export interface PlannedVsActualStopRow {
  tripId: string;
  tripTitle: string;
  tripStatus: TripStatus;
  tripStartDate: string;
  tripEndDate: string;
  ownerUserId: string;
  tripStopId: string;
  sequenceNumber: number;
  storeId: string;
  storeName: string;
  storeRegion: string;
  plannedAt: string | null;
  plannedStopStatus: TripStopStatus;
  actualVisitId: string | null;
  actualVisitStatus: VisitStatus | "not_started";
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkInLocation: UnverifiedDeviceLocation | null;
  checkOutLocation: UnverifiedDeviceLocation | null;
  requiredChecklistCompletedCount: number;
  requiredChecklistTotalCount: number;
  flaggedChecklistCount: number;
  evidenceCount: number;
  visitNotes: string;
  requiresAttention: boolean;
  attentionReasons: string[];
}

export interface TripPlannedVsActualDetail {
  trip: Trip;
  isCompleteAllStopsCheckedOut: boolean;
  completedStopCount: number;
  totalStopCount: number;
  stops: PlannedVsActualStopRow[];
  auditEvents: TripAuditEvent[];
  locationDisclosure: string;
}

export interface VisitPlannedVsActualDetail {
  visit: Visit;
  trip: Trip;
  stop: TripStop;
  store: Store | null;
  checklistItems: VisitChecklistItem[];
  evidence: VisitEvidence[];
  requiredChecklistCompletedCount: number;
  requiredChecklistTotalCount: number;
  flaggedChecklistCount: number;
  requiresAttention: boolean;
  attentionReasons: string[];
  locationDisclosure: string;
}
