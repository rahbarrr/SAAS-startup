import "server-only";
import { AppError } from "@/lib/http/envelope";
import type { StoresRepository } from "@/modules/stores/repository";
import {
  assertTenantResourceOwnership,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { TripsRepository } from "@/modules/trips/repository";
import { updateTripDraftForOrg } from "@/modules/trips/service";
import type {
  LatLng,
  RouteOptimizationProposal,
  RouteStopCandidate,
} from "./domain";
import { optimizeTripRoute } from "./optimizer";
import {
  type RouteDistanceProvider,
  resolveRouteDistanceProvider,
} from "./provider";

export async function generateRouteOptimizationProposalForTrip(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  startLocation?: LatLng | null;
  preserveFirstStop?: boolean;
  distanceProvider?: RouteDistanceProvider;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
  storesRepository: StoresRepository;
}): Promise<RouteOptimizationProposal> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  const tripId = String(params.candidateTripId);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  assertTenantResourceOwnership({
    context,
    resource: detail?.trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  // Fetch store coordinates and metadata
  const storeIds = detail.stops.map((s) => s.storeId);
  const stores = await params.storesRepository.getStoresByIds(context.orgId, storeIds);
  const storeMap = new Map(stores.map((st) => [st.id, st]));

  const candidates: RouteStopCandidate[] = detail.stops.map((stop) => {
    const store = storeMap.get(stop.storeId);
    const coords: LatLng | null =
      store && store.latitude !== null && store.longitude !== null
        ? { latitude: store.latitude, longitude: store.longitude }
        : null;

    return {
      id: stop.id,
      storeId: stop.storeId,
      storeName: store?.name ?? `Store ${stop.storeId}`,
      address: store?.addressLine1 ?? "Address unavailable",
      city: store?.city ?? "City",
      region: store?.region ?? "Region",
      coordinates: coords,
      sequenceNumber: stop.sequenceNumber,
      plannedWindow: stop.plannedAt ? { start: stop.plannedAt } : null,
    };
  });

  return optimizeTripRoute({
    stops: candidates,
    startLocation: params.startLocation,
    preserveFirstStop: params.preserveFirstStop ?? false,
    distanceProvider: params.distanceProvider ?? resolveRouteDistanceProvider(),
    tripId: detail.trip.id,
  });
}

export async function applyOptimizedRouteToTrip(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  proposedStopOrder: readonly { storeId: string; plannedAt?: string | null }[];
  confirmApprovedTripModification?: boolean;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
  storesRepository: StoresRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const tripId = String(params.candidateTripId);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  assertTenantResourceOwnership({
    context,
    resource: detail?.trip,
    requireOwnership: true,
    allowManagerOverride: false, // Only trip owner can update stop sequence
  });

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  const trip = detail.trip;

  if (trip.status === "approved" && !params.confirmApprovedTripModification) {
    throw new AppError(
      "CONFLICT",
      "Trip is already approved. Changing the route requires explicit confirmation and resets the trip to draft for re-approval.",
      409
    );
  }

  // Transform proposed stops into TripStopInput format
  const stopsInput = params.proposedStopOrder.map((s) => ({
    storeId: s.storeId,
    plannedAt: s.plannedAt ?? null,
  }));

  // Re-save trip draft with newly ordered stops
  return updateTripDraftForOrg({
    user: params.user,
    candidateOrgId: context.orgId,
    candidateTripId: trip.id,
    rawInput: {
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      purpose: trip.purpose,
      stops: stopsInput,
    },
    tenancyRepository: params.tenancyRepository,
    storesRepository: params.storesRepository,
    tripsRepository: params.tripsRepository,
  });
}
