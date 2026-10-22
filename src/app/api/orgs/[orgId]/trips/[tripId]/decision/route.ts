import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { decideTripForOrg } from "@/modules/trips/service";

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const decided = await decideTripForOrg({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      rawInput: body,
      tenancyRepository,
      tripsRepository,
    });

    return jsonSuccess(decided, 200);
  } catch (error) {
    return jsonError(error);
  }
}
