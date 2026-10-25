import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import {
  listTripBreadcrumbs,
  recordActiveTripBreadcrumb,
} from "@/modules/location/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";

interface RouteContext {
  params: Promise<{ orgId: string; tripId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, tripId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);

    const body = (await request.json()) as unknown;

    const result = await recordActiveTripBreadcrumb({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      rawInput: body,
      tenancyRepository,
      tripsRepository,
      locationRepository,
    });

    return jsonSuccess(result, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, tripId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

    const result = await listTripBreadcrumbs({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      rawQuery: searchParams,
      tenancyRepository,
      tripsRepository,
      locationRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
