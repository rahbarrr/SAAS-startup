import { describe, expect, it, vi } from "vitest";
import type {
  InsertAuditEventInput,
  OrganizationAuditEvent,
} from "@/modules/audit/domain";
import type { AuditRepository } from "@/modules/audit/repository";
import type { OrgOperationalDataset, ReportingRepository } from "@/modules/reporting/repository";
import type { Store } from "@/modules/stores/domain";
import type { StoresRepository, PaginatedStoresResult } from "@/modules/stores/repository";
import type {
  AuthenticatedUser,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type {
  TripStatus,
  TripStop,
} from "@/modules/trips/domain";
import type {
  ListTripsRepositoryFilter,
  PaginatedTripsResult,
  TripsRepository,
} from "@/modules/trips/repository";
import {
  HeuristicIntelligenceProvider,
  ResilientAiIntelligenceProvider,
  type AiIntelligenceProvider,
  type OpenAiIntelligenceProvider,
} from "../provider";
import {
  applyTripPlanRecommendationForOrg,
  generateTripPlanAssistantForOrg,
  getManagerDailyBriefingForOrg,
  updateBriefingActionForOrg,
} from "../service";

// --- Mock Implementations ---

class MockAuditRepo implements AuditRepository {
  public events: OrganizationAuditEvent[] = [];

  async insertAuditEvent(
    input: InsertAuditEventInput
  ): Promise<OrganizationAuditEvent> {
    const event: OrganizationAuditEvent = {
      id: `audit-${this.events.length + 1}`,
      orgId: input.orgId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId: input.correlationId ?? null,
      reason: input.reason ?? null,
      changes: (input.changes ?? {}) as Record<string, unknown>,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async listAuditEvents(): Promise<never> {
    throw new Error("Not implemented");
  }

  async streamAuditEventsForExport(): Promise<never> {
    throw new Error("Not implemented");
  }
}

class MockTenancyRepo implements TenancyRepository {
  public memberships: OrganizationMembership[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return (
      this.memberships.find(
        (m) => m.orgId === orgId && m.userId === userId && m.status === "active"
      ) ?? null
    );
  }

  async listUserOrganizations(_userId: string): Promise<UserOrganizationSummary[]> {
    return [];
  }

  async createOrganizationWithOwner(): Promise<never> { throw new Error("Not implemented"); }
  async listOrgMembers(): Promise<never> { throw new Error("Not implemented"); }
  async addOrgMember(): Promise<never> { throw new Error("Not implemented"); }
  async createOrgInvitation(): Promise<never> { throw new Error("Not implemented"); }
  async acceptOrgInvitation(): Promise<never> { throw new Error("Not implemented"); }
  async acceptOrgInvitationByTokenHash(): Promise<never> { throw new Error("Not implemented"); }
  async updateMemberRole(): Promise<never> { throw new Error("Not implemented"); }
  async deactivateMember(): Promise<never> { throw new Error("Not implemented"); }
  async assignManager(): Promise<never> { throw new Error("Not implemented"); }
}

class MockStoresRepo implements StoresRepository {
  public stores: Store[] = [];

  async getStoreById(orgId: string, storeId: string): Promise<Store | null> {
    return this.stores.find((s) => s.orgId === orgId && s.id === storeId) ?? null;
  }

  async getStoresByIds(orgId: string, storeIds: readonly string[]): Promise<Store[]> {
    return this.stores.filter((s) => s.orgId === orgId && storeIds.includes(s.id));
  }

  async listStores(
    orgId: string,
    _query: unknown
  ): Promise<PaginatedStoresResult> {
    const items = this.stores.filter((s) => s.orgId === orgId);
    return {
      items,
      pagination: {
        nextCursor: null,
        limit: items.length,
        hasMore: false,
      },
    };
  }

  async createStore(): Promise<never> { throw new Error("Not implemented"); }
  async updateStore(): Promise<never> { throw new Error("Not implemented"); }
}

interface MockTripDetailHolder {
  trip: {
    id: string;
    orgId: string;
    ownerUserId: string;
    title: string;
    purpose: string;
    startDate: string;
    endDate: string;
    status: TripStatus;
    submittedAt: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    decisionNote: string | null;
    createdAt: string;
    updatedAt: string;
  };
  stops: TripStop[];
  auditEvents: never[];
}

class MockTripsRepo implements TripsRepository {
  public trips: MockTripDetailHolder[] = [];

  async getTripDetail(orgId: string, tripId: string): Promise<MockTripDetailHolder | null> {
    return (
      this.trips.find((t) => t.trip.orgId === orgId && t.trip.id === tripId) ?? null
    );
  }

  async listTrips(
    orgId: string,
    _filter: ListTripsRepositoryFilter
  ): Promise<PaginatedTripsResult> {
    const items = this.trips
      .filter((t) => t.trip.orgId === orgId)
      .map((t) => t.trip);
    return {
      items,
      pagination: {
        nextCursor: null,
        limit: items.length,
        hasMore: false,
      },
    };
  }

  async updateTripDraftWithStops(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    previousStatus: TripStatus;
    previousDecidedBy: string | null;
    input: {
      title: string;
      purpose: string;
      startDate: string;
      endDate: string;
      stops: readonly { storeId: string; sequenceNumber: number; plannedAt?: string | null }[];
    };
  }): Promise<MockTripDetailHolder> {
    const found = this.trips.find(
      (t) => t.trip.orgId === params.orgId && t.trip.id === params.tripId
    );
    if (!found) throw new Error("Trip not found");

    const nextStatus: TripStatus =
      params.previousStatus === "approved" ? "draft" : params.previousStatus;

    found.trip.title = params.input.title;
    found.trip.purpose = params.input.purpose;
    found.trip.startDate = params.input.startDate;
    found.trip.endDate = params.input.endDate;
    found.trip.status = nextStatus;

    found.stops = params.input.stops.map((s, idx) => ({
      id: `stop-${idx + 1}`,
      orgId: params.orgId,
      tripId: params.tripId,
      storeId: s.storeId,
      sequenceNumber: s.sequenceNumber,
      plannedAt: s.plannedAt ?? null,
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return found;
  }

  async createTripDraftWithStops(): Promise<never> {
    throw new Error("Not implemented");
  }

  async transitionTripStatusWithAudit(): Promise<never> {
    throw new Error("Not implemented");
  }
}

class MockReportingRepo implements ReportingRepository {
  public dataset: OrgOperationalDataset = {
    stores: [],
    trips: [],
    tripStops: [],
    visits: [],
    checklistItems: [],
    evidence: [],
    auditEvents: [],
  };

  async loadOrgOperationalDataset(_orgId: string): Promise<OrgOperationalDataset> {
    return this.dataset;
  }
}

describe("Phase 8: AI-Powered Field Intelligence", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const managerUser: AuthenticatedUser = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "manager@example.com",
  };
  const repUser: AuthenticatedUser = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "rep@example.com",
  };

  describe("HeuristicIntelligenceProvider", () => {
    const provider = new HeuristicIntelligenceProvider();

    it("generates structured trip planning insights from verified operational parameters", async () => {
      const result = await provider.generateTripPlanningInsights({
        tripId: "44444444-4444-4444-8444-444444444441",
        title: "Midtown Circuit",
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        assignedRepUserId: repUser.id,
        assignedRepName: "Bob Representative",
        stops: [
          {
            stopId: "stop-1",
            storeId: "store-1",
            storeName: "Central Store",
            city: "New York",
            plannedAt: "2026-11-01T09:00:00Z",
            hasCoordinates: true,
            sequenceNumber: 1,
          },
          {
            stopId: "stop-2",
            storeId: "store-2",
            storeName: "Remote Store",
            city: "New York",
            plannedAt: null, // missing scheduled time
            hasCoordinates: false, // missing coordinates
            sequenceNumber: 2,
          },
        ],
        otherRepTripsOnSameDates: [],
        routeOptimization: {
          distanceSavingsMeters: 1400,
          durationSavingsMinutes: 12,
          isReordered: true,
          proposedOrder: [
            {
              sequenceNumber: 1,
              stopId: "stop-2",
              storeId: "store-2",
              storeName: "Remote Store",
              city: "New York",
              hasCoordinates: false,
            },
            {
              sequenceNumber: 2,
              stopId: "stop-1",
              storeId: "store-1",
              storeName: "Central Store",
              city: "New York",
              hasCoordinates: true,
            },
          ],
        },
      });

      expect(result.missingDetails.some((d) => d.stopId === "stop-2")).toBe(true);
      expect(result.conflicts.some((c) => c.type === "missing_time")).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.evidenceExplanation).toContain("Midtown Circuit");
    });

    it("flags scheduling conflicts when representative has overlapping trips on same dates", async () => {
      const result = await provider.generateTripPlanningInsights({
        tripId: "44444444-4444-4444-8444-444444444442",
        title: "Trip A",
        startDate: "2026-11-05",
        endDate: "2026-11-06",
        assignedRepUserId: repUser.id,
        assignedRepName: "Bob Rep",
        stops: [
          {
            stopId: "s-1",
            storeId: "st-1",
            storeName: "Store 1",
            city: "Boston",
            plannedAt: "2026-11-05T10:00:00Z",
            hasCoordinates: true,
            sequenceNumber: 1,
          },
        ],
        otherRepTripsOnSameDates: [
          {
            tripId: "44444444-4444-4444-8444-444444444443",
            title: "Trip Overlap",
            startDate: "2026-11-05",
            endDate: "2026-11-07",
            stopsCount: 3,
          },
        ],
        routeOptimization: {
          distanceSavingsMeters: 0,
          durationSavingsMinutes: 0,
          isReordered: false,
          proposedOrder: [],
        },
      });

      expect(result.conflicts.some((c) => c.type === "overlap")).toBe(true);
      expect(result.conflicts[0]?.sourceRecordIds).toContain("44444444-4444-4444-8444-444444444443");
    });

    it("handles empty data cleanly without fabricating metrics for manager daily briefing", async () => {
      const result = await provider.generateManagerDailyBriefing({
        briefingDate: "2026-11-01",
        metrics: {
          tripsScheduledToday: 0,
          visitsScheduledToday: 0,
          completedVisitsCount: 0,
          overdueVisitsCount: 0,
          pendingApprovalsCount: 0,
          missingEvidenceCount: 0,
          unfinishedChecklistsCount: 0,
        },
        tripsToday: [],
        overdueVisits: [],
        pendingApprovals: [],
        missingEvidenceVisits: [],
        repWorkloads: [],
        hasSufficientData: false,
      });

      expect(result.summaryHeadline).toContain("Insufficient Field Operations Data");
      expect(result.executiveSummary).toContain("contain insufficient active trips or visits");
      expect(result.criticalExceptions).toEqual([]);
    });
  });

  describe("ResilientAiIntelligenceProvider", () => {
    it("falls back to heuristic engine when primary OpenAI provider throws an error", async () => {
      const mockPrimary: AiIntelligenceProvider = {
        providerName: "mock_openai",
        generateTripPlanningInsights: vi.fn().mockRejectedValue(new Error("OpenAI Rate Limit 429")),
        generateManagerDailyBriefing: vi.fn().mockRejectedValue(new Error("Timeout 504")),
      };
      const resilient = new ResilientAiIntelligenceProvider({
        primary: mockPrimary as unknown as OpenAiIntelligenceProvider,
      });

      const planResult = await resilient.generateTripPlanningInsights({
        tripId: "44444444-4444-4444-8444-444444444444",
        title: "Resilience Check",
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        assignedRepUserId: repUser.id,
        assignedRepName: "Bob Rep",
        stops: [],
        otherRepTripsOnSameDates: [],
        routeOptimization: {
          distanceSavingsMeters: 0,
          durationSavingsMinutes: 0,
          isReordered: false,
          proposedOrder: [],
        },
      });

      expect(planResult.evidenceExplanation).toContain("Resilience Check");

      const briefingResult = await resilient.generateManagerDailyBriefing({
        briefingDate: "2026-11-01",
        metrics: {
          tripsScheduledToday: 0,
          visitsScheduledToday: 0,
          completedVisitsCount: 0,
          overdueVisitsCount: 0,
          pendingApprovalsCount: 0,
          missingEvidenceCount: 0,
          unfinishedChecklistsCount: 0,
        },
        tripsToday: [],
        overdueVisits: [],
        pendingApprovals: [],
        missingEvidenceVisits: [],
        repWorkloads: [],
        hasSufficientData: false,
      });

      expect(briefingResult.summaryHeadline).toContain("Insufficient Field Operations Data");
    });
  });

  describe("AI Trip Planning Workflow (Service Level)", () => {
    const tripId = "55555555-5555-4555-8555-555555555551";
    const storeAId = "66666666-6666-4666-8666-666666666661";
    const storeBId = "66666666-6666-4666-8666-666666666662";

    it("generates recommendations and records audit log ai.trip_plan_recommended", async () => {
      const auditRepo = new MockAuditRepo();
      const tenancyRepo = new MockTenancyRepo();
      tenancyRepo.memberships.push({
        id: "mem-1",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const storesRepo = new MockStoresRepo();
      storesRepo.stores.push(
        {
          id: storeAId,
          orgId,
          name: "Store A",
          region: "North",
          addressLine1: "123 Elm",
          addressLine2: null,
          city: "New York",
          stateProvince: "NY",
          postalCode: "10001",
          countryCode: "US",
          latitude: 40.71,
          longitude: -74.00,
          active: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: storeBId,
          orgId,
          name: "Store B",
          region: "North",
          addressLine1: "456 Oak",
          addressLine2: null,
          city: "New York",
          stateProvince: "NY",
          postalCode: "10002",
          countryCode: "US",
          latitude: 40.72,
          longitude: -74.01,
          active: true,
          createdAt: "",
          updatedAt: "",
        }
      );

      const tripsRepo = new MockTripsRepo();
      tripsRepo.trips.push({
        trip: {
          id: tripId,
          orgId,
          ownerUserId: repUser.id,
          title: "North District Tour",
          purpose: "Routine check",
          startDate: "2026-11-10",
          endDate: "2026-11-10",
          status: "draft",
          submittedAt: null,
          decidedBy: null,
          decidedAt: null,
          decisionNote: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        stops: [
          {
            id: "stop-a",
            orgId,
            tripId,
            storeId: storeAId,
            sequenceNumber: 1,
            plannedAt: "2026-11-10T09:00:00Z",
            status: "planned",
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "stop-b",
            orgId,
            tripId,
            storeId: storeBId,
            sequenceNumber: 2,
            plannedAt: "2026-11-10T11:00:00Z",
            status: "planned",
            createdAt: "",
            updatedAt: "",
          },
        ],
        auditEvents: [],
      });

      const plan = await generateTripPlanAssistantForOrg({
        user: managerUser,
        candidateOrgId: orgId,
        candidateTripId: tripId,
        tenancyRepository: tenancyRepo,
        tripsRepository: tripsRepo,
        storesRepository: storesRepo,
        auditRepository: auditRepo,
      });

      expect(plan.tripId).toBe(tripId);
      expect(plan.requiresHumanReview).toBe(true);
      expect(
        auditRepo.events.some((e) => e.actionType === "ai.trip_plan_recommended")
      ).toBe(true);
    });

    it("prevents modifying approved trip sequence without explicit confirmation", async () => {
      const auditRepo = new MockAuditRepo();
      const tenancyRepo = new MockTenancyRepo();
      tenancyRepo.memberships.push({
        id: "mem-2",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const storesRepo = new MockStoresRepo();
      storesRepo.stores.push(
        {
          id: storeAId,
          orgId,
          name: "Store 1",
          region: "R1",
          addressLine1: "A1",
          addressLine2: null,
          city: "C1",
          stateProvince: null,
          postalCode: null,
          countryCode: "US",
          latitude: 10,
          longitude: 10,
          active: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: storeBId,
          orgId,
          name: "Store 2",
          region: "R1",
          addressLine1: "A2",
          addressLine2: null,
          city: "C1",
          stateProvince: null,
          postalCode: null,
          countryCode: "US",
          latitude: 20,
          longitude: 20,
          active: true,
          createdAt: "",
          updatedAt: "",
        }
      );

      const tripsRepo = new MockTripsRepo();
      tripsRepo.trips.push({
        trip: {
          id: tripId,
          orgId,
          ownerUserId: repUser.id,
          title: "Approved Route",
          purpose: "Auditing",
          startDate: "2026-11-10",
          endDate: "2026-11-10",
          status: "approved",
          submittedAt: "2026-11-01T00:00:00Z",
          decidedBy: managerUser.id,
          decidedAt: "2026-11-01T12:00:00Z",
          decisionNote: "Approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        stops: [
          {
            id: "s1",
            orgId,
            tripId,
            storeId: storeAId,
            sequenceNumber: 1,
            plannedAt: null,
            status: "planned",
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "s2",
            orgId,
            tripId,
            storeId: storeBId,
            sequenceNumber: 2,
            plannedAt: null,
            status: "planned",
            createdAt: "",
            updatedAt: "",
          },
        ],
        auditEvents: [],
      });

      // Attempt without confirmApprovedTripModification throws CONFLICT
      await expect(
        applyTripPlanRecommendationForOrg({
          user: managerUser,
          candidateOrgId: orgId,
          candidateTripId: tripId,
          rawInput: {
            proposedStopOrder: [
              { storeId: storeBId, plannedAt: null },
              { storeId: storeAId, plannedAt: null },
            ],
            confirmApprovedTripModification: false,
          },
          tenancyRepository: tenancyRepo,
          tripsRepository: tripsRepo,
          storesRepository: storesRepo,
          auditRepository: auditRepo,
        })
      ).rejects.toThrow("Trip is already approved");

      // Pass confirmApprovedTripModification: true
      const updated = await applyTripPlanRecommendationForOrg({
        user: managerUser,
        candidateOrgId: orgId,
        candidateTripId: tripId,
        rawInput: {
          proposedStopOrder: [
            { storeId: storeBId, plannedAt: null },
            { storeId: storeAId, plannedAt: null },
          ],
          confirmApprovedTripModification: true,
        },
        tenancyRepository: tenancyRepo,
        tripsRepository: tripsRepo,
        storesRepository: storesRepo,
        auditRepository: auditRepo,
      });

      expect(updated.trip.status).toBe("draft"); // Reset to draft for re-approval
      expect(
        auditRepo.events.some((e) => e.actionType === "ai.trip_plan_applied")
      ).toBe(true);
    });
  });

  describe("Manager Daily Briefing Workflow (Service Level)", () => {
    it("enforces role restrictions: forbids field representatives from viewing manager briefing", async () => {
      const tenancyRepo = new MockTenancyRepo();
      tenancyRepo.memberships.push({
        id: "mem-3",
        orgId,
        userId: repUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(
        getManagerDailyBriefingForOrg({
          user: repUser,
          candidateOrgId: orgId,
          tenancyRepository: tenancyRepo,
          reportingRepository: new MockReportingRepo(),
        })
      ).rejects.toThrow(/Required one of roles \[admin, manager\]/);
    });

    it("allows manager to view briefing and logs ai.manager_briefing_generated", async () => {
      const auditRepo = new MockAuditRepo();
      const tenancyRepo = new MockTenancyRepo();
      tenancyRepo.memberships.push({
        id: "mem-4",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const briefing = await getManagerDailyBriefingForOrg({
        user: managerUser,
        candidateOrgId: orgId,
        rawQuery: { date: "2026-11-01" },
        tenancyRepository: tenancyRepo,
        reportingRepository: new MockReportingRepo(),
        auditRepository: auditRepo,
      });

      expect(briefing.orgId).toBe(orgId);
      expect(briefing.briefingDate).toBe("2026-11-01");
      expect(
        auditRepo.events.some((e) => e.actionType === "ai.manager_briefing_generated")
      ).toBe(true);
    });

    it("records briefing action update and logs ai.briefing_action_updated", async () => {
      const auditRepo = new MockAuditRepo();
      const tenancyRepo = new MockTenancyRepo();
      tenancyRepo.memberships.push({
        id: "mem-5",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await updateBriefingActionForOrg({
        user: managerUser,
        candidateOrgId: orgId,
        rawInput: {
          actionId: "act-123",
          status: "accepted",
          note: "Approved itinerary adjustment",
        },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      expect(result.actionId).toBe("act-123");
      expect(result.status).toBe("accepted");
      expect(
        auditRepo.events.some((e) => e.actionType === "ai.briefing_action_updated")
      ).toBe(true);
    });
  });
});
