import "server-only";
import { z } from "zod";
import { isAiReportsEnabled } from "@/lib/env/startup";
import { AppError } from "@/lib/http/envelope";
import { hasOrgPermission, resolveTenantContext } from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { VisitsRepository } from "@/modules/visits/repository";
import {
  AI_REPORT_PROMPT_TEMPLATE_VERSION,
  type AiFeatureAvailabilityStatus,
  containsProhibitedPolicyOutput,
  detectPromptInjectionIndicators,
  MAX_SERIALIZED_SOURCE_CHARS,
  MAX_UNTRUSTED_ITEM_TEXT_LENGTH,
  MAX_UNTRUSTED_NOTES_LENGTH,
  sanitizeUntrustedFieldText,
  type VisitAiReportDraft,
} from "./domain";
import type { AuditRepository } from "@/modules/audit/repository";
import type { AiReportDraftProvider } from "./openai-provider";
import type { AiReportsRepository } from "./repository";
import {
  aiGeneratedReportDraftPayloadSchema,
  generateVisitAiReportDraftInputSchema,
  reviewVisitAiReportDraftInputSchema,
} from "./schemas";

const visitIdParamSchema = z.string().uuid("Visit ID must be a valid UUID");

function getStartOfUtcDayIso(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export interface VisitAiReportDraftsOverview {
  availability: AiFeatureAvailabilityStatus;
  drafts: VisitAiReportDraft[];
}

export async function getVisitAiReportDraftsStateForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  aiReportsRepository: AiReportsRepository;
  aiProvider: AiReportDraftProvider;
  now?: Date;
}): Promise<VisitAiReportDraftsOverview> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  const visitId = visitIdParamSchema.parse(params.candidateVisitId);
  const visitDetail = await params.visitsRepository.getVisitDetail(
    context.orgId,
    visitId
  );

  if (!visitDetail) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to access this visit",
      403
    );
  }

  const canReviewAll = hasOrgPermission(context.role, "visits:review");
  const isOwner = visitDetail.visit.employeeUserId === context.user.id;
  if (!canReviewAll && !isOwner) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to access this visit",
      403
    );
  }

  const aiReportsSystemEnabled = isAiReportsEnabled();
  const runtimeConfig = params.aiProvider.getRuntimeConfig();
  const orgSettings = await params.aiReportsRepository.getOrganizationAiSettings(
    context.orgId
  );
  const enabledForOrg = orgSettings?.aiReportDraftsEnabled ?? false;
  const dailyOrgQuota = orgSettings?.aiDailyDraftQuota ?? 0;

  const startOfUtcDay = getStartOfUtcDayIso(params.now ?? new Date());
  const dailyOrgUsed = await params.aiReportsRepository.countOrgDraftsCreatedSince(
    context.orgId,
    startOfUtcDay
  );
  const dailyOrgRemaining = Math.max(0, dailyOrgQuota - dailyOrgUsed);

  let disabledReason: string | null = null;
  if (!aiReportsSystemEnabled) {
    disabledReason =
      "AI report drafting is temporarily disabled by the system administrator (AI_REPORTS_ENABLED=false).";
  } else if (!runtimeConfig.configured) {
    disabledReason =
      "AI report drafting is not configured on this server (OPENAI_API_KEY and OPENAI_REPORT_MODEL must be set in server environment variables).";
  } else if (!enabledForOrg) {
    disabledReason = "AI report drafting is disabled for this organization.";
  } else if (dailyOrgRemaining <= 0) {
    disabledReason = `Daily organization quota reached (${dailyOrgUsed}/${dailyOrgQuota} drafts used today in UTC).`;
  }

  const drafts = await params.aiReportsRepository.listVisitAiReportDrafts(
    context.orgId,
    visitId
  );

  return {
    availability: {
      enabled:
        aiReportsSystemEnabled &&
        runtimeConfig.configured &&
        enabledForOrg &&
        dailyOrgRemaining > 0,
      configuredOnServer: runtimeConfig.configured,
      enabledForOrg,
      configuredModel: runtimeConfig.model,
      dailyOrgQuota,
      dailyOrgUsed,
      dailyOrgRemaining,
      disabledReason,
    },
    drafts,
  };
}

export async function generateVisitAiReportDraftForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  aiReportsRepository: AiReportsRepository;
  aiProvider: AiReportDraftProvider;
  auditRepository?: AuditRepository;
  now?: Date;
}): Promise<VisitAiReportDraft> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  const visitId = visitIdParamSchema.parse(params.candidateVisitId);
  const input = generateVisitAiReportDraftInputSchema.parse(params.rawInput ?? {});

  const visitDetail = await params.visitsRepository.getVisitDetail(
    context.orgId,
    visitId
  );
  if (!visitDetail) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to access this visit",
      403
    );
  }

  const canReviewAll = hasOrgPermission(context.role, "visits:review");
  const isOwner = visitDetail.visit.employeeUserId === context.user.id;
  if (!canReviewAll && !isOwner) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to generate a report draft for this visit",
      403
    );
  }

  // 1. Check master system kill switch & visit eligibility
  if (!isAiReportsEnabled()) {
    throw new AppError(
      "AI_FEATURE_DISABLED_FOR_ORG",
      "AI report drafting is temporarily disabled by the system administrator.",
      503
    );
  }

  if (!visitDetail.visit.checkedInAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Only checked-in or completed visits are eligible for an AI report draft.",
      400
    );
  }

  // 2. Check server-only OpenAI configuration
  const runtimeConfig = params.aiProvider.getRuntimeConfig();
  if (!runtimeConfig.configured || !runtimeConfig.model) {
    throw new AppError(
      "AI_FEATURE_NOT_CONFIGURED",
      "AI report drafting is not configured on this server.",
      503
    );
  }

  // 2. Check organization-level feature flag & daily quota
  const orgSettings = await params.aiReportsRepository.getOrganizationAiSettings(
    context.orgId
  );
  if (!orgSettings || !orgSettings.aiReportDraftsEnabled) {
    throw new AppError(
      "AI_FEATURE_DISABLED_FOR_ORG",
      "AI report drafting is disabled for this organization.",
      403
    );
  }

  const startOfUtcDay = getStartOfUtcDayIso(params.now ?? new Date());
  const dailyOrgUsed = await params.aiReportsRepository.countOrgDraftsCreatedSince(
    context.orgId,
    startOfUtcDay
  );
  if (dailyOrgUsed >= orgSettings.aiDailyDraftQuota) {
    throw new AppError(
      "AI_QUOTA_EXCEEDED",
      `Organization daily AI report draft quota (${orgSettings.aiDailyDraftQuota}) has been reached.`,
      429
    );
  }

  // 3. Enforce strict authorization & completion checks on selected source records
  const completedChecklistById = new Map(
    visitDetail.checklistItems
      .filter((item) => item.completedAt !== null && item.orgId === context.orgId)
      .map((item) => [item.id, item])
  );

  const selectedChecklistItems =
    input.selectedChecklistItemIds !== undefined
      ? input.selectedChecklistItemIds.map((itemId) => {
          const matched = completedChecklistById.get(itemId);
          if (!matched) {
            throw new AppError(
              "UNAUTHORIZED_SOURCE_RECORD",
              "One or more selected checklist items are not authorized completed items for this visit.",
              403
            );
          }
          return matched;
        })
      : Array.from(completedChecklistById.values());

  const uploadedEvidenceById = new Map(
    visitDetail.evidence
      .filter((ev) => ev.orgId === context.orgId)
      .map((ev) => [ev.id, ev])
  );

  const selectedEvidenceItems = input.selectedEvidenceIds.map((evidenceId) => {
    const matched = uploadedEvidenceById.get(evidenceId);
    if (!matched) {
      throw new AppError(
        "UNAUTHORIZED_SOURCE_RECORD",
        "One or more selected evidence items do not belong to this authorized visit.",
        403
      );
    }
    return matched;
  });

  const sanitizedNotes =
    input.includeVisitNotes && visitDetail.visit.notes.trim().length > 0
      ? sanitizeUntrustedFieldText(visitDetail.visit.notes, MAX_UNTRUSTED_NOTES_LENGTH)
      : null;

  if (
    !sanitizedNotes &&
    selectedChecklistItems.length === 0 &&
    selectedEvidenceItems.length === 0
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "At least one authorized source (visit notes, completed checklist items, or selected evidence captions) is required to generate a draft.",
      400
    );
  }

  // 4. Prepare sanitized, minimal untrusted payload (NO binary images, NO storage paths, NO personal identifiers)
  const untrustedChecklistPayload = selectedChecklistItems.map((item) => ({
    id: item.id,
    label: sanitizeUntrustedFieldText(item.label, MAX_UNTRUSTED_ITEM_TEXT_LENGTH),
    answerType: item.answerType,
    answerValue: item.answerValue,
    answerText: item.answerText
      ? sanitizeUntrustedFieldText(item.answerText, MAX_UNTRUSTED_ITEM_TEXT_LENGTH)
      : null,
    flagged: item.flagged,
  }));

  const untrustedEvidenceMetadataPayload = selectedEvidenceItems.map((ev) => ({
    id: ev.id,
    caption: sanitizeUntrustedFieldText(ev.caption, MAX_UNTRUSTED_ITEM_TEXT_LENGTH),
    mimeType: ev.fileType,
  }));

  const serializedChars = JSON.stringify({
    visitNotes: sanitizedNotes,
    completedChecklistItems: untrustedChecklistPayload,
    selectedEvidenceMetadata: untrustedEvidenceMetadataPayload,
  }).length;

  if (serializedChars > MAX_SERIALIZED_SOURCE_CHARS) {
    throw new AppError(
      "AI_COST_LIMIT_EXCEEDED",
      "Selected visit records exceed the maximum allowed input size for a single AI report draft.",
      400
    );
  }

  const allUntrustedStrings: string[] = [
    ...(sanitizedNotes ? [sanitizedNotes] : []),
    ...untrustedChecklistPayload.flatMap((c) =>
      c.answerText ? [c.label, c.answerText] : [c.label]
    ),
    ...untrustedEvidenceMetadataPayload.map((e) => e.caption),
  ];

  const hasPromptInjectionIndicator =
    detectPromptInjectionIndicators(allUntrustedStrings);

  // 5. Invoke server-side OpenAI provider
  const providerResponse = await params.aiProvider.generateStructuredVisitDraft({
    visitId,
    visitStatus: visitDetail.visit.status,
    visitNotes: sanitizedNotes,
    completedChecklistItems: untrustedChecklistPayload,
    selectedEvidenceMetadata: untrustedEvidenceMetadataPayload,
  });

  // 6. Parse and validate structured output against schema
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(providerResponse.rawJsonText);
  } catch {
    throw new AppError(
      "AI_MALFORMED_OUTPUT",
      "AI provider returned malformed JSON output.",
      502
    );
  }

  const parsedResult = aiGeneratedReportDraftPayloadSchema.safeParse(parsedJson);
  if (!parsedResult.success) {
    throw new AppError(
      "AI_MALFORMED_OUTPUT",
      "AI provider output did not match the required report draft schema.",
      502
    );
  }

  const structuredDraft = parsedResult.data;

  // 7. Verify all cited sourceRecordIds belong strictly to the allowlisted records sent in this request
  const allowlistedChecklistIdSet = new Set(selectedChecklistItems.map((i) => i.id));
  const allowlistedEvidenceIdSet = new Set(selectedEvidenceItems.map((e) => e.id));
  const allowlistedAnySourceIdSet = new Set<string>([
    visitId,
    ...allowlistedChecklistIdSet,
    ...allowlistedEvidenceIdSet,
  ]);

  if (structuredDraft.sourceRecordIds.visitId !== visitId) {
    throw new AppError(
      "AI_MALFORMED_OUTPUT",
      "AI output referenced an unauthorized or mismatched visitId.",
      502
    );
  }

  for (const checklistId of structuredDraft.sourceRecordIds.checklistItemIds) {
    if (!allowlistedChecklistIdSet.has(checklistId)) {
      throw new AppError(
        "AI_MALFORMED_OUTPUT",
        "AI output referenced a checklist item ID that was not in the authorized selection.",
        502
      );
    }
  }

  for (const evidenceId of structuredDraft.sourceRecordIds.evidenceIds) {
    if (!allowlistedEvidenceIdSet.has(evidenceId)) {
      throw new AppError(
        "AI_MALFORMED_OUTPUT",
        "AI output referenced an evidence ID that was not in the authorized selection.",
        502
      );
    }
  }

  const citedItemSourceIds = [
    ...structuredDraft.completedActions.flatMap((a) => a.sourceRecordIds),
    ...structuredDraft.issues.flatMap((i) => i.sourceRecordIds),
    ...structuredDraft.followUps.flatMap((f) => f.sourceRecordIds),
  ];

  for (const citedId of citedItemSourceIds) {
    if (!allowlistedAnySourceIdSet.has(citedId)) {
      throw new AppError(
        "AI_MALFORMED_OUTPUT",
        "AI output cited an unauthorized or hallucinated source record ID.",
        502
      );
    }
  }

  // 8. Verify policy guardrails (no secrets, no auto-approval, no employee scoring/discipline/intent inference)
  const outputTextFragments = [
    structuredDraft.summary,
    ...structuredDraft.completedActions.map((a) => a.action),
    ...structuredDraft.issues.map((i) => i.issue),
    ...structuredDraft.followUps.map((f) => f.recommendation),
    ...structuredDraft.uncertaintyNotes,
  ];

  if (containsProhibitedPolicyOutput(outputTextFragments)) {
    throw new AppError(
      "AI_POLICY_VIOLATION",
      "AI output violated FieldTrack safety policy (prohibited decision, employee scoring, or restricted token).",
      502
    );
  }

  const finalUncertaintyNotes = [...structuredDraft.uncertaintyNotes];
  if (hasPromptInjectionIndicator) {
    finalUncertaintyNotes.push(
      "Source text contained instruction-like phrasing that was treated strictly as untrusted data and ignored as instructions; please verify raw notes manually."
    );
  }

  // 9. Persist draft with `pending_review` human review status
  const draft = await params.aiReportsRepository.insertVisitAiReportDraft({
    orgId: context.orgId,
    visitId,
    modelName: providerResponse.modelName,
    modelVersion: providerResponse.modelVersion,
    promptTemplateVersion: AI_REPORT_PROMPT_TEMPLATE_VERSION,
    summary: structuredDraft.summary,
    completedActions: structuredDraft.completedActions,
    issues: structuredDraft.issues,
    followUps: structuredDraft.followUps,
    uncertaintyNotes: finalUncertaintyNotes.slice(0, 15),
    sourceRecordIds: {
      visitId,
      checklistItemIds: Array.from(allowlistedChecklistIdSet),
      evidenceIds: Array.from(allowlistedEvidenceIdSet),
    },
    inputTokens: providerResponse.inputTokens,
    outputTokens: providerResponse.outputTokens,
    createdBy: context.user.id,
  });

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "ai.visit_report_drafted",
      entityType: "ai_visit_report",
      entityId: draft.id,
      reason: "User generated AI-assisted visit report draft",
      metadata: {
        visitId,
        modelName: providerResponse.modelName,
        completedActionsCount: structuredDraft.completedActions.length,
        issuesCount: structuredDraft.issues.length,
        followUpsCount: structuredDraft.followUps.length,
      },
    });
  }

  return draft;
}

export async function reviewVisitAiReportDraftForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  aiReportsRepository: AiReportsRepository;
  auditRepository?: AuditRepository;
  now?: Date;
}): Promise<VisitAiReportDraft> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  const visitId = visitIdParamSchema.parse(params.candidateVisitId);
  const input = reviewVisitAiReportDraftInputSchema.parse(params.rawInput ?? {});

  const visitDetail = await params.visitsRepository.getVisitDetail(
    context.orgId,
    visitId
  );
  if (!visitDetail) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to access this visit",
      403
    );
  }

  const canReviewAll = hasOrgPermission(context.role, "visits:review");
  const isOwner = visitDetail.visit.employeeUserId === context.user.id;
  if (!canReviewAll && !isOwner) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to review or edit this AI report draft",
      403
    );
  }

  const existingDraft = await params.aiReportsRepository.getVisitAiReportDraftById(
    context.orgId,
    visitId,
    input.draftId
  );
  if (!existingDraft) {
    throw new AppError("NOT_FOUND", "AI report draft not found for this visit", 404);
  }

  const allowedSourceIds = new Set<string>([
    existingDraft.sourceRecordIds.visitId,
    ...existingDraft.sourceRecordIds.checklistItemIds,
    ...existingDraft.sourceRecordIds.evidenceIds,
  ]);

  const citedIds = [
    ...input.completedActions.flatMap((a) => a.sourceRecordIds),
    ...input.issues.flatMap((i) => i.sourceRecordIds),
    ...input.followUps.flatMap((f) => f.sourceRecordIds),
  ];

  for (const citedId of citedIds) {
    if (!allowedSourceIds.has(citedId)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Edited report items may only reference source record IDs associated with this draft.",
        400
      );
    }
  }

  const outputTextFragments = [
    input.summary,
    ...input.completedActions.map((a) => a.action),
    ...input.issues.map((i) => i.issue),
    ...input.followUps.map((f) => f.recommendation),
    ...input.uncertaintyNotes,
  ];
  if (containsProhibitedPolicyOutput(outputTextFragments)) {
    throw new AppError(
      "AI_POLICY_VIOLATION",
      "Edited report content contains prohibited policy statements.",
      400
    );
  }

  const nowIso = (params.now ?? new Date()).toISOString();
  const isDecision =
    input.reviewStatus === "approved" || input.reviewStatus === "rejected";

  const updatedDraft = await params.aiReportsRepository.updateVisitAiReportDraftReview({
    orgId: context.orgId,
    visitId,
    draftId: input.draftId,
    reviewStatus: input.reviewStatus,
    summary: input.summary,
    completedActions: input.completedActions,
    issues: input.issues,
    followUps: input.followUps,
    uncertaintyNotes: input.uncertaintyNotes,
    reviewedBy: isDecision ? context.user.id : existingDraft.reviewedBy,
    reviewedAt: isDecision ? nowIso : existingDraft.reviewedAt,
    reviewNote: input.reviewNote ?? null,
  });

  if (params.auditRepository) {
    const actionType =
      input.reviewStatus === "approved"
        ? "ai.visit_report_approved"
        : input.reviewStatus === "rejected"
          ? "ai.visit_report_rejected"
          : "trip.updated";

    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType,
      entityType: "ai_visit_report",
      entityId: updatedDraft.id,
      reason: input.reviewNote ?? `Visit report draft marked as ${input.reviewStatus}`,
      changes: {
        reviewStatus: { before: existingDraft.reviewStatus, after: input.reviewStatus },
      },
      metadata: {
        visitId,
      },
    });
  }

  return updatedDraft;
}
