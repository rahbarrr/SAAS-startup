import { describe, expect, it, vi } from "vitest";
import {
  applyOptimizedRouteToTrip,
  generateRouteOptimizationProposalForTrip,
} from "@/modules/routing/service";
import { getSignedEvidenceDownloadUrlForOrg } from "@/modules/visits/service";
import {
  generateTripPlanAssistantForOrg,
  getManagerDailyBriefingForOrg,
} from "@/modules/ai-intelligence/service";
import {
  getVisitAiReportDraftsStateForOrg,
  reviewVisitAiReportDraftForOrg,
} from "@/modules/ai-reports/service";
import {
  createBrowserSyncExecutor,
  enqueueOfflineOperation,
  loadOfflineQueue,
  syncAllBrowserOfflineQueues,
} from "@/lib/offline/sync-queue";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { TripsRepository } from "@/modules/trips/repository";
import type { StoresRepository } from "@/modules/stores/repository";
import type { VisitsRepository } from "@/modules/visits/repository";
import type { ReportingRepository } from "@/modules/reporting/repository";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const MANAGER_A_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_REP_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_TEAM_REP_ID = "44444444-4444-4444-8444-444444444444";
const TRIP_ID = "55555555-5555-4555-8555-555555555555";
const VISIT_ID = "66666666-6666-4666-8666-666666666666";
const EVIDENCE_ID = "77777777-7777-4777-8777-777777777777";
const STORE_1_ID = "88888888-8888-4888-8888-888888888881";
const STORE_2_ID = "88888888-8888-4888-8888-888888888882";

const MANAGER_B_ID = "99999999-9999-4999-8999-999999999999";

function buildManagerTenancyRepo(assignedTeamMemberIds: string[]): TenancyRepository {
  return {
    getMembershipByUserAndOrg: vi
      .fn()
      .mockImplementation(async (targetUserId: string) => {
        if (targetUserId === MANAGER_A_ID) {
          return {
            id: "mem-mgr",
            orgId: ORG_ID,
            userId: MANAGER_A_ID,
            role: "manager",
            status: "active",
            managerUserId: null,
            createdAt: "2026-01-01T00:00:00Z",
          };
        }
        return {
          id: `mem-${targetUserId}`,
          orgId: ORG_ID,
          userId: targetUserId,
          role: "field_employee",
          status: "active",
          managerUserId: assignedTeamMemberIds.includes(targetUserId)
            ? MANAGER_A_ID
            : MANAGER_B_ID,
          createdAt: "2026-01-01T00:00:00Z",
        };
      }),
  } as unknown as TenancyRepository;
}

function buildEmployeeTenancyRepo(userId: string): TenancyRepository {
  return {
    getMembershipByUserAndOrg: vi
      .fn()
      .mockImplementation(async (targetUserId: string) => {
        if (targetUserId === userId) {
          return {
            id: "mem-rep",
            orgId: ORG_ID,
            userId,
            role: "field_employee",
            status: "active",
            managerUserId: MANAGER_A_ID,
            createdAt: "2026-01-01T00:00:00Z",
          };
        }
        return null;
      }),
  } as unknown as TenancyRepository;
}

