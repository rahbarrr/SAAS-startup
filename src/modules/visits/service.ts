import "server-only";
import { AppError } from "@/lib/http/envelope";
import {
  assertTenantResourceOwnership,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import { calculateHaversineMeters } from "@/modules/routing/provider";
import type { StoresRepository } from "@/modules/stores/repository";
import {
  buildUnverifiedDeviceLocation,
  type LocationCapturePolicy,
  type SignedEvidenceDownloadUrl,
  type SignedEvidenceUploadTicket,
  type VisitDetail,
  type VisitEvidence,
  type VisitGeofenceEvent,
} from "./domain";
import type { PaginatedVisitsResult, VisitsRepository } from "./repository";
import {
  checkInStopInputSchema,
  checkOutVisitInputSchema,
  confirmEvidenceUploadInputSchema,
  type DeviceLocationInput,
  evidenceIdParamSchema,
  listVisitsQuerySchema,
  processGeofenceEventInputSchema,
  requestEvidenceUploadTicketInputSchema,
  updateVisitExecutionInputSchema,
  visitIdParamSchema,
} from "./schemas";

function resolveDeviceLocationWithPolicy(params: {
  rawLocation: DeviceLocationInput | undefined;
  policy: LocationCapturePolicy;
  actionLabel: "check-in" | "check-out";
}) {
  const loc = params.rawLocation;
  const status = loc?.status ?? "unavailable";

  if (
    params.policy === "require_location" &&
    (status !== "captured_unverified" ||
      loc?.latitude === null ||
      loc?.latitude === undefined ||
      loc?.longitude === null ||
      loc?.longitude === undefined)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Organization policy requires device location coordinates at ${params.actionLabel}, but location status was '${status}'`,
      400
    );
  }

  return buildUnverifiedDeviceLocation({
    lat: loc?.latitude ?? null,
    lng: loc?.longitude ?? null,
    accuracyMeters: loc?.accuracyMeters ?? null,
    status,
  });
}

export async function listVisitsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
}): Promise<PaginatedVisitsResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const parsedQuery = listVisitsQuerySchema.parse(params.rawQuery ?? {});

  const effectiveQuery =
    context.role === "field_employee"
      ? { ...parsedQuery, employeeUserId: context.user.id }
      : parsedQuery;

  return params.visitsRepository.listVisits(context.orgId, effectiveQuery);
}

export async function getVisitDetailForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
}): Promise<VisitDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const detail = await params.visitsRepository.getVisitDetail(context.orgId, visitId);

  assertTenantResourceOwnership({
    context,
    resource: detail
      ? {
          id: detail.visit.id,
          orgId: detail.visit.orgId,
          ownerUserId: detail.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!detail) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  return detail;
}

export async function checkInStopForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  storesRepository?: Pick<StoresRepository, "getStoreById">;
  locationPolicy?: LocationCapturePolicy;
  now?: Date;
}): Promise<VisitDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const input = checkInStopInputSchema.parse(params.rawInput);
  const stopContext = await params.visitsRepository.getTripStopExecutionContext(
    context.orgId,
    input.tripStopId
  );

  assertTenantResourceOwnership({
    context,
    resource: stopContext
      ? {
          id: stopContext.stop.id,
          orgId: stopContext.stop.orgId,
          ownerUserId: stopContext.trip.ownerUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (!stopContext) {
    throw new AppError(
      "NOT_FOUND",
      "The requested trip stop was not found in your active organization",
      404
    );
  }

  if (
    stopContext.trip.status !== "approved" &&
    stopContext.trip.status !== "in_progress"
  ) {
    throw new AppError(
      "CONFLICT",
      `Cannot check in to a stop unless its parent trip is approved (current trip status: '${stopContext.trip.status}')`,
      409
    );
  }

  const existingForStop = await params.visitsRepository.getVisitByTripStopId(
    context.orgId,
    input.tripStopId
  );

  if (existingForStop) {
    if (
      input.idempotencyKey &&
      existingForStop.checkInIdempotencyKey === input.idempotencyKey &&
      existingForStop.employeeUserId === context.user.id
    ) {
      const idempotentDetail = await params.visitsRepository.getVisitDetail(
        context.orgId,
        existingForStop.id
      );
      if (idempotentDetail) {
        return idempotentDetail;
      }
    }

    throw new AppError(
      "CONFLICT",
      "Duplicate check-in prevented: a visit has already been started for this planned stop",
      409
    );
  }

  const existingActiveVisit = await params.visitsRepository.getActiveVisitForEmployee(
    context.orgId,
    context.user.id
  );

  if (existingActiveVisit && existingActiveVisit.tripStopId !== input.tripStopId) {
    throw new AppError(
      "CONFLICT",
      "You already have an active store visit in progress. Please check out of your current stop before checking into another stop.",
      409
    );
  }

  const location = resolveDeviceLocationWithPolicy({
    rawLocation: input.location,
    policy: params.locationPolicy ?? "allow_without_location_with_explanation",
    actionLabel: "check-in",
  });

  // GPS Rule Verification:
  // Default store radius: 150m, acceptable GPS accuracy: 50m.
  // Evaluate distance + GPS accuracy against geofence boundary.
  let verificationStatus: "verified" | "pending_review" = "verified";
  let verificationNotes: string | null = null;

  if (
    location.status === "captured_unverified" &&
    location.latitude !== null &&
    location.longitude !== null
  ) {
    // If accuracy is poor (> 50m)
    const accuracy = location.accuracyMeters ?? 0;
    if (accuracy > 50) {
      verificationStatus = "pending_review";
      verificationNotes = `GPS accuracy was poor (${Math.round(accuracy)}m > 50m threshold)`;
    }

    // Check store coordinates if available
    let storeLat: number | null = null;
    let storeLng: number | null = null;
    if (params.storesRepository) {
      const store = await params.storesRepository.getStoreById(
        context.orgId,
        stopContext.stop.storeId
      );
      if (store) {
        storeLat = store.latitude;
        storeLng = store.longitude;
      }
    }

    if (storeLat !== null && storeLng !== null) {
      const dist = calculateHaversineMeters(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: storeLat, longitude: storeLng }
      );
      const effectiveRadius = input.geofenceRadiusMeters ?? 150;
      // Outside boundary: distance - accuracy > radius
      if (dist > effectiveRadius) {
        verificationStatus = "pending_review";
        const reason = `Check-in detected at ${Math.round(dist)}m from store (exceeds ${effectiveRadius}m radius; GPS accuracy: ±${Math.round(accuracy)}m)`;
        verificationNotes = verificationNotes
          ? `${verificationNotes}; ${reason}`
          : reason;
      }
    }
  } else if (location.status !== "captured_unverified") {
    verificationStatus = "pending_review";
    verificationNotes = `Check-in occurred without verified device GPS coordinates (status: '${location.status}')`;
  }

  const nowIso = (params.now ?? new Date()).toISOString();

  return params.visitsRepository.checkInStopAtomic({
    orgId: context.orgId,
    tripStopId: input.tripStopId,
    employeeUserId: context.user.id,
    checkedInAt: nowIso,
    idempotencyKey: input.idempotencyKey ?? null,
    location,
    source: input.eventSource ?? "manual",
    deviceTimestamp: input.deviceRecordedAt ?? null,
    radiusMeters: input.geofenceRadiusMeters ?? null,
    verificationStatus,
    verificationNotes,
  });
}

export async function updateVisitExecutionForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  now?: Date;
}): Promise<VisitDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const input = updateVisitExecutionInputSchema.parse(params.rawInput);

  const existing = await params.visitsRepository.getVisitDetail(context.orgId, visitId);
  assertTenantResourceOwnership({
    context,
    resource: existing
      ? {
          id: existing.visit.id,
          orgId: existing.visit.orgId,
          ownerUserId: existing.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  if (existing.visit.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Visit in '${existing.visit.status}' status is locked and cannot be edited`,
      409
    );
  }

  const nowIso = (params.now ?? new Date()).toISOString();

  return params.visitsRepository.updateVisitExecution({
    orgId: context.orgId,
    visitId: existing.visit.id,
    employeeUserId: context.user.id,
    notes: input.notes,
    checklistItems: input.checklistItems,
    nowIso,
  });
}

export async function requestEvidenceUploadTicketForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
}): Promise<SignedEvidenceUploadTicket> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const input = requestEvidenceUploadTicketInputSchema.parse(params.rawInput);

  const existing = await params.visitsRepository.getVisitDetail(context.orgId, visitId);
  assertTenantResourceOwnership({
    context,
    resource: existing
      ? {
          id: existing.visit.id,
          orgId: existing.visit.orgId,
          ownerUserId: existing.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  if (existing.visit.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Cannot upload evidence to a visit in '${existing.visit.status}' status`,
      409
    );
  }

  return params.visitsRepository.createSignedEvidenceUploadTicket({
    orgId: context.orgId,
    visitId: existing.visit.id,
    fileType: input.fileType,
    fileSize: input.fileSize,
  });
}

export async function confirmEvidenceUploadForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
}): Promise<VisitEvidence> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const input = confirmEvidenceUploadInputSchema.parse(params.rawInput);

  const existing = await params.visitsRepository.getVisitDetail(context.orgId, visitId);
  assertTenantResourceOwnership({
    context,
    resource: existing
      ? {
          id: existing.visit.id,
          orgId: existing.visit.orgId,
          ownerUserId: existing.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  if (existing.visit.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Cannot attach evidence to a visit in '${existing.visit.status}' status`,
      409
    );
  }

  // Strictly enforce server-issued `<orgId>/<visitId>/<uuid>.<ext>` path format
  // Never trust a client-supplied path that points to another org, another visit, or non-UUID filename
  const expectedPrefix = `${context.orgId}/${existing.visit.id}/`;
  const strictObjectRegex = new RegExp(
    `^${context.orgId}/${existing.visit.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|pdf)$`,
    "i"
  );

  if (
    !input.storagePath.startsWith(expectedPrefix) ||
    input.storagePath.includes("..") ||
    !strictObjectRegex.test(input.storagePath)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid or untrusted storage path: object path must be a server-issued randomized path for this organization and visit",
      400
    );
  }

  // Verify the file actually exists in private storage before recording evidence metadata
  const isUploaded = await params.visitsRepository.verifyStorageObjectUploaded({
    orgId: context.orgId,
    visitId: existing.visit.id,
    storagePath: input.storagePath,
  });

  if (!isUploaded) {
    throw new AppError(
      "CONFLICT",
      "Evidence upload failed or was not found in storage. The evidence item was not marked as uploaded; please retry.",
      409
    );
  }

  return params.visitsRepository.recordConfirmedEvidence({
    orgId: context.orgId,
    visitId: existing.visit.id,
    uploadedBy: context.user.id,
    storagePath: input.storagePath,
    fileType: input.fileType,
    fileSize: input.fileSize,
    caption: input.caption,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

export async function getSignedEvidenceDownloadUrlForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  candidateEvidenceId: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
}): Promise<SignedEvidenceDownloadUrl> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const { evidenceId } = evidenceIdParamSchema.parse({
    evidenceId: params.candidateEvidenceId,
  });

  const existing = await params.visitsRepository.getVisitDetail(context.orgId, visitId);
  assertTenantResourceOwnership({
    context,
    resource: existing
      ? {
          id: existing.visit.id,
          orgId: existing.visit.orgId,
          ownerUserId: existing.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  const matchingEvidence = existing.evidence.find(
    (e) => e.id === evidenceId && e.orgId === context.orgId && e.visitId === visitId
  );

  if (!matchingEvidence) {
    throw new AppError(
      "NOT_FOUND",
      "The requested evidence file was not found in your active organization",
      404
    );
  }

  return params.visitsRepository.createSignedEvidenceDownloadUrl({
    orgId: context.orgId,
    visitId,
    evidenceId,
    expiresInSeconds: 120,
  });
}

export async function checkOutVisitForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  locationPolicy?: LocationCapturePolicy;
  now?: Date;
}): Promise<VisitDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const input = checkOutVisitInputSchema.parse(params.rawInput ?? {});

  const existing = await params.visitsRepository.getVisitDetail(context.orgId, visitId);
  assertTenantResourceOwnership({
    context,
    resource: existing
      ? {
          id: existing.visit.id,
          orgId: existing.visit.orgId,
          ownerUserId: existing.visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  // Safe idempotent retry if the visit was already checked out with the same idempotencyKey
  if (
    existing.visit.status === "submitted" &&
    input.idempotencyKey &&
    existing.visit.checkOutIdempotencyKey === input.idempotencyKey
  ) {
    return existing;
  }

  if (existing.visit.status !== "in_progress") {
    throw new AppError(
      "CONFLICT",
      `Visit is already in '${existing.visit.status}' status and cannot be checked out again`,
      409
    );
  }

  if (!existing.visit.checkedInAt) {
    throw new AppError("CONFLICT", "Cannot check out of a visit before checking in", 409);
  }

  const incompleteRequired = existing.checklistItems.filter(
    (item) => item.required && !item.completedAt
  );

  if (incompleteRequired.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Cannot check out until all required checklist items are completed (${incompleteRequired.length} remaining: ${incompleteRequired.map((i) => i.questionKey).join(", ")})`,
      400
    );
  }

  const location = resolveDeviceLocationWithPolicy({
    rawLocation: input.location,
    policy: params.locationPolicy ?? "allow_without_location_with_explanation",
    actionLabel: "check-out",
  });

  const nowIso = (params.now ?? new Date()).toISOString();

  return params.visitsRepository.checkOutVisitAtomic({
    orgId: context.orgId,
    visitId: existing.visit.id,
    employeeUserId: context.user.id,
    checkedOutAt: nowIso,
    notes: input.notes,
    idempotencyKey: input.idempotencyKey ?? null,
    location,
    source: input.eventSource ?? "manual",
    deviceTimestamp: input.deviceRecordedAt ?? null,
  });
}

export interface ProcessGeofenceEventResult {
  success: boolean;
  visitId?: string;
  status: "processed" | "pending_review" | "rejected" | "duplicate";
  serverReceivedAt: string;
  syncDelayMs: number;
  message?: string;
  geofenceEvent: VisitGeofenceEvent;
}

export async function processGeofenceEventForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  visitsRepository: VisitsRepository;
  storesRepository?: Pick<StoresRepository, "getStoreById">;
  now?: Date;
}): Promise<ProcessGeofenceEventResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const input = processGeofenceEventInputSchema.parse(params.rawInput);
  const now = params.now ?? new Date();
  const serverReceivedAt = now.toISOString();
  const deviceTime = new Date(input.deviceRecordedAt);
  const syncDelayMs = Math.max(0, now.getTime() - deviceTime.getTime());
  const isDelayedSync = syncDelayMs > 300_000; // > 5 minutes

  // 1. Server-side idempotency check
  const existingEvent = await params.visitsRepository.getGeofenceEventByClientId(
    context.orgId,
    input.clientEventId
  );
  if (existingEvent) {
    return {
      success: existingEvent.status !== "rejected",
      visitId: existingEvent.visitId ?? undefined,
      status: "duplicate",
      serverReceivedAt: existingEvent.serverReceivedAt,
      syncDelayMs: Math.max(
        0,
        new Date(existingEvent.serverReceivedAt).getTime() - deviceTime.getTime()
      ),
      message: "Geofence event was already recorded (idempotent duplicate).",
      geofenceEvent: existingEvent,
    };
  }

  // 2. Resolve stop execution context & verify ownership
  const stopContext = await params.visitsRepository.getTripStopExecutionContext(
    context.orgId,
    input.tripStopId
  );

  if (!stopContext) {
    throw new AppError("NOT_FOUND", "Trip stop not found in active organization", 404);
  }

  if (
    stopContext.stop.tripId !== input.tripId ||
    stopContext.stop.storeId !== input.storeId
  ) {
    throw new AppError(
      "CONFLICT",
      "Stop does not belong to the requested trip or store",
      409
    );
  }

  if (stopContext.trip.ownerUserId !== context.user.id) {
    await params.visitsRepository.recordGeofenceEvent({
      orgId: context.orgId,
      tripId: input.tripId,
      tripStopId: input.tripStopId,
      storeId: input.storeId,
      employeeUserId: context.user.id,
      visitId: null,
      eventType: input.eventType,
      clientEventId: input.clientEventId,
      deviceRecordedAt: input.deviceRecordedAt,
      serverReceivedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      geofenceRadiusMeters: input.geofenceRadiusMeters,
      dwellTimeSeconds: input.dwellTimeSeconds ?? null,
      status: "rejected",
      rejectionReason: "Unauthorized: only assigned trip owner can record visit events",
    });

    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      "Only the assigned trip employee can record visit events for this trip",
      403
    );
  }

  if (
    stopContext.trip.status !== "approved" &&
    stopContext.trip.status !== "in_progress"
  ) {
    await params.visitsRepository.recordGeofenceEvent({
      orgId: context.orgId,
      tripId: input.tripId,
      tripStopId: input.tripStopId,
      storeId: input.storeId,
      employeeUserId: context.user.id,
      visitId: null,
      eventType: input.eventType,
      clientEventId: input.clientEventId,
      deviceRecordedAt: input.deviceRecordedAt,
      serverReceivedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      geofenceRadiusMeters: input.geofenceRadiusMeters,
      dwellTimeSeconds: input.dwellTimeSeconds ?? null,
      status: "rejected",
      rejectionReason: `Trip is not executable (current status: '${stopContext.trip.status}')`,
    });

    throw new AppError(
      "CONFLICT",
      `Cannot record visit geofence event when parent trip status is '${stopContext.trip.status}'`,
      409
    );
  }

  // 3. Location evidence validation
  let isAmbiguous = false;
  const ambiguityReasons: string[] = [];

  if (
    input.accuracyMeters !== null &&
    input.accuracyMeters !== undefined &&
    input.accuracyMeters > 200
  ) {
    isAmbiguous = true;
    ambiguityReasons.push(
      `Reported GPS accuracy (${Math.round(input.accuracyMeters)}m) exceeds reliable threshold (200m)`
    );
  }

  if (params.storesRepository) {
    const store = await params.storesRepository.getStoreById(
      context.orgId,
      input.storeId
    );
    if (store && store.latitude !== null && store.longitude !== null) {
      const distMeters = calculateHaversineMeters(
        { latitude: input.latitude, longitude: input.longitude },
        { latitude: store.latitude, longitude: store.longitude }
      );
      if (distMeters > input.geofenceRadiusMeters + 150) {
        isAmbiguous = true;
        ambiguityReasons.push(
          `Device location (${Math.round(distMeters)}m) exceeded geofence radius (${input.geofenceRadiusMeters}m)`
        );
      }
    }
  }

  if (isDelayedSync) {
    isAmbiguous = true;
    ambiguityReasons.push(`Delayed sync (${Math.round(syncDelayMs / 1000)}s latency)`);
  }

  const verificationStatus = isAmbiguous ? "pending_review" : "verified";
  const verificationNotes =
    ambiguityReasons.length > 0 ? ambiguityReasons.join("; ") : null;

  // 4. Handle arrival
  if (input.eventType === "geofence_entry") {
    const existingForStop = await params.visitsRepository.getVisitByTripStopId(
      context.orgId,
      input.tripStopId
    );

    if (existingForStop) {
      const ge = await params.visitsRepository.recordGeofenceEvent({
        orgId: context.orgId,
        tripId: input.tripId,
        tripStopId: input.tripStopId,
        storeId: input.storeId,
        employeeUserId: context.user.id,
        visitId: existingForStop.id,
        eventType: "geofence_entry",
        clientEventId: input.clientEventId,
        deviceRecordedAt: input.deviceRecordedAt,
        serverReceivedAt,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters ?? null,
        geofenceRadiusMeters: input.geofenceRadiusMeters,
        dwellTimeSeconds: input.dwellTimeSeconds ?? null,
        status: "duplicate",
        rejectionReason: "Visit already exists for this trip stop",
      });

      return {
        success: true,
        visitId: existingForStop.id,
        status: "duplicate",
        serverReceivedAt,
        syncDelayMs,
        message: "Visit already active for this stop.",
        geofenceEvent: ge,
      };
    }

    const existingActiveVisit = await params.visitsRepository.getActiveVisitForEmployee(
      context.orgId,
      context.user.id
    );

    if (existingActiveVisit && existingActiveVisit.tripStopId !== input.tripStopId) {
      const ge = await params.visitsRepository.recordGeofenceEvent({
        orgId: context.orgId,
        tripId: input.tripId,
        tripStopId: input.tripStopId,
        storeId: input.storeId,
        employeeUserId: context.user.id,
        visitId: null,
        eventType: "geofence_entry",
        clientEventId: input.clientEventId,
        deviceRecordedAt: input.deviceRecordedAt,
        serverReceivedAt,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters ?? null,
        geofenceRadiusMeters: input.geofenceRadiusMeters,
        dwellTimeSeconds: input.dwellTimeSeconds ?? null,
        status: "pending_review",
        rejectionReason: `Another visit (${existingActiveVisit.id}) is currently in progress at stop ${existingActiveVisit.tripStopId}`,
      });

      return {
        success: false,
        status: "pending_review",
        serverReceivedAt,
        syncDelayMs,
        message:
          "Arrival recorded as pending review: employee currently has another active stop visit.",
        geofenceEvent: ge,
      };
    }

    const visitDetail = await params.visitsRepository.checkInStopAtomic({
      orgId: context.orgId,
      tripStopId: input.tripStopId,
      employeeUserId: context.user.id,
      checkedInAt: serverReceivedAt,
      idempotencyKey: input.clientEventId,
      location: buildUnverifiedDeviceLocation({
        lat: input.latitude,
        lng: input.longitude,
        accuracyMeters: input.accuracyMeters ?? null,
        status: "captured_unverified",
      }),
      source: "automatic_geofence",
      deviceTimestamp: input.deviceRecordedAt,
      radiusMeters: input.geofenceRadiusMeters,
      verificationStatus,
      verificationNotes,
    });

    const ge = await params.visitsRepository.recordGeofenceEvent({
      orgId: context.orgId,
      tripId: input.tripId,
      tripStopId: input.tripStopId,
      storeId: input.storeId,
      employeeUserId: context.user.id,
      visitId: visitDetail.visit.id,
      eventType: "geofence_entry",
      clientEventId: input.clientEventId,
      deviceRecordedAt: input.deviceRecordedAt,
      serverReceivedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      geofenceRadiusMeters: input.geofenceRadiusMeters,
      dwellTimeSeconds: input.dwellTimeSeconds ?? null,
      status: isAmbiguous ? "pending_review" : "processed",
      rejectionReason: isAmbiguous ? verificationNotes : null,
    });

    return {
      success: true,
      visitId: visitDetail.visit.id,
      status: isAmbiguous ? "pending_review" : "processed",
      serverReceivedAt,
      syncDelayMs,
      message: isAmbiguous
        ? `Automatic check-in recorded as pending review: ${verificationNotes}`
        : "Automatic geofence check-in verified successfully.",
      geofenceEvent: ge,
    };
  }

  // 5. Handle departure (geofence_exit)
  const existingForStop = await params.visitsRepository.getVisitByTripStopId(
    context.orgId,
    input.tripStopId
  );

  if (!existingForStop || existingForStop.status !== "in_progress") {
    const ge = await params.visitsRepository.recordGeofenceEvent({
      orgId: context.orgId,
      tripId: input.tripId,
      tripStopId: input.tripStopId,
      storeId: input.storeId,
      employeeUserId: context.user.id,
      visitId: existingForStop?.id ?? null,
      eventType: "geofence_exit",
      clientEventId: input.clientEventId,
      deviceRecordedAt: input.deviceRecordedAt,
      serverReceivedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      geofenceRadiusMeters: input.geofenceRadiusMeters,
      dwellTimeSeconds: input.dwellTimeSeconds ?? null,
      status: "rejected",
      rejectionReason: !existingForStop
        ? "No visit found for this stop to check out"
        : `Visit is already in '${existingForStop.status}' status`,
    });

    return {
      success: false,
      status: "rejected",
      serverReceivedAt,
      syncDelayMs,
      message: "Cannot check out: no in-progress visit found for this stop.",
      geofenceEvent: ge,
    };
  }

  const visitDetail = await params.visitsRepository.getVisitDetail(
    context.orgId,
    existingForStop.id
  );
  const incompleteRequired = (visitDetail?.checklistItems ?? []).filter(
    (item) => item.required && !item.completedAt
  );

  if (incompleteRequired.length > 0) {
    const reason = `Departure detected while ${incompleteRequired.length} required checklist item(s) remained incomplete (${incompleteRequired.map((i) => i.questionKey).join(", ")})`;
    await params.visitsRepository.markVisitVerificationStatus?.({
      orgId: context.orgId,
      visitId: existingForStop.id,
      verificationStatus: "pending_review",
      verificationNotes: reason,
    });
    const ge = await params.visitsRepository.recordGeofenceEvent({
      orgId: context.orgId,
      tripId: input.tripId,
      tripStopId: input.tripStopId,
      storeId: input.storeId,
      employeeUserId: context.user.id,
      visitId: existingForStop.id,
      eventType: "geofence_exit",
      clientEventId: input.clientEventId,
      deviceRecordedAt: input.deviceRecordedAt,
      serverReceivedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      geofenceRadiusMeters: input.geofenceRadiusMeters,
      dwellTimeSeconds: input.dwellTimeSeconds ?? null,
      status: "pending_review",
      rejectionReason: reason,
    });

    return {
      success: true,
      visitId: existingForStop.id,
      status: "pending_review",
      serverReceivedAt,
      syncDelayMs,
      message: reason,
      geofenceEvent: ge,
    };
  }

  await params.visitsRepository.checkOutVisitAtomic({
    orgId: context.orgId,
    visitId: existingForStop.id,
    employeeUserId: context.user.id,
    checkedOutAt: serverReceivedAt,
    idempotencyKey: input.clientEventId,
    location: buildUnverifiedDeviceLocation({
      lat: input.latitude,
      lng: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      status: "captured_unverified",
    }),
    source: "automatic_geofence",
    deviceTimestamp: input.deviceRecordedAt,
    verificationStatus,
    verificationNotes: isAmbiguous ? verificationNotes : null,
  });

  const ge = await params.visitsRepository.recordGeofenceEvent({
    orgId: context.orgId,
    tripId: input.tripId,
    tripStopId: input.tripStopId,
    storeId: input.storeId,
    employeeUserId: context.user.id,
    visitId: existingForStop.id,
    eventType: "geofence_exit",
    clientEventId: input.clientEventId,
    deviceRecordedAt: input.deviceRecordedAt,
    serverReceivedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters ?? null,
    geofenceRadiusMeters: input.geofenceRadiusMeters,
    dwellTimeSeconds: input.dwellTimeSeconds ?? null,
    status: isAmbiguous ? "pending_review" : "processed",
    rejectionReason: isAmbiguous ? verificationNotes : null,
  });

  return {
    success: true,
    visitId: existingForStop.id,
    status: isAmbiguous ? "pending_review" : "processed",
    serverReceivedAt,
    syncDelayMs,
    message: isAmbiguous
      ? `Automatic check-out recorded as pending review: ${verificationNotes}`
      : "Automatic geofence check-out verified successfully.",
    geofenceEvent: ge,
  };
}
