import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { getManagerDailyBriefingForOrg } from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const reportingRepository = new SupabaseReportingRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    const briefing = await getManagerDailyBriefingForOrg({
      user,
      candidateOrgId: orgId,
      tenancyRepository,
      reportingRepository,
      auditRepository,
    });

    return jsonSuccess(briefing, 200);
  } catch (error) {
    return jsonError(error);
  }
}
