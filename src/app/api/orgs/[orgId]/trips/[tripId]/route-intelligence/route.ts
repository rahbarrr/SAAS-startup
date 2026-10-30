import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { evaluateTripRouteActivity } from "@/modules/routing/intelligence";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { resolveTenantContext } from "@/modules/tenancy/authorization";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";

interface RouteContext {
  params: Promise<{ orgId: string; tripId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, tripId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);

    await resolveTenantContext({
      user,
      candidateOrgId: orgId,
      repository: tenancyRepository,
    });

    const tripDetail = await tripsRepository.getTripDetail(orgId, tripId);
    if (!tripDetail) {
      throw new AppError("NOT_FOUND", "Trip not found", 404);
    }

    const [allVisits, latestLoc] = await Promise.all([
      visitsRepository.listVisits(orgId, { limit: 100 }),
      locationRepository.getLatestEmployeeLocation(orgId, tripDetail.trip.ownerUserId),
    ]);

    const stopIds = new Set(tripDetail.stops.map((s) => s.id));
    const tripVisits = allVisits.items.filter((v) => stopIds.has(v.tripStopId));

    // Populate stores
    const enrichedStops = await Promise.all(
      tripDetail.stops.map(async (stop) => {
        const store = await storesRepository.getStoreById(orgId, stop.storeId);
        return {
          id: stop.id,
          storeId: stop.storeId,
          sequenceNumber: stop.sequenceNumber,
          status: stop.status,
          store: store ? { name: store.name, latitude: store.latitude, longitude: store.longitude } : null,
        };
      })
    );

    const analysis = evaluateTripRouteActivity({
      trip: {
        id: tripDetail.trip.id,
        ownerUserId: tripDetail.trip.ownerUserId,
        startDate: tripDetail.trip.startDate,
        endDate: tripDetail.trip.endDate,
        status: tripDetail.trip.status,
      },
      stops: enrichedStops,
      visits: tripVisits,
      latestLocation: latestLoc,
    });

    return jsonSuccess(analysis, 200);
  } catch (error) {
    return jsonError(error);
  }
}
