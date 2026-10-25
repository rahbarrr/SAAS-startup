import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import {
  applyOptimizedRouteToTrip,
  generateRouteOptimizationProposalForTrip,
} from "@/modules/routing/service";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
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
    const storesRepository = new SupabaseStoresRepository(supabase);

    let body: {
      action?: "propose" | "apply";
      preserveFirstStop?: boolean;
      confirmApprovedTripModification?: boolean;
      startLocation?: { latitude: number; longitude: number } | null;
      proposedStopOrder?: { storeId: string; plannedAt?: string | null }[];
    } = {};

    try {
      body = (await request.json()) as typeof body;
    } catch {
      // Body is optional for simple proposal request
    }

    const action = body.action ?? "propose";

    if (action === "apply") {
      if (!body.proposedStopOrder || !Array.isArray(body.proposedStopOrder)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Must provide proposedStopOrder array to apply route optimization",
          400
        );
      }

      const updatedTrip = await applyOptimizedRouteToTrip({
        user,
        candidateOrgId: orgId,
        candidateTripId: tripId,
        proposedStopOrder: body.proposedStopOrder,
        confirmApprovedTripModification: body.confirmApprovedTripModification ?? false,
        tenancyRepository,
        tripsRepository,
        storesRepository,
      });

      return jsonSuccess(updatedTrip, 200);
    }

    // Default: generate proposal
    const proposal = await generateRouteOptimizationProposalForTrip({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      startLocation: body.startLocation ?? null,
      preserveFirstStop: body.preserveFirstStop ?? false,
      tenancyRepository,
      tripsRepository,
      storesRepository,
    });

    return jsonSuccess(proposal, 200);
  } catch (error) {
    return jsonError(error);
  }
}
