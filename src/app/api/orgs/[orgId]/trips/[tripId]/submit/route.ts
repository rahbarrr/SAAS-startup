import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { submitTripForApproval } from "@/modules/trips/service";

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
    const storesRepository = new SupabaseStoresRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);

    let body: unknown = {};
    const text = await request.text();
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
      }
    }

    const submitted = await submitTripForApproval({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      rawInput: body,
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    return jsonSuccess(submitted, 200);
  } catch (error) {
    return jsonError(error);
  }
}
