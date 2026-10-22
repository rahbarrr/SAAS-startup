import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isUploadsEnabled } from "@/lib/env/startup";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import {
  confirmEvidenceUploadForOrg,
  getSignedEvidenceDownloadUrlForOrg,
  requestEvidenceUploadTicketForOrg,
} from "@/modules/visits/service";

interface RouteContext {
  params: Promise<{ orgId: string; visitId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    const evidenceId = request.nextUrl.searchParams.get("evidenceId");
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);

    const signedUrl = await getSignedEvidenceDownloadUrlForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      candidateEvidenceId: evidenceId,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(signedUrl, 200);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    const action = request.nextUrl.searchParams.get("action") ?? "request_ticket";
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    if (action === "confirm") {
      if (!isUploadsEnabled()) {
        throw new AppError("CONFLICT", "Evidence uploads are temporarily disabled.", 503);
      }
      const confirmed = await confirmEvidenceUploadForOrg({
        user,
        candidateOrgId: orgId,
        candidateVisitId: visitId,
        rawInput: body,
        tenancyRepository,
        visitsRepository,
      });
      return jsonSuccess(confirmed, 201);
    }

    if (!isUploadsEnabled()) {
      throw new AppError("CONFLICT", "Evidence uploads are temporarily disabled.", 503);
    }
    if (user) {
      await enforceRateLimit({ supabase, scope: "upload", subject: user.id });
    }

    const ticket = await requestEvidenceUploadTicketForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
    });
    return jsonSuccess(ticket, 200);
  } catch (error) {
    return jsonError(error);
  }
}
