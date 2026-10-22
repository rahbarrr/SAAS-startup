import "server-only";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
} from "@/lib/http/envelope";
import {
  assertTenantResourceOwnership,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import { tripIdParamSchema } from "@/modules/trips/schemas";
import { visitIdParamSchema } from "@/modules/visits/schemas";
import { buildManagerReportCsv } from "./csv";
import {
  DASHBOARD_METRIC_DEFINITIONS,
  type DashboardMetricsSummary,
  type PlannedVsActualStopRow,
  type TripPlannedVsActualDetail,
  type VisitPlannedVsActualDetail,
} from "./domain";
import type { OrgOperationalDataset, ReportingRepository } from "./repository";
import { type ManagerDashboardFilter, managerDashboardFilterSchema } from "./schemas";

const LOCATION_DISCLOSURE_TEXT =
  "Location is recorded only as a point-in-time check-in/check-out snapshot, never continuous live tracking. Device coordinates and accuracy are stored as unverified device-reported data, not verified proof of identity or location truth.";

export interface ManagerDashboardResult {
  metrics: DashboardMetricsSummary;
  items: PlannedVsActualStopRow[];
  pagination: CursorPaginationMeta;
}

export interface ManagerCsvExportResult {
  csv: string;
  rowCount: number;
  fileName: string;
}

function buildStopRowsForTrip(params: {
  tripId: string;
  dataset: OrgOperationalDataset;
  referenceDateUtc: string;
}): PlannedVsActualStopRow[] {
  const { dataset, referenceDateUtc } = params;
  const trip = dataset.trips.find((t) => t.id === params.tripId);
  if (!trip) return [];

  const storeMap = new Map(dataset.stores.map((s) => [s.id, s]));
  const stops = dataset.tripStops
    .filter((s) => s.orgId === trip.orgId && s.tripId === trip.id)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return stops.map((stop) => {
    const store = storeMap.get(stop.storeId);
    const visit =
      dataset.visits.find((v) => v.orgId === trip.orgId && v.tripStopId === stop.id) ??
      null;

    const visitChecklist = visit
      ? dataset.checklistItems.filter(
          (c) => c.orgId === trip.orgId && c.visitId === visit.id
        )
      : [];
    const requiredItems = visitChecklist.filter((c) => c.required);
    const requiredCompleted = requiredItems.filter((c) => c.completedAt !== null).length;
    const flaggedCount = visitChecklist.filter((c) => c.flagged).length;

    const visitEvidence = visit
      ? dataset.evidence.filter((e) => e.orgId === trip.orgId && e.visitId === visit.id)
      : [];

    const actualVisitStatus = visit ? visit.status : "not_started";
    const attentionReasons: string[] = [];

    if (trip.status === "changes_requested" || trip.status === "rejected") {
      attentionReasons.push(`Trip status is '${trip.status}'`);
    }

    if (
      (trip.status === "approved" || trip.status === "in_progress") &&
      trip.endDate < referenceDateUtc &&
      actualVisitStatus !== "submitted" &&
      actualVisitStatus !== "reviewed"
    ) {
      attentionReasons.push(
        `Overdue stop: trip end_date (${trip.endDate} UTC) passed without completed checkout`
      );
    }

    if (flaggedCount > 0) {
      attentionReasons.push(`${flaggedCount} checklist item(s) flagged by employee`);
    }

    if (visit && visit.checkInLocation.status !== "captured_unverified") {
      attentionReasons.push(`Check-in location status: ${visit.checkInLocation.status}`);
    }

    if (
      visit &&
      (visit.status === "submitted" || visit.status === "reviewed") &&
      visit.checkOutLocation.status !== "captured_unverified"
    ) {
      attentionReasons.push(
        `Check-out location status: ${visit.checkOutLocation.status}`
      );
    }

    return {
      tripId: trip.id,
      tripTitle: trip.title,
      tripStatus: trip.status,
      tripStartDate: trip.startDate,
      tripEndDate: trip.endDate,
      ownerUserId: trip.ownerUserId,
      tripStopId: stop.id,
      sequenceNumber: stop.sequenceNumber,
      storeId: stop.storeId,
      storeName: store?.name ?? "Unknown Store",
      storeRegion: store?.region ?? "Unknown Region",
      plannedAt: stop.plannedAt,
      plannedStopStatus: stop.status,
      actualVisitId: visit?.id ?? null,
      actualVisitStatus,
      checkedInAt: visit?.checkedInAt ?? null,
      checkedOutAt: visit?.checkedOutAt ?? null,
      checkInLocation: visit?.checkInLocation ?? null,
      checkOutLocation: visit?.checkOutLocation ?? null,
      requiredChecklistCompletedCount: requiredCompleted,
      requiredChecklistTotalCount: requiredItems.length,
      flaggedChecklistCount: flaggedCount,
      evidenceCount: visitEvidence.length,
      visitNotes: visit?.notes ?? "",
      requiresAttention: attentionReasons.length > 0,
      attentionReasons,
    };
  });
}

function evaluateFilteredDashboardDataset(params: {
  orgId: string;
  dataset: OrgOperationalDataset;
  filter: ManagerDashboardFilter;
  referenceDateUtc: string;
}): {
  metrics: DashboardMetricsSummary;
  matchingStopRows: PlannedVsActualStopRow[];
} {
  const { orgId, dataset, filter, referenceDateUtc } = params;

  // Defense-in-depth: strictly enforce orgId boundary on every entity collection
  const orgScopedDataset: OrgOperationalDataset = {
    stores: dataset.stores.filter((s) => s.orgId === orgId),
    trips: dataset.trips.filter((t) => t.orgId === orgId),
    tripStops: dataset.tripStops.filter((s) => s.orgId === orgId),
    visits: dataset.visits.filter((v) => v.orgId === orgId),
    checklistItems: dataset.checklistItems.filter((c) => c.orgId === orgId),
    evidence: dataset.evidence.filter((e) => e.orgId === orgId),
    auditEvents: dataset.auditEvents.filter((a) => a.orgId === orgId),
  };

  // Filter trips by date range, employee, tripStatus, and storeId
  const matchingTrips = orgScopedDataset.trips.filter((trip) => {
    if (filter.startDateFrom && trip.startDate < filter.startDateFrom) {
      return false;
    }
    if (filter.startDateTo && trip.startDate > filter.startDateTo) {
      return false;
    }
    if (filter.employeeUserId && trip.ownerUserId !== filter.employeeUserId) {
      return false;
    }
    if (filter.tripStatus && trip.status !== filter.tripStatus) {
      return false;
    }
    if (filter.storeId) {
      const hasStoreStop = orgScopedDataset.tripStops.some(
        (s) => s.tripId === trip.id && s.storeId === filter.storeId
      );
      if (!hasStoreStop) {
        return false;
      }
    }
    return true;
  });

  // Build stop rows across matching trips, then apply stop-level filters (storeId, visitStatus, onlyExceptions)
  const allStopRowsForMatchingTrips = matchingTrips.flatMap((trip) =>
    buildStopRowsForTrip({
      tripId: trip.id,
      dataset: orgScopedDataset,
      referenceDateUtc,
    })
  );

  const filteredStopRows = allStopRowsForMatchingTrips.filter((row) => {
    if (filter.storeId && row.storeId !== filter.storeId) {
      return false;
    }
    if (filter.visitStatus && row.actualVisitStatus !== filter.visitStatus) {
      return false;
    }
    if (filter.onlyExceptions && !row.requiresAttention) {
      return false;
    }
    return true;
  });

  // Sort deterministically by tripStartDate desc, sequenceNumber asc, tripStopId desc
  filteredStopRows.sort((a, b) => {
    const dateCmp = b.tripStartDate.localeCompare(a.tripStartDate);
    if (dateCmp !== 0) return dateCmp;
    if (a.sequenceNumber !== b.sequenceNumber) {
      return a.sequenceNumber - b.sequenceNumber;
    }
    return b.tripStopId.localeCompare(a.tripStopId);
  });

  // Compute documented metrics
  const tripsForMetrics = filter.onlyExceptions
    ? matchingTrips.filter((trip) => {
        const stopRows = allStopRowsForMatchingTrips.filter((r) => r.tripId === trip.id);
        return (
          trip.status === "changes_requested" ||
          trip.status === "rejected" ||
          stopRows.some((r) => r.requiresAttention)
        );
      })
    : matchingTrips;

  const tripsAwaitingApproval = tripsForMetrics.filter(
    (t) => t.status === "submitted"
  ).length;

  let approvedNotStarted = 0;
  let inProgress = 0;
  let completedAllStopsCheckedOut = 0;

  for (const trip of tripsForMetrics) {
    if (
      trip.status !== "approved" &&
      trip.status !== "in_progress" &&
      trip.status !== "completed"
    ) {
      continue;
    }

    const tripStopRows = allStopRowsForMatchingTrips.filter((r) => r.tripId === trip.id);
    const allStopsCheckedOut =
      tripStopRows.length > 0 &&
      tripStopRows.every(
        (r) => r.actualVisitStatus === "submitted" || r.actualVisitStatus === "reviewed"
      );

    if (trip.status === "completed" || allStopsCheckedOut) {
      completedAllStopsCheckedOut += 1;
    } else if (
      trip.status === "in_progress" ||
      tripStopRows.some((r) => r.actualVisitStatus !== "not_started")
    ) {
      inProgress += 1;
    } else {
      approvedNotStarted += 1;
    }
  }

  const approvedTrips = approvedNotStarted + inProgress + completedAllStopsCheckedOut;

  const completedVisits = filteredStopRows.filter(
    (r) => r.actualVisitStatus === "submitted" || r.actualVisitStatus === "reviewed"
  ).length;

  const pendingVisits = filteredStopRows.filter(
    (r) =>
      (r.tripStatus === "approved" || r.tripStatus === "in_progress") &&
      (r.actualVisitStatus === "not_started" || r.actualVisitStatus === "in_progress")
  ).length;

  // Exceptions requiring attention: count of stop rows with `requiresAttention` PLUS matching trips with no stops that are in `changes_requested` or `rejected`
  const exceptionStopCount = filteredStopRows.filter((r) => r.requiresAttention).length;
  const zeroStopExceptionTrips = tripsForMetrics.filter(
    (t) =>
      (t.status === "changes_requested" || t.status === "rejected") &&
      !allStopRowsForMatchingTrips.some((r) => r.tripId === t.id)
  ).length;

  const exceptionsRequiringAttention = exceptionStopCount + zeroStopExceptionTrips;

  return {
    metrics: {
      tripsAwaitingApproval,
      approvedTrips,
      approvedTripsBreakdown: {
        approvedNotStarted,
        inProgress,
        completedAllStopsCheckedOut,
      },
      completedVisits,
      pendingVisits,
      exceptionsRequiringAttention,
      definitions: DASHBOARD_METRIC_DEFINITIONS,
      timezoneBoundaryNote:
        "All date boundaries (startDateFrom, startDateTo, trip start_date/end_date) are evaluated as ISO-8601 calendar dates in UTC (YYYY-MM-DD), and all check-in/check-out timestamps are recorded in UTC.",
      referenceDateUtc,
    },
    matchingStopRows: filteredStopRows,
  };
}

export async function getManagerDashboardForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  reportingRepository: ReportingRepository;
  now?: Date;
}): Promise<ManagerDashboardResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:review");

  const filter = managerDashboardFilterSchema.parse(params.rawQuery ?? {});
  const dataset = await params.reportingRepository.loadOrgOperationalDataset(
    context.orgId
  );
  const referenceDateUtc = (params.now ?? new Date()).toISOString().slice(0, 10);

  const { metrics, matchingStopRows } = evaluateFilteredDashboardDataset({
    orgId: context.orgId,
    dataset,
    filter,
    referenceDateUtc,
  });

  let rowsAfterCursor = matchingStopRows;
  if (filter.cursor) {
    const decoded = decodeCursor(filter.cursor);
    const cursorDate = decoded.createdAt.slice(0, 10);
    rowsAfterCursor = matchingStopRows.filter(
      (r) =>
        r.tripStartDate < cursorDate ||
        (r.tripStartDate === cursorDate && r.tripStopId < decoded.id)
    );
  }

  const pageSize = filter.limit;
  const hasMore = rowsAfterCursor.length > pageSize;
  const items = hasMore ? rowsAfterCursor.slice(0, pageSize) : rowsAfterCursor;
  const last = items[items.length - 1];

  return {
    metrics,
    items,
    pagination: {
      hasMore,
      limit: pageSize,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: `${last.tripStartDate}T00:00:00.000Z`,
              id: last.tripStopId,
            })
          : null,
    },
  };
}

