import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type { DbVisitAiReportDraftRow } from "@/types/database";
import {
  type AiCompletedActionItem,
  type AiDraftReviewStatus,
  type AiFollowUpItem,
  type AiIssueItem,
  type AiSourceRecordRefs,
  getAiGeneratedLabel,
  type VisitAiReportDraft,
} from "./domain";
import {
  aiCompletedActionItemSchema,
  aiFollowUpItemSchema,
  aiIssueItemSchema,
} from "./schemas";

export interface OrganizationAiQuotaSettings {
  aiReportDraftsEnabled: boolean;
  aiDailyDraftQuota: number;
}

export interface CreateVisitAiReportDraftRecord {
  orgId: string;
  visitId: string;
  modelName: string;
  modelVersion: string | null;
  promptTemplateVersion: string;
  summary: string;
  completedActions: readonly AiCompletedActionItem[];
  issues: readonly AiIssueItem[];
  followUps: readonly AiFollowUpItem[];
  uncertaintyNotes: readonly string[];
  sourceRecordIds: AiSourceRecordRefs;
  inputTokens: number | null;
  outputTokens: number | null;
  createdBy: string;
}

export interface UpdateVisitAiReportDraftReviewRecord {
  orgId: string;
  visitId: string;
  draftId: string;
  reviewStatus: AiDraftReviewStatus;
  summary: string;
  completedActions: readonly AiCompletedActionItem[];
  issues: readonly AiIssueItem[];
  followUps: readonly AiFollowUpItem[];
  uncertaintyNotes: readonly string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface AiReportsRepository {
  getOrganizationAiSettings(orgId: string): Promise<OrganizationAiQuotaSettings | null>;
  countOrgDraftsCreatedSince(orgId: string, sinceUtcIso: string): Promise<number>;
  listVisitAiReportDrafts(orgId: string, visitId: string): Promise<VisitAiReportDraft[]>;
  getVisitAiReportDraftById(
    orgId: string,
    visitId: string,
    draftId: string
  ): Promise<VisitAiReportDraft | null>;
  insertVisitAiReportDraft(
    record: CreateVisitAiReportDraftRecord
  ): Promise<VisitAiReportDraft>;
  updateVisitAiReportDraftReview(
    record: UpdateVisitAiReportDraftReviewRecord
  ): Promise<VisitAiReportDraft>;
}

function mapDraftRow(row: DbVisitAiReportDraftRow): VisitAiReportDraft {
  const completedActions = Array.isArray(row.completed_actions)
    ? row.completed_actions.map((item) => aiCompletedActionItemSchema.parse(item))
    : [];
  const issues = Array.isArray(row.issues)
    ? row.issues.map((item) => aiIssueItemSchema.parse(item))
    : [];
  const followUps = Array.isArray(row.follow_ups)
    ? row.follow_ups.map((item) => aiFollowUpItemSchema.parse(item))
    : [];
  const uncertaintyNotes = Array.isArray(row.uncertainty_notes)
    ? row.uncertainty_notes.filter((n): n is string => typeof n === "string")
    : [];

  return {
    id: row.id,
    orgId: row.organization_id,
    visitId: row.visit_id,
    modelName: row.model_name,
    modelVersion: row.model_version,
    promptTemplateVersion: row.prompt_template_version,
    reviewStatus: row.review_status,
    isFinalApproved: row.review_status === "approved",
    aiGeneratedLabel: getAiGeneratedLabel(row.review_status),
    summary: row.summary,
    completedActions,
    issues,
    followUps,
    uncertaintyNotes,
    sourceRecordIds: {
      visitId: row.source_record_ids.visit_id,
      checklistItemIds: row.source_record_ids.checklist_item_ids ?? [],
      evidenceIds: row.source_record_ids.evidence_ids ?? [],
    },
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseAiReportsRepository implements AiReportsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getOrganizationAiSettings(
    orgId: string
  ): Promise<OrganizationAiQuotaSettings | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("ai_report_drafts_enabled, ai_daily_draft_quota")
      .eq("id", orgId)
      .maybeSingle<{
        ai_report_drafts_enabled: boolean;
        ai_daily_draft_quota: number;
      }>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load organization AI settings",
        500
      );
    }

    if (!data) {
      return null;
    }

    return {
      aiReportDraftsEnabled: Boolean(data.ai_report_drafts_enabled),
      aiDailyDraftQuota: Number(data.ai_daily_draft_quota ?? 0),
    };
  }

  async countOrgDraftsCreatedSince(orgId: string, sinceUtcIso: string): Promise<number> {
    const { count, error } = await this.client
      .from("visit_ai_report_drafts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", sinceUtcIso);

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to check organization AI quota", 500);
    }

    return count ?? 0;
  }

  async listVisitAiReportDrafts(
    orgId: string,
    visitId: string
  ): Promise<VisitAiReportDraft[]> {
    const { data, error } = await this.client
      .from("visit_ai_report_drafts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false })
      .returns<DbVisitAiReportDraftRow[]>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list visit AI report drafts", 500);
    }

    return (data ?? []).map(mapDraftRow);
  }

  async getVisitAiReportDraftById(
    orgId: string,
    visitId: string,
    draftId: string
  ): Promise<VisitAiReportDraft | null> {
    const { data, error } = await this.client
      .from("visit_ai_report_drafts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("visit_id", visitId)
      .eq("id", draftId)
      .maybeSingle<DbVisitAiReportDraftRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to load visit AI report draft", 500);
    }

    return data ? mapDraftRow(data) : null;
  }

  async insertVisitAiReportDraft(
    record: CreateVisitAiReportDraftRecord
  ): Promise<VisitAiReportDraft> {
    const { data, error } = await this.client
      .from("visit_ai_report_drafts")
      .insert({
        organization_id: record.orgId,
        visit_id: record.visitId,
        model_name: record.modelName,
        model_version: record.modelVersion,
        prompt_template_version: record.promptTemplateVersion,
        review_status: "pending_review",
        summary: record.summary,
        completed_actions: record.completedActions,
        issues: record.issues,
        follow_ups: record.followUps,
        uncertainty_notes: record.uncertaintyNotes,
        source_record_ids: {
          visit_id: record.sourceRecordIds.visitId,
          checklist_item_ids: record.sourceRecordIds.checklistItemIds,
          evidence_ids: record.sourceRecordIds.evidenceIds,
        },
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        created_by: record.createdBy,
      })
      .select("*")
      .single<DbVisitAiReportDraftRow>();

    if (error || !data) {
      throw new AppError("INTERNAL_ERROR", "Failed to save AI visit report draft", 500);
    }

    return mapDraftRow(data);
  }

  async updateVisitAiReportDraftReview(
    record: UpdateVisitAiReportDraftReviewRecord
  ): Promise<VisitAiReportDraft> {
    const { data, error } = await this.client
      .from("visit_ai_report_drafts")
      .update({
        review_status: record.reviewStatus,
        summary: record.summary,
        completed_actions: record.completedActions,
        issues: record.issues,
        follow_ups: record.followUps,
        uncertainty_notes: record.uncertaintyNotes,
        reviewed_by: record.reviewedBy,
        reviewed_at: record.reviewedAt,
        review_note: record.reviewNote,
      })
      .eq("organization_id", record.orgId)
      .eq("visit_id", record.visitId)
      .eq("id", record.draftId)
      .select("*")
      .maybeSingle<DbVisitAiReportDraftRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to update AI report draft review",
        500
      );
    }

    if (!data) {
      throw new AppError("NOT_FOUND", "AI report draft not found", 404);
    }

    return mapDraftRow(data);
  }
}
