import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { submitLiveLocationUpdate } from "@/modules/location/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";

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
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);

    const body = (await request.json()) as unknown;

    const result = await submitLiveLocationUpdate({
      user,
      candidateOrgId: orgId,
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