describe("QA Audit Regressions — Route Optimization & Trip Persistence", () => {
  it("applyOptimizedRouteToTrip populates sequenceNumber and preserves startLocation and destinationCity", async () => {
    const tenancyRepository = buildEmployeeTenancyRepo(TEAM_REP_ID);

    const updateTripDraftWithStops = vi.fn().mockResolvedValue({
      trip: {
        id: TRIP_ID,
        orgId: ORG_ID,
        ownerUserId: TEAM_REP_ID,
        title: "Mumbai Retail Audit",
        startLocation: "Andheri East Hub",
        destinationCity: "Mumbai",
        startDate: "2026-05-01",
        endDate: "2026-05-02",
        status: "draft",
        purpose: "Monthly store merchandising verification",
        submittedAt: null,
        decidedAt: null,
        decidedBy: null,
        decisionNote: null,
        createdAt: "2026-04-20T00:00:00Z",
        updatedAt: "2026-04-20T00:00:00Z",
      },
      stops: [],
    });

    const tripsRepository = {
      getTripDetail: vi.fn().mockResolvedValue({
        trip: {
          id: TRIP_ID,
          orgId: ORG_ID,
          ownerUserId: TEAM_REP_ID,
          title: "Mumbai Retail Audit",
          startLocation: "Andheri East Hub",
          destinationCity: "Mumbai",
          startDate: "2026-05-01",
          endDate: "2026-05-02",
          status: "draft",
          purpose: "Monthly store merchandising verification",
          submittedAt: null,
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          createdAt: "2026-04-20T00:00:00Z",
          updatedAt: "2026-04-20T00:00:00Z",
        },
        stops: [
          {
            id: "stop-1",
            orgId: ORG_ID,
            tripId: TRIP_ID,
            storeId: STORE_1_ID,
            sequenceNumber: 1,
            plannedAt: null,
            status: "planned",
          },
          {
            id: "stop-2",
            orgId: ORG_ID,
            tripId: TRIP_ID,
            storeId: STORE_2_ID,
            sequenceNumber: 2,
            plannedAt: null,
            status: "planned",
          },
        ],
      }),
      updateTripDraftWithStops,
    } as unknown as TripsRepository;

    const storesRepository = {
      getStoresByIds: vi.fn().mockResolvedValue([
        {
          id: STORE_1_ID,
          orgId: ORG_ID,
          name: "Store One",
          city: "Mumbai",
          region: "MH",
          active: true,
        },
        {
          id: STORE_2_ID,
          orgId: ORG_ID,
          name: "Store Two",
          city: "Mumbai",
          region: "MH",
          active: true,
        },
      ]),
    } as unknown as StoresRepository;

    const updated = await applyOptimizedRouteToTrip({
      user: { id: TEAM_REP_ID, email: "rep@example.com" },
      candidateOrgId: ORG_ID,
      candidateTripId: TRIP_ID,
      proposedStopOrder: [
        { storeId: STORE_2_ID, plannedAt: "2026-05-01T10:00:00.000Z" },
        { storeId: STORE_1_ID, plannedAt: "2026-05-01T12:00:00.000Z" },
      ],
      tenancyRepository,
      tripsRepository,
      storesRepository,
    });

    expect(updated.trip.id).toBe(TRIP_ID);
    expect(updateTripDraftWithStops).toHaveBeenCalledTimes(1);
    const callArg = updateTripDraftWithStops.mock.calls[0]?.[0];
    expect(callArg.input.startLocation).toBe("Andheri East Hub");
    expect(callArg.input.destinationCity).toBe("Mumbai");
    expect(callArg.input.stops).toEqual([
      {
        storeId: STORE_2_ID,
        sequenceNumber: 1,
        plannedAt: "2026-05-01T10:00:00.000Z",
      },
      {
        storeId: STORE_1_ID,
        sequenceNumber: 2,
        plannedAt: "2026-05-01T12:00:00.000Z",
      },
    ]);
  });
});

