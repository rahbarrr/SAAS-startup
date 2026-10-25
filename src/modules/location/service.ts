import "server-only";
import { AppError } from "@/lib/http/envelope";
import type { AuditRepository } from "@/modules/audit/repository";
import {
  assertTenantResourceOwnership,
  requireAnyOrgRole,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { TripsRepository } from "@/modules/trips/repository";
import type { TripLocationBreadcrumb } from "./domain";
import type { LocationRepository } from "./repository";
import {
  listBreadcrumbsQuerySchema,
  purgeBreadcrumbsInputSchema,
  recordBreadcrumbInputSchema,
} from "./schemas";

export async function recordActiveTripBreadcrumb(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
}): Promise<TripLocationBreadcrumb> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const tripId = String(params.candidateTripId);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  // Only the assigned trip owner can record location breadcrumbs for their trip
  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  // Strict privacy rule: location points are ONLY collected during active in_progress work trips
  if (detail.trip.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Location tracking is only permitted during active in_progress trips (current status: '${detail.trip.status}').`,
      409
    );
  }

  const validatedInput = recordBreadcrumbInputSchema.parse(params.rawInput);

  return params.locationRepository.recordBreadcrumb(context.user.id, {
    orgId: context.orgId,
    tripId: detail.trip.id,
    latitude: validatedInput.latitude,
    longitude: validatedInput.longitude,
    accuracyMeters: validatedInput.accuracyMeters,
    recordedAt: validatedInput.recordedAt,
  });
}

export async function listTripBreadcrumbs(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawQuery?: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
}): Promise<TripLocationBreadcrumb[]> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  const tripId = String(params.candidateTripId);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  // Trip owner or managers/admins can view breadcrumbs
  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  const query = listBreadcrumbsQuerySchema.parse(params.rawQuery ?? {});

  return params.locationRepository.listBreadcrumbsForTrip(
    context.orgId,
    detail.trip.id,
    query.limit
  );
}

export async function purgeExpiredLocationBreadcrumbsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput?: unknown;
  tenancyRepository: TenancyRepository;
  locationRepository: LocationRepository;
  auditRepository?: AuditRepository;
}): Promise<{ deletedCount: number; retentionDays: number }> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  // Only organization administrators can execute retention purges
  requireAnyOrgRole(context, ["admin"]);

  const parsed = purgeBreadcrumbsInputSchema.parse(params.rawInput ?? {});

  const deletedCount = await params.locationRepository.purgeExpiredBreadcrumbs(
    context.orgId,
    parsed.retentionDays
  );

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "location.breadcrumbs_purged",
      entityType: "location_breadcrumbs",
      entityId: context.orgId,
      reason: `Admin requested location retention purge (> ${parsed.retentionDays} days)`,
      metadata: {
        retentionDays: parsed.retentionDays,
        deletedCount,
      },
    });
  }

  return {
    deletedCount,
    retentionDays: parsed.retentionDays,
  };
}
