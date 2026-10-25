import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { purgeExpiredLocationBreadcrumbsForOrg } from "@/modules/location/service";
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
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    let body: unknown = {};
    try {
      body = (await request.json()) as unknown;
    } catch {
      // Empty body is acceptable; defaults to 30 days
    }

    const result = await purgeExpiredLocationBreadcrumbsForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      locationRepository,
      auditRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