export async function exportManagerReportCsvForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  reportingRepository: ReportingRepository;
  now?: Date;
}): Promise<ManagerCsvExportResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:review");

  const filter = managerDashboardFilterSchema.parse(params.rawQuery ?? {});
  const dataset = await params.reportingRepository.loadOrgOperationalDataset(
    context.orgId
  );
  const referenceDateUtc = (params.now ?? new Date()).toISOString().slice(0, 10);

  const { matchingStopRows } = evaluateFilteredDashboardDataset({
    orgId: context.orgId,
    dataset,
    filter,
    referenceDateUtc,
  });

  let rowsAfterCursor = matchingStopRows;
  if (filter.cursor) {
    const decoded = decodeCursor(filter.cursor);
    const cursorDate = decoded.createdAt.slice(0, 10);
    rowsAfterCursor = matchingStopRows.filter(
      (r) =>
        r.tripStartDate < cursorDate ||
        (r.tripStartDate === cursorDate && r.tripStopId < decoded.id)
    );
  }

  const exportRows = rowsAfterCursor.slice(0, filter.limit);
  const csv = buildManagerReportCsv(exportRows);

  return {
    csv,
    rowCount: exportRows.length,
    fileName: `fieldtrack-report-${context.orgId.slice(0, 8)}-${referenceDateUtc}.csv`,
  };
}

