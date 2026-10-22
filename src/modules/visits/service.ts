import "server-only";
import { AppError } from "@/lib/http/envelope";
import {
  assertTenantResourceOwnership,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import {
  buildUnverifiedDeviceLocation,
  type LocationCapturePolicy,
  type SignedEvidenceDownloadUrl,
  type SignedEvidenceUploadTicket,
  type VisitDetail,
  type VisitEvidence,
} from "./domain";
import type { PaginatedVisitsResult, VisitsRepository } from "./repository";
import {
  checkInStopInputSchema,
  checkOutVisitInputSchema,
  confirmEvidenceUploadInputSchema,
  type DeviceLocationInput,
  evidenceIdParamSchema,
  listVisitsQuerySchema,
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

  const nowIso = (params.now ?? new Date()).toISOString();

  return params.visitsRepository.checkInStopAtomic({
    orgId: context.orgId,
    tripStopId: input.tripStopId,
    employeeUserId: context.user.id,
    checkedInAt: nowIso,
    idempotencyKey: input.idempotencyKey ?? null,
    location,
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
  });
}
