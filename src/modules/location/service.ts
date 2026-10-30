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
  startTrackingSessionInputSchema,
  stopTrackingSessionInputSchema,
  submitGeofenceEventRecordInputSchema,
  submitLocationEventInputSchema,
  upsertStoreGeofenceInputSchema,
} from "./schemas";
import { assessLocationFreshness } from "./domain";

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

// ============================================================================
// Live Tracking & Store Geofencing Services
// ============================================================================

export async function startTripTrackingSession(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
  auditRepository?: AuditRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const input = startTrackingSessionInputSchema.parse(params.rawInput);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, input.tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (detail.trip.status !== "in_progress" && detail.trip.status !== "approved") {
    throw new AppError(
      "CONFLICT",
      `Tracking session can only be started for approved or in_progress trips (current status: '${detail.trip.status}').`,
      409
    );
  }

  // Check if session already active
  const existing = await params.locationRepository.getActiveTrackingSession(
    context.orgId,
    detail.trip.id,
    context.user.id
  );
  if (existing) {
    return existing;
  }

  const session = await params.locationRepository.startTrackingSession({
    orgId: context.orgId,
    tripId: detail.trip.id,
    employeeId: context.user.id,
    consentRecordedAt: input.consentRecordedAt,
  });

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "tracking.session_started",
      entityType: "trip_tracking_sessions",
      entityId: session.id,
      reason: "Employee started opt-in location tracking session for authorized trip",
      metadata: { tripId: detail.trip.id },
    });
  }

  return session;
}

export async function stopTripTrackingSession(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
  auditRepository?: AuditRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const input = stopTrackingSessionInputSchema.parse(params.rawInput);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, input.tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  const active = await params.locationRepository.getActiveTrackingSession(
    context.orgId,
    detail.trip.id,
    context.user.id
  );

  if (!active) {
    return null;
  }

  const stopped = await params.locationRepository.stopTrackingSession(
    context.orgId,
    active.id
  );

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "tracking.session_stopped",
      entityType: "trip_tracking_sessions",
      entityId: stopped.id,
      reason: input.reason ?? "Employee stopped location tracking session",
      metadata: { tripId: detail.trip.id },
    });
  }

  return stopped;
}

export async function submitLiveLocationUpdate(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const input = submitLocationEventInputSchema.parse(params.rawInput);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, input.tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (detail.trip.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Location updates are only accepted during in_progress trips (status: '${detail.trip.status}').`,
      409
    );
  }

  return params.locationRepository.recordLocationEvent({
    orgId: context.orgId,
    tripId: detail.trip.id,
    employeeId: context.user.id,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    speedMps: input.speedMps,
    heading: input.heading,
    recordedAt: input.recordedAt,
    source: input.source,
  });
}

export async function listManagerLiveTracking(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  tenancyRepository: TenancyRepository;
  locationRepository: LocationRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireAnyOrgRole(context, ["admin", "manager"]);

  const locations = await params.locationRepository.listLatestEmployeeLocations(
    context.orgId
  );

  return locations.map((loc) => {
    const freshness = assessLocationFreshness(loc.recordedAt, loc.accuracyM);
    return {
      ...loc,
      freshness,
    };
  });
}

export async function upsertStoreGeofenceConfiguration(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  locationRepository: LocationRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireAnyOrgRole(context, ["admin", "manager"]);

  const input = upsertStoreGeofenceInputSchema.parse(params.rawInput);

  return params.locationRepository.upsertStoreGeofence({
    orgId: context.orgId,
    storeId: input.storeId,
    latitude: input.latitude,
    longitude: input.longitude,
    radiusM: input.radiusM,
    enabled: input.enabled,
  });
}

export async function submitGeofenceTelemetryEvent(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: Pick<TripsRepository, "getTripDetail">;
  locationRepository: LocationRepository;
}) {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const input = submitGeofenceEventRecordInputSchema.parse(params.rawInput);
  const detail = await params.tripsRepository.getTripDetail(context.orgId, input.tripId);

  if (!detail) {
    throw new AppError("NOT_FOUND", "Trip not found in your organization", 404);
  }

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  return params.locationRepository.recordGeofenceEvent({
    orgId: context.orgId,
    tripId: input.tripId,
    visitId: input.visitId,
    storeId: input.storeId,
    employeeId: context.user.id,
    eventType: input.eventType,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    recordedAt: input.recordedAt,
  });
}

