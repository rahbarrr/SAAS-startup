import "server-only";
import { AppError } from "@/lib/http/envelope";
import type { AuditRepository } from "@/modules/audit/repository";
import type { ReportingRepository } from "@/modules/reporting/repository";
import type { StoresRepository } from "@/modules/stores/repository";
import {
  assertTenantResourceOwnership,
  requireAnyOrgRole,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { TripsRepository } from "@/modules/trips/repository";
import type {
  AiProposedStopSequenceItem,
  AiTripPlanSummary,
  BriefingMetrics,
  BriefingWorkloadImbalance,
  ManagerDailyBriefing,
} from "./domain";
import { type AiIntelligenceProvider, ResilientAiIntelligenceProvider } from "./provider";
import { applyTripPlanRecommendationSchema, updateBriefingActionSchema } from "./schemas";
import { optimizeTripRoute } from "@/modules/routing/optimizer";
import { resolveRouteDistanceProvider } from "@/modules/routing/provider";
import type { RouteStopCandidate } from "@/modules/routing/domain";

export async function generateTripPlanAssistantForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
  storesRepository: StoresRepository;
  aiProvider?: AiIntelligenceProvider;
  auditRepository?: AuditRepository;
  now?: Date;
}): Promise<AiTripPlanSummary> {
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

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  const trip = detail.trip;

  // 1. Fetch stores
  const storeIds = detail.stops.map((s) => s.storeId);
  const stores = await params.storesRepository.getStoresByIds(context.orgId, storeIds);
  const storeMap = new Map(stores.map((st) => [st.id, st]));

  // 2. Fetch other trips assigned to this rep on the same dates to detect scheduling overlaps
  const allRepTripsResult = await params.tripsRepository.listTrips(context.orgId, {
    ownerUserId: trip.ownerUserId,
    limit: 50,
  });
  const overlappingTrips = allRepTripsResult.items.filter(
    (t) =>
      t.id !== trip.id &&
      t.status !== "rejected" &&
      t.startDate <= trip.endDate &&
      t.endDate >= trip.startDate
  );

  // 3. Run Route Optimization Heuristic on Stops
  const candidateStops = detail.stops.map((s) => {
    const store = storeMap.get(s.storeId);
    return {
      storeId: s.storeId,
      storeName: store?.name ?? `Store ${s.storeId.slice(0, 8)}`,
      city: store?.city ?? "Unknown",
      address: store?.addressLine1 ?? "Unknown address",
      latitude: store?.latitude ?? null,
      longitude: store?.longitude ?? null,
      plannedAt: s.plannedAt,
      sequenceNumber: s.sequenceNumber,
    };
  });

  const routeCandidates: RouteStopCandidate[] = detail.stops.map((s) => {
    const store = storeMap.get(s.storeId);
    return {
      id: s.id,
      storeId: s.storeId,
      storeName: store?.name ?? `Store ${s.storeId.slice(0, 8)}`,
      region: store?.region ?? "",
      city: store?.city ?? "Unknown",
      address: store?.addressLine1 ?? "Unknown address",
      coordinates:
        store?.latitude !== null &&
        store?.latitude !== undefined &&
        store?.longitude !== null &&
        store?.longitude !== undefined
          ? { latitude: store.latitude, longitude: store.longitude }
          : null,
      sequenceNumber: s.sequenceNumber,
      plannedWindow: s.plannedAt ? { start: s.plannedAt, end: s.plannedAt } : null,
    };
  });

  const distanceProvider = resolveRouteDistanceProvider();
  const optimizationProposal = await optimizeTripRoute({
    stops: routeCandidates,
    preserveFirstStop: true,
    distanceProvider,
    tripId: trip.id,
  });

  const isReordered =
    optimizationProposal.originalOrder.map((s) => s.storeId).join(",") !==
    optimizationProposal.proposedOrder.map((s) => s.storeId).join(",");

  const proposedSequenceItems: AiProposedStopSequenceItem[] =
    optimizationProposal.proposedOrder.map((ps) => {
      const match = candidateStops.find((c) => c.storeId === ps.storeId);
      const existingStop = detail.stops.find((s) => s.storeId === ps.storeId);
      return {
        stopId: existingStop?.id ?? ps.storeId,
        storeId: ps.storeId,
        storeName: ps.storeName,
        sequenceNumber: ps.sequenceNumber,
        city: match?.city ?? "",
        hasCoordinates: Boolean(ps.coordinates),
      };
    });

  const originalSequenceItems: AiProposedStopSequenceItem[] = detail.stops.map((s) => {
    const match = candidateStops.find((c) => c.storeId === s.storeId);
    return {
      stopId: s.id,
      storeId: s.storeId,
      storeName: match?.storeName ?? s.storeId,
      sequenceNumber: s.sequenceNumber,
      city: match?.city ?? "",
      hasCoordinates: Boolean(match?.latitude && match?.longitude),
    };
  });

  const provider = params.aiProvider ?? new ResilientAiIntelligenceProvider();

  const insights = await provider.generateTripPlanningInsights({
    tripId: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    assignedRepUserId: trip.ownerUserId,
    assignedRepName: `Rep ${trip.ownerUserId.slice(0, 6)}`,
    stops: candidateStops.map((c, idx) => ({
      stopId: detail.stops[idx]?.id ?? c.storeId,
      storeId: c.storeId,
      storeName: c.storeName,
      city: c.city,
      plannedAt: c.plannedAt,
      hasCoordinates: Boolean(c.latitude && c.longitude),
      sequenceNumber: c.sequenceNumber,
    })),
    otherRepTripsOnSameDates: overlappingTrips.map((ot) => ({
      tripId: ot.id,
      title: ot.title,
      startDate: ot.startDate,
      endDate: ot.endDate,
      stopsCount: 0,
    })),
    routeOptimization: {
      distanceSavingsMeters: optimizationProposal.distanceSavingsMeters,
      durationSavingsMinutes: Math.round(
        optimizationProposal.distanceSavingsMeters / 600
      ),
      isReordered,
      proposedOrder: proposedSequenceItems,
    },
  });

  const nowIso = (params.now ?? new Date()).toISOString();

  const summary: AiTripPlanSummary = {
    tripId: trip.id,
    title: trip.title,
    tripStatus: trip.status,
    assignedRepUserId: trip.ownerUserId,
    totalStops: detail.stops.length,
    conflicts: insights.conflicts,
    workloadSummary: {
      stopsCount: detail.stops.length,
      dailyStopThreshold: 8,
      estimatedDurationMinutes: optimizationProposal.estimatedTotalTransitMinutes,
      workloadStatus: insights.workloadStatus,
      note: insights.workloadNote,
    },
    suggestedSequence: {
      originalSequence: originalSequenceItems,
      proposedSequence: proposedSequenceItems,
      distanceSavingsMeters: optimizationProposal.distanceSavingsMeters,
      durationSavingsMinutes: Math.round(
        optimizationProposal.distanceSavingsMeters / 600
      ),
      isReordered,
      confidenceExplanation:
        optimizationProposal.distanceType === "road_network_driving"
          ? "Calculated using real road network turn-by-turn routing."
          : "Calculated using straight-line spherical geometry.",
    },
    missingDetails: insights.missingDetails,
    recommendations: insights.recommendations,
    evidenceExplanation: insights.evidenceExplanation,
    generatedAt: nowIso,
    modelUsed: provider.providerName,
    requiresHumanReview: true,
    aiDisclaimer:
      "AI trip suggestions are advisory drafts for human review. Route estimates reflect travel geography and do not account for dynamic traffic or store hours.",
  };

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "ai.trip_plan_recommended",
      entityType: "ai_trip_plan",
      entityId: trip.id,
      reason: "Manager requested AI trip planning analysis and route recommendation",
      metadata: {
        tripId: trip.id,
        stopsCount: detail.stops.length,
        conflictsCount: insights.conflicts.length,
        isReordered,
        distanceSavingsMeters: optimizationProposal.distanceSavingsMeters,
      },
    });
  }

  return summary;
}

export async function applyTripPlanRecommendationForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateTripId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  tripsRepository: TripsRepository;
  storesRepository: StoresRepository;
  auditRepository?: AuditRepository;
}) {
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

  assertTenantResourceOwnership({
    context,
    resource: detail.trip,
    requireOwnership: true,
    allowManagerOverride: true,
  });

  const parsed = applyTripPlanRecommendationSchema.parse(params.rawInput);

  if (detail.trip.status === "approved" && !parsed.confirmApprovedTripModification) {
    throw new AppError(
      "CONFLICT",
      "Trip is already approved. Applying itinerary changes requires explicit confirmation and resets the trip to draft for re-approval.",
      409
    );
  }

  const updatedTrip = await params.tripsRepository.updateTripDraftWithStops({
    orgId: context.orgId,
    tripId,
    actorUserId: context.user.id,
    previousStatus: detail.trip.status,
    previousDecidedBy: detail.trip.decidedBy,
    input: {
      title: detail.trip.title,
      purpose: detail.trip.purpose,
      startLocation: detail.trip.startLocation ?? "Not specified",
      destinationCity: detail.trip.destinationCity ?? "Not specified",
      startDate: detail.trip.startDate,
      endDate: detail.trip.endDate,
      stops: parsed.proposedStopOrder.map((s, idx) => ({
        storeId: s.storeId,
        sequenceNumber: idx + 1,
        plannedAt: s.plannedAt ?? null,
      })),
    },
  });

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "ai.trip_plan_applied",
      entityType: "ai_trip_plan",
      entityId: tripId,
      reason: "Manager reviewed and applied AI suggested stop sequence",
      changes: {
        stopsCount: {
          before: detail.stops.length,
          after: parsed.proposedStopOrder.length,
        },
      },
      metadata: {
        tripId,
        wasApproved: detail.trip.status === "approved",
      },
    });
  }

  return updatedTrip;
}

