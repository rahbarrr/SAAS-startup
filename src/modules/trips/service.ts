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
import type { TripAuditEventType, TripDecisionStatus, TripDetail } from "./domain";
import type { PaginatedTripsResult, TripsRepository } from "./repository";
import {
  allowlistedTripAuditMetadataSchema,
  decideTripInputSchema,
  listManagerApprovalInboxQuerySchema,
  listTripsQuerySchema,
  submitTripInputSchema,
  tripIdParamSchema,
  type TripStopInput,
  upsertTripDraftInputSchema,
} from "./schemas";

async function assertAllStopStoresActiveInOrg(params: {
  orgId: string;
  stops: readonly TripStopInput[];
  destinationCity?: string;
  storesRepository: StoresRepository;
}): Promise<void> {
  if (params.stops.length === 0) {
    return;
  }

  const storeIds = params.stops.map((s) => s.storeId);
  const foundStores = await params.storesRepository.getStoresByIds(
    params.orgId,
    storeIds
  );

  const storeMap = new Map(foundStores.map((s) => [s.id, s]));

  for (const stop of params.stops) {
    const store = storeMap.get(stop.storeId);
    if (!store || store.orgId !== params.orgId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "One or more selected stores do not exist in your active organization",
        400
      );
    }
    if (!store.active) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Store '${store.name}' is archived and cannot be added to a trip`,
        400
      );
    }
    if (
      params.destinationCity &&
      params.destinationCity !== "Not specified" &&
      store.city.trim().toLocaleLowerCase() !==
        params.destinationCity.trim().toLocaleLowerCase()
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Store '${store.name}' is in ${store.city}, not the trip destination ${params.destinationCity}`,
        400
      );
    }
  }
}

export async function listTripsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
}): Promise<PaginatedTripsResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  const parsedQuery = listTripsQuerySchema.parse(params.rawQuery);

  // Field employees can only list their own trips; managers and admins can view all trips in their active org
  const effectiveQuery =
    context.role === "field_employee"
      ? { ...parsedQuery, ownerUserId: context.user.id }
      : parsedQuery;

  return params.tripsRepository.listTrips(context.orgId, effectiveQuery);
}

/**
 * Lists trips in the Manager Approval Inbox for the active organization.
 * Requires `trips:approve` permission (`manager` or `admin` role).
 * Supports filtering by status (defaults to `submitted`), employee owner, date range,
 * text search, and excluding the reviewer's own trips (`excludeOwnTrips`).
 */
export async function listManagerApprovalInboxForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
}): Promise<PaginatedTripsResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:approve");

  const parsed = listManagerApprovalInboxQuerySchema.parse(params.rawQuery ?? {});

  return params.tripsRepository.listTrips(context.orgId, {
    limit: parsed.limit,
    cursor: parsed.cursor,
    status: parsed.status === "all" ? undefined : parsed.status,
    ownerUserId: parsed.ownerUserId,
    excludeOwnerUserId: parsed.excludeOwnTrips ? context.user.id : undefined,
    startDateFrom: parsed.startDateFrom,
    startDateTo: parsed.startDateTo,
    search: parsed.search,
  });
}

export async function getTripDetailForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
}): Promise<TripDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  const { tripId } = tripIdParamSchema.parse({
    tripId: params.candidateTripId,
  });
  const detail = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  assertTenantResourceOwnership({
    context,
    resource: detail?.trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!detail) {
    throw new AppError(
      "NOT_FOUND",
      "The requested trip was not found in your active organization",
      404
    );
  }

  return detail;
}

export async function createTripDraftForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
  tripsRepository: TripsRepository;
}): Promise<TripDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const input = upsertTripDraftInputSchema.parse(params.rawInput);

  await assertAllStopStoresActiveInOrg({
    orgId: context.orgId,
    stops: input.stops,
    destinationCity: input.destinationCity,
    storesRepository: params.storesRepository,
  });

  return params.tripsRepository.createTripDraftWithStops({
    orgId: context.orgId,
    ownerUserId: context.user.id,
    input,
  });
}

/**
 * Updates a trip's details and ordered stops.
 * - Only the trip owner (`ownerUserId === context.user.id`) may edit trip details/stops.
 * - Allowed states: `draft`, `changes_requested`, and `approved`.
 * - Editing an `approved` trip resets its status to `draft` (clearing previous approval fields)
 *   so it requires a fresh approval cycle, while appending `trip_reopened_for_edit` to the audit trail.
 * - Editing a `submitted`, `rejected`, `in_progress`, or `completed` trip is denied with 409 CONFLICT.
 */
