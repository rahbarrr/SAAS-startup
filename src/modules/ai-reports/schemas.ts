import { z } from "zod";
import {
  AI_DRAFT_REVIEW_STATUSES,
  AI_FOLLOW_UP_PRIORITIES,
  AI_ISSUE_SEVERITIES,
} from "./domain";

export const generateVisitAiReportDraftInputSchema = z.object({
  includeVisitNotes: z.boolean().default(true),
  selectedChecklistItemIds: z
    .array(z.string().uuid("Checklist item ID must be a valid UUID"))
    .max(50, "Cannot select more than 50 checklist items")
    .optional(),
  selectedEvidenceIds: z
    .array(z.string().uuid("Evidence ID must be a valid UUID"))
    .max(25, "Cannot select more than 25 evidence metadata items")
    .default([]),
});

export type GenerateVisitAiReportDraftInput = z.infer<
  typeof generateVisitAiReportDraftInputSchema
>;

export const aiCompletedActionItemSchema = z.object({
  action: z
    .string()
    .trim()
    .min(3, "Completed action description must be at least 3 characters")
    .max(500, "Completed action description cannot exceed 500 characters"),
  sourceRecordIds: z
    .array(z.string().uuid("Source record ID must be a valid UUID"))
    .min(1, "Each completed action must reference at least one source record ID")
    .max(20),
});

export const aiIssueItemSchema = z.object({
  issue: z
    .string()
    .trim()
    .min(3, "Issue description must be at least 3 characters")
    .max(500, "Issue description cannot exceed 500 characters"),
  severity: z.enum(AI_ISSUE_SEVERITIES),
  sourceRecordIds: z
    .array(z.string().uuid("Source record ID must be a valid UUID"))
    .min(1, "Each issue must reference at least one source record ID")
    .max(20),
});

export const aiFollowUpItemSchema = z.object({
  recommendation: z
    .string()
    .trim()
    .min(3, "Follow-up recommendation must be at least 3 characters")
    .max(500, "Follow-up recommendation cannot exceed 500 characters"),
  priority: z.enum(AI_FOLLOW_UP_PRIORITIES),
  sourceRecordIds: z
    .array(z.string().uuid("Source record ID must be a valid UUID"))
    .min(1, "Each follow-up must reference at least one source record ID")
    .max(20),
});

export const aiSourceRecordRefsSchema = z.object({
  visitId: z.string().uuid(),
  checklistItemIds: z.array(z.string().uuid()).max(50),
  evidenceIds: z.array(z.string().uuid()).max(25),
});

export const aiGeneratedReportDraftPayloadSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(10, "Summary must be at least 10 characters")
    .max(2000, "Summary cannot exceed 2000 characters"),
  completedActions: z.array(aiCompletedActionItemSchema).max(25),
  issues: z.array(aiIssueItemSchema).max(25),
  followUps: z.array(aiFollowUpItemSchema).max(25),
  uncertaintyNotes: z.array(z.string().trim().min(3).max(500)).max(15).default([]),
  sourceRecordIds: aiSourceRecordRefsSchema,
});

export type AiGeneratedReportDraftPayload = z.infer<
  typeof aiGeneratedReportDraftPayloadSchema
>;

export const reviewVisitAiReportDraftInputSchema = z.object({
  draftId: z.string().uuid("Draft ID must be a valid UUID"),
  reviewStatus: z.enum(AI_DRAFT_REVIEW_STATUSES),
  summary: z
    .string()
    .trim()
    .min(10, "Summary must be at least 10 characters")
    .max(2000, "Summary cannot exceed 2000 characters"),
  completedActions: z.array(aiCompletedActionItemSchema).max(25),
  issues: z.array(aiIssueItemSchema).max(25),
  followUps: z.array(aiFollowUpItemSchema).max(25),
  uncertaintyNotes: z.array(z.string().trim().min(3).max(500)).max(15).default([]),
  reviewNote: z
    .string()
    .trim()
    .max(1000, "Review note cannot exceed 1000 characters")
    .nullable()
    .optional(),
});

export type ReviewVisitAiReportDraftInput = z.infer<
  typeof reviewVisitAiReportDraftInputSchema
>;

/**
 * Strict JSON Schema used with OpenAI's `/v1/responses` Structured Outputs (`text.format`).
 */
export const OPENAI_VISIT_REPORT_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "completedActions",
    "issues",
    "followUps",
    "uncertaintyNotes",
    "sourceRecordIds",
  ],
  properties: {
    summary: {
      type: "string",
      description:
        "Concise factual summary of the store visit grounded strictly in the provided source records.",
    },
    completedActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "sourceRecordIds"],
        properties: {
          action: { type: "string" },
          sourceRecordIds: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "severity", "sourceRecordIds"],
        properties: {
          issue: { type: "string" },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          sourceRecordIds: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    followUps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["recommendation", "priority", "sourceRecordIds"],
        properties: {
          recommendation: { type: "string" },
          priority: {
            type: "string",
            enum: ["routine", "important", "urgent"],
          },
          sourceRecordIds: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    uncertaintyNotes: {
      type: "array",
      items: { type: "string" },
    },
    sourceRecordIds: {
      type: "object",
      additionalProperties: false,
      required: ["visitId", "checklistItemIds", "evidenceIds"],
      properties: {
        visitId: { type: "string" },
        checklistItemIds: {
          type: "array",
          items: { type: "string" },
        },
        evidenceIds: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;
