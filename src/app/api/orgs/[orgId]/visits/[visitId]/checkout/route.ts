import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { checkOutVisitForOrg } from "@/modules/visits/service";

interface RouteContext {
  params: Promise<{ orgId: string; visitId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, visitId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);

    let body: unknown = {};
    const rawText = await request.text();
    if (rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
      }
    }

    const checkedOut = await checkOutVisitForOrg({
      user,
      candidateOrgId: orgId,
      candidateVisitId: visitId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(checkedOut, 200);
  } catch (error) {
    return jsonError(error);
  }
}
