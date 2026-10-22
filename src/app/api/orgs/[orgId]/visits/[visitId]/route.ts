import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import {
  getVisitDetailForOrg,
  updateVisitExecutionForOrg,
} from "@/modules/visits/service";

interface RouteContext {
  params: Promise<{ orgId: string; visitId: string }>;
}

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

    const detail = await getVisitDetailForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(detail, 200);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
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

    const updated = await updateVisitExecutionForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(updated, 200);
  } catch (error) {
    return jsonError(error);
  }
}
