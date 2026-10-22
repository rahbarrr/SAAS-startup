import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { checkInStopForOrg, listVisitsForOrg } from "@/modules/visits/service";

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
    const visitsRepository = new SupabaseVisitsRepository(supabase);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      tripStopId: searchParams.get("tripStopId") ?? undefined,
      employeeUserId: searchParams.get("employeeUserId") ?? undefined,
    };

    const result = await listVisitsForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return jsonError(error);
  }
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
    const visitsRepository = new SupabaseVisitsRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const created = await checkInStopForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      visitsRepository,
    });

    return jsonSuccess(created, 201);
  } catch (error) {
    return jsonError(error);
  }
}
