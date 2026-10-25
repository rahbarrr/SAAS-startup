import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { exportAuditEventsForOrg } from "@/modules/audit/service";
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
    const auditRepository = new SupabaseAuditRepository(supabase);

    const correlationId =
      request.headers.get("x-correlation-id") ||
      request.headers.get("x-request-id") ||
      null;

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

    const result = await exportAuditEventsForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery: searchParams,
      correlationId,
      tenancyRepository,
      auditRepository,
    });

    return new Response(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Record-Count": String(result.recordCount),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
