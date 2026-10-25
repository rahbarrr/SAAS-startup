import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isAiReportsEnabled } from "@/lib/env/startup";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { OpenAiResponsesReportProvider } from "@/modules/ai-reports/openai-provider";
import { SupabaseAiReportsRepository } from "@/modules/ai-reports/repository";
import {
  generateVisitAiReportDraftForOrg,
  getVisitAiReportDraftsStateForOrg,
  reviewVisitAiReportDraftForOrg,
} from "@/modules/ai-reports/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";

interface RouteContext {
  params: Promise<{ orgId: string; visitId: string }>;
}

/**
 * GET /api/orgs/[orgId]/visits/[visitId]/ai-report
 * Returns the organization/server AI availability state (configured, quota, disabledReason)
 * and existing AI report drafts for the authorized visit.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const aiReportsRepository = new SupabaseAiReportsRepository(supabase);
    const aiProvider = new OpenAiResponsesReportProvider();

    const overview = await getVisitAiReportDraftsStateForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      tenancyRepository,
      visitsRepository,
      aiReportsRepository,
      aiProvider,
    });

    return jsonSuccess(overview, 200);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * POST /api/orgs/[orgId]/visits/[visitId]/ai-report
 * Generates a structured AI visit report draft strictly from authorized visit notes,
 * completed checklist items, and explicitly selected evidence captions.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const aiReportsRepository = new SupabaseAiReportsRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);
    const aiProvider = new OpenAiResponsesReportProvider();

    if (!isAiReportsEnabled()) {
      throw new AppError(
        "AI_FEATURE_DISABLED_FOR_ORG",
        "AI report drafting is temporarily disabled.",
        503
      );
    }
    if (!user) {
      throw new AppError("UNAUTHENTICATED", "Authentication required", 401);
    }
    // Per-user throttle BEFORE any provider call; org daily budget is enforced in the service.
    await enforceRateLimit({ supabase, scope: "ai_draft", subject: user.id });

    const draft = await generateVisitAiReportDraftForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
      aiReportsRepository,
      auditRepository,
      aiProvider,
    });

    return jsonSuccess(draft, 201);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * PATCH /api/orgs/[orgId]/visits/[visitId]/ai-report
 * Allows the authorized employee or manager to edit and approve/reject an AI report draft
 * before it is treated as final.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const aiReportsRepository = new SupabaseAiReportsRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    const updatedDraft = await reviewVisitAiReportDraftForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
      aiReportsRepository,
      auditRepository,
    });

    return jsonSuccess(updatedDraft, 200);
  } catch (err) {
    return jsonError(err);
  }
}
