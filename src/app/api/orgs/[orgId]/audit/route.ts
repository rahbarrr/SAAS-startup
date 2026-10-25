import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { listAuditEventsForOrg } from "@/modules/audit/service";
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

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

    const result = await listAuditEventsForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery: searchParams,
      tenancyRepository,
      auditRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
