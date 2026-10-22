export const AI_REPORT_PROMPT_TEMPLATE_VERSION = "fieldtrack-visit-report-v1";
export const MAX_UNTRUSTED_NOTES_LENGTH = 2000;
export const MAX_UNTRUSTED_ITEM_TEXT_LENGTH = 500;
export const MAX_SERIALIZED_SOURCE_CHARS = 12000;

export const AI_DRAFT_REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
] as const;

export type AiDraftReviewStatus = (typeof AI_DRAFT_REVIEW_STATUSES)[number];

export const AI_ISSUE_SEVERITIES = ["low", "medium", "high"] as const;
export type AiIssueSeverity = (typeof AI_ISSUE_SEVERITIES)[number];

export const AI_FOLLOW_UP_PRIORITIES = ["routine", "important", "urgent"] as const;
export type AiFollowUpPriority = (typeof AI_FOLLOW_UP_PRIORITIES)[number];

export interface AiCompletedActionItem {
  action: string;
  sourceRecordIds: readonly string[];
}

export interface AiIssueItem {
  issue: string;
  severity: AiIssueSeverity;
  sourceRecordIds: readonly string[];
}

export interface AiFollowUpItem {
  recommendation: string;
  priority: AiFollowUpPriority;
  sourceRecordIds: readonly string[];
}

export interface AiSourceRecordRefs {
  visitId: string;
  checklistItemIds: readonly string[];
  evidenceIds: readonly string[];
}

export interface VisitAiReportDraft {
  id: string;
  orgId: string;
  visitId: string;
  modelName: string;
  modelVersion: string | null;
  promptTemplateVersion: string;
  reviewStatus: AiDraftReviewStatus;
  isFinalApproved: boolean;
  aiGeneratedLabel:
    | "AI-Generated Draft — Requires Human Review"
    | "Human-Reviewed & Approved Visit Report"
    | "AI-Generated Draft — Rejected by Reviewer";
  summary: string;
  completedActions: readonly AiCompletedActionItem[];
  issues: readonly AiIssueItem[];
  followUps: readonly AiFollowUpItem[];
  uncertaintyNotes: readonly string[];
  sourceRecordIds: AiSourceRecordRefs;
  inputTokens: number | null;
  outputTokens: number | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiFeatureAvailabilityStatus {
  enabled: boolean;
  configuredOnServer: boolean;
  enabledForOrg: boolean;
  configuredModel: string | null;
  dailyOrgQuota: number;
  dailyOrgUsed: number;
  dailyOrgRemaining: number;
  disabledReason: string | null;
}

export function getAiGeneratedLabel(
  reviewStatus: AiDraftReviewStatus
): VisitAiReportDraft["aiGeneratedLabel"] {
  if (reviewStatus === "approved") {
    return "Human-Reviewed & Approved Visit Report";
  }
  if (reviewStatus === "rejected") {
    return "AI-Generated Draft — Rejected by Reviewer";
  }
  return "AI-Generated Draft — Requires Human Review";
}

/**
 * Sanitizes untrusted user text (visit notes, checklist text, evidence captions)
 * before placing it inside the `<untrusted_visit_data>` data block.
 * Neutralizes XML/HTML delimiter tags and control characters so untrusted data
 * cannot break out of its data container.
 */
export function sanitizeUntrustedFieldText(raw: string, maxLength: number): string {
  let cleaned = "";
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      cleaned += " ";
    } else {
      cleaned += raw[i];
    }
  }

  return cleaned
    .replace(/<\s*\/?\s*untrusted_visit_data\s*>/gi, "[redacted-delimiter]")
    .replace(/<\s*\/?\s*system_instructions\s*>/gi, "[redacted-delimiter]")
    .trim()
    .slice(0, maxLength);
}

const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+|previous\s+|prior\s+|above\s+)?instructions/i,
  /disregard\s+(all\s+|previous\s+|prior\s+|system\s+)?instructions/i,
  /override\s+system\s+(prompt|instructions|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+key|secret|token|credentials)/i,
  /openai_api_key|supabase_service_role_key/i,
  /change\s+tool\s+permissions|grant\s+admin/i,
  /auto[-\s]?approve\s+(this\s+)?trip/i,
  /score\s+(the\s+)?employee|recommend\s+(termination|discipline|firing)/i,
];

/**
 * Detects whether untrusted input contains prompt-injection or policy-evasion patterns.
 * When detected, the service keeps the text strictly confined to untrusted data,
 * appends a mandatory uncertainty disclosure, and verifies the output did not comply.
 */
export function detectPromptInjectionIndicators(texts: readonly string[]): boolean {
  return texts.some((text) =>
    PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text))
  );
}

const PROHIBITED_OUTPUT_PATTERNS: readonly RegExp[] = [
  /openai_api_key|supabase_service_role_key/i,
  /sk-[a-zA-Z0-9]{16,}/,
  /\b(trip\s+is\s+hereby\s+auto[-\s]?approved|auto[-\s]?approving\s+trip)\b/i,
  /\b(employee\s+performance\s+score\s*:|employee\s+rating\s*:)\b/i,
  /\b(recommend\s+disciplinary\s+action|terminate\s+employee|place\s+on\s+probation)\b/i,
  /\b(inferred\s+employee\s+intent|employee\s+intended\s+to\s+deceive)\b/i,
];

/**
 * Verifies that model-generated text does not violate FieldTrack AI safety rules
 * (never output secrets, never auto-approve trips, never score employees, never
 * recommend disciplinary action, and never infer personal intent).
 */
export function containsProhibitedPolicyOutput(texts: readonly string[]): boolean {
  return texts.some((text) =>
    PROHIBITED_OUTPUT_PATTERNS.some((pattern) => pattern.test(text))
  );
}
