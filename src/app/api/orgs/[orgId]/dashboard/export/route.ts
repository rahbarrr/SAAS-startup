import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { exportManagerReportCsvForOrg } from "@/modules/reporting/service";
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
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      startDateFrom: searchParams.get("startDateFrom") ?? undefined,
      startDateTo: searchParams.get("startDateTo") ?? undefined,
      employeeUserId: searchParams.get("employeeUserId") ?? undefined,
      tripStatus: searchParams.get("tripStatus") ?? undefined,
      visitStatus: searchParams.get("visitStatus") ?? undefined,
      storeId: searchParams.get("storeId") ?? undefined,
      onlyExceptions: searchParams.get("onlyExceptions") ?? undefined,
    };

    const exported = await exportManagerReportCsvForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      reportingRepository,
    });

    return new NextResponse(exported.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
        "Cache-Control": "no-store",
        "X-Row-Count": String(exported.rowCount),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
