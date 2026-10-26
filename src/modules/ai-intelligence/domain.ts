export interface AiScheduleConflict {
  id: string;
  type:
    | "overlap"
    | "tight_schedule"
    | "excessive_workload"
    | "missing_coordinates"
    | "missing_time";
  description: string;
  severity: "low" | "medium" | "high";
  sourceRecordIds: string[];
}

export interface AiWorkloadSummary {
  stopsCount: number;
  dailyStopThreshold: number;
  estimatedDurationMinutes: number;
  workloadStatus: "balanced" | "heavy" | "excessive";
  note: string;
}

export interface AiProposedStopSequenceItem {
  stopId: string;
  storeId: string;
  storeName: string;
  sequenceNumber: number;
  city: string;
  hasCoordinates: boolean;
}

export interface AiSequenceSuggestion {
  originalSequence: readonly AiProposedStopSequenceItem[];
  proposedSequence: readonly AiProposedStopSequenceItem[];
  distanceSavingsMeters: number;
  durationSavingsMinutes: number;
  isReordered: boolean;
  confidenceExplanation: string;
}

export interface AiMissingTripDetail {
  field: string;
  description: string;
  stopId?: string;
  storeId?: string;
}

export interface AiTripRecommendationItem {
  id: string;
  category: "sequence" | "schedule" | "workload" | "store_compliance";
  title: string;
  rationale: string;
  suggestedAction: string;
  sourceRecordIds: string[];
}

export interface AiTripPlanSummary {
  tripId: string;
  title: string;
  tripStatus: string;
  assignedRepUserId: string;
  totalStops: number;
  conflicts: readonly AiScheduleConflict[];
  workloadSummary: AiWorkloadSummary;
  suggestedSequence: AiSequenceSuggestion;
  missingDetails: readonly AiMissingTripDetail[];
  recommendations: readonly AiTripRecommendationItem[];
  evidenceExplanation: string;
  generatedAt: string;
  modelUsed: string;
  requiresHumanReview: boolean;
  aiDisclaimer: string;
}

export interface BriefingMetrics {
  tripsScheduledToday: number;
  visitsScheduledToday: number;
  completedVisitsCount: number;
  overdueVisitsCount: number;
  pendingApprovalsCount: number;
  missingEvidenceCount: number;
  unfinishedChecklistsCount: number;
}

export interface BriefingWorkloadImbalance {
  repUserId: string;
  repName: string;
  assignedTripsCount: number;
  plannedStopsCount: number;
  completedVisitsCount: number;
  outstandingAssignments: number;
  status: "underutilized" | "balanced" | "overloaded";
  note: string;
}

export interface BriefingCriticalException {
  id: string;
  type: "overdue_visit" | "unapproved_trip" | "missing_evidence" | "missed_store";
  title: string;
  detail: string;
  sourceRecordId: string;
  severity: "low" | "medium" | "high";
}

export interface BriefingRecommendedAction {
  id: string;
  title: string;
  actionType: "reassign_visit" | "review_trip" | "follow_up_evidence" | "remind_rep";
  targetEntityId: string;
  targetEntityType: "trip" | "visit" | "user" | "store";
  rationale: string;
  sourceRecordIds: string[];
  status: "pending" | "accepted" | "dismissed";
}

export interface ManagerDailyBriefing {
  orgId: string;
  briefingDate: string;
  retrievedAt: string;
  summaryHeadline: string;
  executiveSummary: string;
  metrics: BriefingMetrics;
  workloadImbalances: readonly BriefingWorkloadImbalance[];
  criticalExceptions: readonly BriefingCriticalException[];
  recommendedActions: readonly BriefingRecommendedAction[];
  dataCompleteness: {
    hasSufficientData: boolean;
    explanation: string;
  };
  modelUsed: string;
  requiresHumanReview: boolean;
  aiDisclaimer: string;
}
