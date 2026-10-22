import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg } from "@/modules/trips/service";

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
    const tripsRepository = new SupabaseTripsRepository(supabase);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      ownerUserId: searchParams.get("ownerUserId") ?? undefined,
      startDateFrom: searchParams.get("startDateFrom") ?? undefined,
      startDateTo: searchParams.get("startDateTo") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      excludeOwnTrips: searchParams.get("excludeOwnTrips") ?? undefined,
    };

    const result = await listManagerApprovalInboxForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      tripsRepository,
    });

    return jsonSuccess(result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return jsonError(error);
  }
}