describe("QA Audit Regressions — Manager Team Scope Enforcement", () => {
  it("blocks manager from generating signed evidence download URL for an unassigned employee visit", async () => {
    const tenancyRepository = buildManagerTenancyRepo([TEAM_REP_ID]);
    const visitsRepository = {
      getVisitDetail: vi.fn().mockResolvedValue({
        visit: {
          id: VISIT_ID,
          orgId: ORG_ID,
          tripStopId: "stop-1",
          employeeUserId: OTHER_TEAM_REP_ID,
          status: "submitted",
        },
        checklistItems: [],
        evidence: [
          {
            id: EVIDENCE_ID,
            orgId: ORG_ID,
            visitId: VISIT_ID,
            fileType: "image/jpeg",
            fileSize: 1024,
            caption: "Shelf photo",
          },
        ],
      }),
      createSignedEvidenceDownloadUrl: vi.fn(),
    } as unknown as VisitsRepository;

    await expect(
      getSignedEvidenceDownloadUrlForOrg({
        user: { id: MANAGER_A_ID, email: "mgr@example.com" },
        candidateOrgId: ORG_ID,
        candidateVisitId: VISIT_ID,
        candidateEvidenceId: EVIDENCE_ID,
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });
  });

  it("blocks manager from optimizing or running AI trip assistant on an unassigned employee trip", async () => {
    const tenancyRepository = buildManagerTenancyRepo([TEAM_REP_ID]);
    const tripsRepository = {
      getTripDetail: vi.fn().mockResolvedValue({
        trip: {
          id: TRIP_ID,
          orgId: ORG_ID,
          ownerUserId: OTHER_TEAM_REP_ID,
          title: "Unassigned Rep Trip",
          startDate: "2026-05-01",
          endDate: "2026-05-02",
          status: "submitted",
          purpose: "Store check",
        },
        stops: [],
      }),
    } as unknown as TripsRepository;
    const storesRepository = {
      getStoresByIds: vi.fn().mockResolvedValue([]),
    } as unknown as StoresRepository;

    await expect(
      generateRouteOptimizationProposalForTrip({
        user: { id: MANAGER_A_ID, email: "mgr@example.com" },
        candidateOrgId: ORG_ID,
        candidateTripId: TRIP_ID,
        tenancyRepository,
        tripsRepository,
        storesRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      generateTripPlanAssistantForOrg({
        user: { id: MANAGER_A_ID, email: "mgr@example.com" },
        candidateOrgId: ORG_ID,
        candidateTripId: TRIP_ID,
        tenancyRepository,
        tripsRepository,
        storesRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });
  });

  it("scopes getManagerDailyBriefingForOrg metrics strictly to the manager's assigned team", async () => {
    const tenancyRepository = buildManagerTenancyRepo([TEAM_REP_ID]);
    const reportingRepository = {
      loadOrgOperationalDataset: vi.fn().mockResolvedValue({
        stores: [{ id: STORE_1_ID, name: "Mumbai Store", active: true }],
        trips: [
          {
            id: "trip-team",
            orgId: ORG_ID,
            ownerUserId: TEAM_REP_ID,
            title: "Team Rep Trip",
            startDate: "2026-05-01",
            endDate: "2026-05-01",
            status: "submitted",
            submittedAt: "2026-04-30T10:00:00Z",
          },
          {
            id: "trip-other",
            orgId: ORG_ID,
            ownerUserId: OTHER_TEAM_REP_ID,
            title: "Other Team Rep Trip",
            startDate: "2026-05-01",
            endDate: "2026-05-01",
            status: "submitted",
            submittedAt: "2026-04-30T11:00:00Z",
          },
        ],
        tripStops: [
          {
            id: "stop-team",
            tripId: "trip-team",
            storeId: STORE_1_ID,
            status: "planned",
            plannedAt: null,
          },
          {
            id: "stop-other",
            tripId: "trip-other",
            storeId: STORE_1_ID,
            status: "planned",
            plannedAt: null,
          },
        ],
        visits: [],
        checklistItems: [],
        evidence: [],
      }),
    } as unknown as ReportingRepository;

    const briefing = await getManagerDailyBriefingForOrg({
      user: { id: MANAGER_A_ID, email: "mgr@example.com" },
      candidateOrgId: ORG_ID,
      rawQuery: { date: "2026-05-01" },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-05-01T08:00:00Z"),
    });

    expect(briefing.metrics.tripsScheduledToday).toBe(1);
    expect(briefing.metrics.visitsScheduledToday).toBe(1);
    expect(briefing.metrics.pendingApprovalsCount).toBe(1);
    expect(briefing.workloadImbalances.map((w) => w.repUserId)).toEqual([TEAM_REP_ID]);
  });

  it("blocks manager from accessing or reviewing AI visit report drafts for an unassigned employee", async () => {
    const tenancyRepository = buildManagerTenancyRepo([TEAM_REP_ID]);
    const visitsRepository = {
      getVisitDetail: vi.fn().mockResolvedValue({
        visit: {
          id: VISIT_ID,
          orgId: ORG_ID,
          tripStopId: "stop-1",
          employeeUserId: OTHER_TEAM_REP_ID,
          status: "submitted",
          notes: "Completed audit",
          checkedInAt: "2026-05-01T09:00:00Z",
        },
        checklistItems: [],
        evidence: [],
      }),
    } as unknown as VisitsRepository;

    await expect(
      getVisitAiReportDraftsStateForOrg({
        user: { id: MANAGER_A_ID, email: "mgr@example.com" },
        candidateOrgId: ORG_ID,
        candidateVisitId: VISIT_ID,
        tenancyRepository,
        visitsRepository,
        aiReportsRepository: {} as never,
        aiProvider: {} as never,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      reviewVisitAiReportDraftForOrg({
        user: { id: MANAGER_A_ID, email: "mgr@example.com" },
        candidateOrgId: ORG_ID,
        candidateVisitId: VISIT_ID,
        rawInput: {
          draftId: "77777777-7777-4777-8777-777777777777",
          reviewStatus: "approved",
          summary: "Valid summary of at least ten characters",
          completedActions: [],
          issues: [],
          followUps: [],
          uncertaintyNotes: [],
        },
        tenancyRepository,
        visitsRepository,
        aiReportsRepository: {} as never,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });
  });
});

describe("QA Audit Regressions — Browser Offline Sync Executor & Mobile API", () => {
  it("executes queued browser offline operations and purges synced items via syncAllBrowserOfflineQueues", async () => {
    const storeMap = new Map<string, string>();
    const mockStorage = {
      get length() {
        return storeMap.size;
      },
      key(index: number) {
        return Array.from(storeMap.keys())[index] ?? null;
      },
      getItem(k: string) {
        return storeMap.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        storeMap.set(k, v);
      },
      removeItem(k: string) {
        storeMap.delete(k);
      },
    };

    enqueueOfflineOperation({
      input: {
        orgId: ORG_ID,
        userId: TEAM_REP_ID,
        targetId: VISIT_ID,
        operationType: "save_checklist",
        payload: { notes: "Synced from offline queue", checklistItems: [] },
      },
      storage: mockStorage,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: VISIT_ID } }),
    });

    const result = await syncAllBrowserOfflineQueues({
      storage: mockStorage,
      executor: createBrowserSyncExecutor(mockFetch as unknown as typeof fetch),
    });

    expect(result.totalProcessed).toBe(1);
    expect(result.syncedCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe(`/api/orgs/${ORG_ID}/visits/${VISIT_ID}`);
    expect(
      loadOfflineQueue({ orgId: ORG_ID, userId: TEAM_REP_ID, storage: mockStorage })
    ).toHaveLength(0);
  });
});