export async function getManagerDailyBriefingForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery?: unknown;
  tenancyRepository: TenancyRepository;
  reportingRepository: ReportingRepository;
  aiProvider?: AiIntelligenceProvider;
  auditRepository?: AuditRepository;
  now?: Date;
}): Promise<ManagerDailyBriefing> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  // Only Managers and Admins can view organizational operational intelligence briefings
  requireAnyOrgRole(context, ["admin", "manager"]);

  const now = params.now ?? new Date();
  const todayYmd = now.toISOString().slice(0, 10);
  const targetDate =
    typeof params.rawQuery === "object" &&
    params.rawQuery !== null &&
    "date" in params.rawQuery &&
    typeof (params.rawQuery as { date?: unknown }).date === "string"
      ? (params.rawQuery as { date: string }).date
      : todayYmd;

  const dataset = await params.reportingRepository.loadOrgOperationalDataset(
    context.orgId
  );

  // 1. Trips scheduled for today
  const tripsToday = dataset.trips.filter(
    (t) => t.status !== "rejected" && t.startDate <= targetDate && t.endDate >= targetDate
  );

  // 2. Stops for today
  const tripsTodayIds = new Set(tripsToday.map((t) => t.id));
  const stopsToday = dataset.tripStops.filter((s) => tripsTodayIds.has(s.tripId));

  // 3. Overdue visits
  const nowIso = now.toISOString();
  const overdueVisits = dataset.tripStops
    .filter((s) => s.status === "planned" && s.plannedAt && s.plannedAt < nowIso)
    .map((s) => {
      const store = dataset.stores.find((st) => st.id === s.storeId);
      const trip = dataset.trips.find((t) => t.id === s.tripId);
      return {
        id: s.id,
        storeName: store?.name ?? `Store ${s.storeId.slice(0, 6)}`,
        plannedAt: s.plannedAt,
        repName: `Rep ${trip?.ownerUserId.slice(0, 6) ?? "Unknown"}`,
      };
    });

  // 4. Pending approvals
  const pendingApprovals = dataset.trips
    .filter((t) => t.status === "submitted")
    .map((t) => ({
      id: t.id,
      title: t.title,
      ownerName: `Rep ${t.ownerUserId.slice(0, 6)}`,
      submittedAt: t.submittedAt,
    }));

  // 5. Missing evidence
  const missingEvidenceVisits = dataset.visits
    .filter((v) => {
      const evCount = dataset.evidence.filter((e) => e.visitId === v.id).length;
      return (v.status === "submitted" || v.status === "reviewed") && evCount === 0;
    })
    .map((v) => {
      const stop = dataset.tripStops.find((s) => s.id === v.tripStopId);
      const store = dataset.stores.find((st) => st.id === stop?.storeId);
      return {
        id: v.id,
        storeName: store?.name ?? "Store",
        repName: `Rep ${v.employeeUserId.slice(0, 6)}`,
      };
    });

  // 6. Unfinished checklists
  const unfinishedChecklistsCount = dataset.checklistItems.filter(
    (c) => !c.completedAt
  ).length;

  // 7. Workload Imbalances
  const repsMap = new Map<
    string,
    { assignedTrips: number; plannedStops: number; completedVisits: number }
  >();
  for (const t of dataset.trips.filter((tr) => tr.status !== "rejected")) {
    const existing = repsMap.get(t.ownerUserId) ?? {
      assignedTrips: 0,
      plannedStops: 0,
      completedVisits: 0,
    };
    existing.assignedTrips += 1;
    repsMap.set(t.ownerUserId, existing);
  }
  for (const s of dataset.tripStops) {
    const t = dataset.trips.find((tr) => tr.id === s.tripId);
    if (t) {
      const existing = repsMap.get(t.ownerUserId) ?? {
        assignedTrips: 0,
        plannedStops: 0,
        completedVisits: 0,
      };
      existing.plannedStops += 1;
      if (s.status === "visited") {
        existing.completedVisits += 1;
      }
      repsMap.set(t.ownerUserId, existing);
    }
  }

  const repWorkloads: BriefingWorkloadImbalance[] = Array.from(repsMap.entries()).map(
    ([repId, val]) => {
      const outstanding = Math.max(0, val.plannedStops - val.completedVisits);
      let status: "underutilized" | "balanced" | "overloaded" = "balanced";
      let note = "Normal operational balance.";
      if (outstanding > 12) {
        status = "overloaded";
        note = `Heavy workload: ${outstanding} pending store visits remain outstanding.`;
      } else if (val.assignedTrips === 0) {
        status = "underutilized";
        note = "No active work trips currently scheduled.";
      }
      return {
        repUserId: repId,
        repName: `Rep ${repId.slice(0, 6)}`,
        assignedTripsCount: val.assignedTrips,
        plannedStopsCount: val.plannedStops,
        completedVisitsCount: val.completedVisits,
        outstandingAssignments: outstanding,
        status,
        note,
      };
    }
  );

  const completedVisitsToday = dataset.visits.filter(
    (v) => v.checkedInAt && v.checkedInAt.slice(0, 10) === targetDate
  ).length;

  const metrics: BriefingMetrics = {
    tripsScheduledToday: tripsToday.length,
    visitsScheduledToday: stopsToday.length,
    completedVisitsCount: completedVisitsToday,
    overdueVisitsCount: overdueVisits.length,
    pendingApprovalsCount: pendingApprovals.length,
    missingEvidenceCount: missingEvidenceVisits.length,
    unfinishedChecklistsCount,
  };

  const hasSufficientData = dataset.trips.length > 0 || dataset.stores.length > 0;

  const provider = params.aiProvider ?? new ResilientAiIntelligenceProvider();

  const aiOutput = await provider.generateManagerDailyBriefing({
    briefingDate: targetDate,
    metrics,
    tripsToday: tripsToday.map((t) => ({
      id: t.id,
      title: t.title,
      ownerName: `Rep ${t.ownerUserId.slice(0, 6)}`,
      status: t.status,
      stopsCount: dataset.tripStops.filter((s) => s.tripId === t.id).length,
    })),
    overdueVisits,
    pendingApprovals,
    missingEvidenceVisits,
    repWorkloads,
    hasSufficientData,
  });

  const briefing: ManagerDailyBriefing = {
    orgId: context.orgId,
    briefingDate: targetDate,
    retrievedAt: nowIso,
    summaryHeadline: aiOutput.summaryHeadline,
    executiveSummary: aiOutput.executiveSummary,
    metrics,
    workloadImbalances: repWorkloads,
    criticalExceptions: aiOutput.criticalExceptions,
    recommendedActions: aiOutput.recommendedActions,
    dataCompleteness: {
      hasSufficientData,
      explanation: aiOutput.dataCompletenessExplanation,
    },
    modelUsed: provider.providerName,
    requiresHumanReview: true,
    aiDisclaimer:
      "Manager briefings synthesize verified FieldTrack operational database records. Suggested follow-ups are advisory.",
  };

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "ai.manager_briefing_generated",
      entityType: "ai_manager_briefing",
      entityId: context.orgId,
      reason: "Manager loaded daily AI operational briefing",
      metadata: {
        briefingDate: targetDate,
        hasSufficientData,
        overdueCount: overdueVisits.length,
        pendingApprovalsCount: pendingApprovals.length,
      },
    });
  }

  return briefing;
}

export async function updateBriefingActionForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  auditRepository?: AuditRepository;
}): Promise<{ actionId: string; status: "accepted" | "dismissed" }> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireAnyOrgRole(context, ["admin", "manager"]);

  const input = updateBriefingActionSchema.parse(params.rawInput);

  if (params.auditRepository) {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "ai.briefing_action_updated",
      entityType: "ai_manager_briefing",
      entityId: input.actionId,
      reason: input.note ?? `Manager marked recommendation as ${input.status}`,
      changes: {
        actionStatus: { after: input.status },
      },
      metadata: {
        actionId: input.actionId,
      },
    });
  }

  return {
    actionId: input.actionId,
    status: input.status,
  };
}