export async function getTripPlannedVsActualForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  tenancyRepository: TenancyRepository;
  reportingRepository: ReportingRepository;
  now?: Date;
}): Promise<TripPlannedVsActualDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  const { tripId } = tripIdParamSchema.parse({
    tripId: params.candidateTripId,
  });
  const dataset = await params.reportingRepository.loadOrgOperationalDataset(
    context.orgId
  );

  const trip = dataset.trips.find((t) => t.orgId === context.orgId && t.id === tripId);

  assertTenantResourceOwnership({
    context,
    resource: trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!trip) {
    throw new AppError(
      "NOT_FOUND",
      "The requested trip was not found in your active organization",
      404
    );
  }

  const referenceDateUtc = (params.now ?? new Date()).toISOString().slice(0, 10);
  const stops = buildStopRowsForTrip({
    tripId: trip.id,
    dataset,
    referenceDateUtc,
  });

  const completedStopCount = stops.filter(
    (s) => s.actualVisitStatus === "submitted" || s.actualVisitStatus === "reviewed"
  ).length;
  const totalStopCount = stops.length;
  const isCompleteAllStopsCheckedOut =
    totalStopCount > 0 && completedStopCount === totalStopCount;

  const auditEvents = dataset.auditEvents.filter(
    (e) => e.orgId === context.orgId && e.tripId === trip.id
  );

  return {
    trip,
    isCompleteAllStopsCheckedOut,
    completedStopCount,
    totalStopCount,
    stops,
    auditEvents,
    locationDisclosure: LOCATION_DISCLOSURE_TEXT,
  };
}

export async function getVisitPlannedVsActualForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateVisitId: unknown;
  tenancyRepository: TenancyRepository;
  reportingRepository: ReportingRepository;
  now?: Date;
}): Promise<VisitPlannedVsActualDetail> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "visits:record_own");

  const { visitId } = visitIdParamSchema.parse({
    visitId: params.candidateVisitId,
  });
  const dataset = await params.reportingRepository.loadOrgOperationalDataset(
    context.orgId
  );

  const visit = dataset.visits.find((v) => v.orgId === context.orgId && v.id === visitId);

  assertTenantResourceOwnership({
    context,
    resource: visit
      ? {
          id: visit.id,
          orgId: visit.orgId,
          ownerUserId: visit.employeeUserId,
        }
      : null,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  if (!visit) {
    throw new AppError(
      "NOT_FOUND",
      "The requested visit was not found in your active organization",
      404
    );
  }

  const stop = dataset.tripStops.find(
    (s) => s.orgId === context.orgId && s.id === visit.tripStopId
  );
  const trip = stop
    ? dataset.trips.find((t) => t.orgId === context.orgId && t.id === stop.tripId)
    : undefined;

  if (!stop || !trip) {
    throw new AppError(
      "NOT_FOUND",
      "Parent trip or stop for this visit was not found in your active organization",
      404
    );
  }

  const store =
    dataset.stores.find((s) => s.orgId === context.orgId && s.id === stop.storeId) ??
    null;

  const checklistItems = dataset.checklistItems.filter(
    (c) => c.orgId === context.orgId && c.visitId === visit.id
  );
  const evidence = dataset.evidence.filter(
    (e) => e.orgId === context.orgId && e.visitId === visit.id
  );

  const requiredItems = checklistItems.filter((c) => c.required);
  const requiredChecklistCompletedCount = requiredItems.filter(
    (c) => c.completedAt !== null
  ).length;
  const requiredChecklistTotalCount = requiredItems.length;
  const flaggedChecklistCount = checklistItems.filter((c) => c.flagged).length;

  const attentionReasons: string[] = [];
  if (flaggedChecklistCount > 0) {
    attentionReasons.push(
      `${flaggedChecklistCount} checklist item(s) flagged by employee`
    );
  }
  if (visit.checkInLocation.status !== "captured_unverified") {
    attentionReasons.push(`Check-in location status: ${visit.checkInLocation.status}`);
  }
  if (
    (visit.status === "submitted" || visit.status === "reviewed") &&
    visit.checkOutLocation.status !== "captured_unverified"
  ) {
    attentionReasons.push(`Check-out location status: ${visit.checkOutLocation.status}`);
  }

  return {
    visit,
    trip,
    stop,
    store,
    checklistItems,
    evidence,
    requiredChecklistCompletedCount,
    requiredChecklistTotalCount,
    flaggedChecklistCount,
    requiresAttention: attentionReasons.length > 0,
    attentionReasons,
    locationDisclosure: LOCATION_DISCLOSURE_TEXT,
  };
}
