import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getOperationsReportForOrg } from "@/modules/reporting/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const reportingRepository = new SupabaseReportingRepository(supabase);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      range: searchParams.get("range") ?? undefined,
      startDateFrom: searchParams.get("startDateFrom") ?? undefined,
      startDateTo: searchParams.get("startDateTo") ?? undefined,
      territory: searchParams.get("territory") ?? undefined,
    };

    const report = await getOperationsReportForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      reportingRepository,
    });

    return jsonSuccess(report, 200);
  } catch (error) {
    return jsonError(error);
  }
}
