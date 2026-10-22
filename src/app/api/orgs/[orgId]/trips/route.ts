import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { createTripDraftForOrg, listTripsForOrg } from "@/modules/trips/service";

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
    };

    const result = await listTripsForOrg({
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

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const created = await createTripDraftForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    return jsonSuccess(created, 201);
  } catch (error) {
    return jsonError(error);
  }
}
