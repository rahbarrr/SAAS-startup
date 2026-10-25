import { z } from "zod";

export const applyTripPlanRecommendationSchema = z.object({
  proposedStopOrder: z.array(
    z.object({
      storeId: z.string().min(1, "storeId is required"),
      plannedAt: z.string().nullable().optional(),
    })
  ).min(1, "At least one stop order item is required"),
  confirmApprovedTripModification: z.boolean().default(false),
});

export type ApplyTripPlanRecommendationInput = z.infer<
  typeof applyTripPlanRecommendationSchema
>;

export const updateBriefingActionSchema = z.object({
  actionId: z.string().min(1, "actionId is required"),
  status: z.enum(["accepted", "dismissed"]),
  note: z.string().max(500).optional(),
});

export type UpdateBriefingActionInput = z.infer<
  typeof updateBriefingActionSchema
>;

export const aiTripPlanOutputSchema = z.object({
  conflicts: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "overlap",
        "tight_schedule",
        "excessive_workload",
        "missing_coordinates",
        "missing_time",
      ]),
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      sourceRecordIds: z.array(z.string()),
    })
  ),
  workloadStatus: z.enum(["balanced", "heavy", "excessive"]),
  workloadNote: z.string(),
  missingDetails: z.array(
    z.object({
      field: z.string(),
      description: z.string(),
      stopId: z.string().optional(),
      storeId: z.string().optional(),
    })
  ),
  recommendations: z.array(
    z.object({
      id: z.string(),
      category: z.enum(["sequence", "schedule", "workload", "store_compliance"]),
      title: z.string(),
      rationale: z.string(),
      suggestedAction: z.string(),
      sourceRecordIds: z.array(z.string()),
    })
  ),
  evidenceExplanation: z.string(),
});

export type AiTripPlanOutput = z.infer<typeof aiTripPlanOutputSchema>;

export const aiManagerBriefingOutputSchema = z.object({
  summaryHeadline: z.string(),
  executiveSummary: z.string(),
  criticalExceptions: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "overdue_visit" ,
        "unapproved_trip",
        "missing_evidence",
        "missed_store",
      ]),
      title: z.string(),
      detail: z.string(),
      sourceRecordId: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    })
  ),
  recommendedActions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      actionType: z.enum([
        "reassign_visit",
        "review_trip",
        "follow_up_evidence",
        "remind_rep",
      ]),
      targetEntityId: z.string(),
      targetEntityType: z.enum(["trip", "visit", "user", "store"]),
      rationale: z.string(),
      sourceRecordIds: z.array(z.string()),
      status: z.enum(["pending", "accepted", "dismissed"]).default("pending"),
    })
  ),
  dataCompletenessExplanation: z.string(),
});

export type AiManagerBriefingOutput = z.infer<
  typeof aiManagerBriefingOutputSchema
>;
