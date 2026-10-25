import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { updateBriefingActionForOrg } from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    const result = await updateBriefingActionForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      auditRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