export async function updateTripDraftForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
  tripsRepository: TripsRepository;
}): Promise<TripDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const { tripId } = tripIdParamSchema.parse({
    tripId: params.candidateTripId,
  });
  const existing = await params.tripsRepository.getTripDetail(context.orgId, tripId);

  const verifiedTrip = assertTenantResourceOwnership({
    context,
    resource: existing?.trip,
    requireOwnership: true,
    allowManagerOverride: false, // Even managers/admins cannot edit another user's trip plan
  });

  if (
    verifiedTrip.status !== "draft" &&
    verifiedTrip.status !== "changes_requested" &&
    verifiedTrip.status !== "approved"
  ) {
    throw new AppError(
      "CONFLICT",
      `Trips in '${verifiedTrip.status}' status cannot be edited`,
      409
    );
  }

  const input = upsertTripDraftInputSchema.parse(params.rawInput);

  await assertAllStopStoresActiveInOrg({
    orgId: context.orgId,
    stops: input.stops,
    destinationCity: input.destinationCity,
    storesRepository: params.storesRepository,
  });

  return params.tripsRepository.updateTripDraftWithStops({
    orgId: context.orgId,
    tripId: verifiedTrip.id,
    actorUserId: context.user.id,
    previousStatus: verifiedTrip.status,
    previousDecidedBy: verifiedTrip.decidedBy,
    input,
  });
}

export async function submitTripForApproval(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
  tripsRepository: TripsRepository;
  now?: Date;
}): Promise<TripDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:create_own");

  const { tripId } = tripIdParamSchema.parse({
    tripId: params.candidateTripId,
  });
  const input = submitTripInputSchema.parse(params.rawInput ?? {});

  const existing = await params.tripsRepository.getTripDetail(context.orgId, tripId);
  const verifiedTrip = assertTenantResourceOwnership({
    context,
    resource: existing?.trip,
    requireOwnership: true,
    allowManagerOverride: false,
  });

  if (verifiedTrip.status === "submitted") {
    throw new AppError(
      "CONFLICT",
      "This trip has already been submitted and is awaiting manager review",
      409
    );
  }

  if (verifiedTrip.status !== "draft" && verifiedTrip.status !== "changes_requested") {
    throw new AppError(
      "CONFLICT",
      `Cannot submit a trip from '${verifiedTrip.status}' status`,
      409
    );
  }

  const stops = existing?.stops ?? [];
  if (stops.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "At least one active store stop is required before submitting a trip for approval",
      400
    );
  }

  await assertAllStopStoresActiveInOrg({
    orgId: context.orgId,
    stops: stops.map((s) => ({
      storeId: s.storeId,
      sequenceNumber: s.sequenceNumber,
      plannedAt: s.plannedAt,
    })),
    storesRepository: params.storesRepository,
  });

  const nowIso = (params.now ?? new Date()).toISOString();
  const isResubmission = verifiedTrip.status === "changes_requested";
  const eventType: TripAuditEventType = isResubmission
    ? "trip_resubmitted"
    : "trip_submitted";
  const defaultNote = isResubmission
    ? "Resubmitted trip for manager approval after requested changes"
    : "Submitted trip for manager approval";
  const metadata = allowlistedTripAuditMetadataSchema.parse({
    ...(input.metadata ?? {}),
    stop_count: stops.length,
  });

  return params.tripsRepository.transitionTripStatusWithAudit({
    orgId: context.orgId,
    tripId: verifiedTrip.id,
    actorUserId: context.user.id,
    oldStatus: verifiedTrip.status,
    newStatus: "submitted",
    eventType,
    submittedAt: nowIso,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    auditNote: input.note ?? defaultNote,
    metadata,
  });
}

const DECISION_TO_AUDIT_EVENT: Readonly<Record<TripDecisionStatus, TripAuditEventType>> =
  {
    approved: "trip_approved",
    changes_requested: "trip_changes_requested",
    rejected: "trip_rejected",
  };

export async function decideTripForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
  now?: Date;
}): Promise<TripDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:approve");

  const { tripId } = tripIdParamSchema.parse({
    tripId: params.candidateTripId,
  });
  const input = decideTripInputSchema.parse(params.rawInput);

  const existing = await params.tripsRepository.getTripDetail(context.orgId, tripId);
  const verifiedTrip = assertTenantResourceOwnership({
    context,
    resource: existing?.trip,
    requireOwnership: false,
  });

  if (verifiedTrip.ownerUserId === context.user.id) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      "Self-approval is forbidden: you cannot approve or decide your own trip",
      403
    );
  }

  if (verifiedTrip.status !== "submitted") {
    throw new AppError(
      "CONFLICT",
      `Only submitted trips can be decided (current status: '${verifiedTrip.status}')`,
      409
    );
  }

  if (
    input.expectedSubmittedAt &&
    verifiedTrip.submittedAt &&
    verifiedTrip.submittedAt !== input.expectedSubmittedAt
  ) {
    throw new AppError(
      "CONFLICT",
      "Stale submission state: this trip has been modified since you opened it",
      409
    );
  }

  const nowIso = (params.now ?? new Date()).toISOString();
  const note = input.note?.trim() || null;
  const metadata = allowlistedTripAuditMetadataSchema.parse({
    ...(input.metadata ?? {}),
    stop_count: existing?.stops.length ?? 0,
  });

  return params.tripsRepository.transitionTripStatusWithAudit({
    orgId: context.orgId,
    tripId: verifiedTrip.id,
    actorUserId: context.user.id,
    oldStatus: "submitted",
    newStatus: input.decision,
    eventType: DECISION_TO_AUDIT_EVENT[input.decision],
    expectedSubmittedAt: input.expectedSubmittedAt ?? verifiedTrip.submittedAt,
    decidedBy: context.user.id,
    decidedAt: nowIso,
    decisionNote: note,
    auditNote: note ?? `Trip marked as ${input.decision}`,
    metadata,
  });
}
