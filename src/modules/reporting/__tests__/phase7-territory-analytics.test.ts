import { describe, expect, it } from "vitest";
import type {
  OrgOperationalDataset,
  ReportingRepository,
} from "@/modules/reporting/repository";
import { getTerritoryAnalyticsForOrg } from "@/modules/reporting/service";
import type { Store } from "@/modules/stores/domain";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { Trip, TripStop } from "@/modules/trips/domain";
import { buildUnverifiedDeviceLocation, type Visit } from "@/modules/visits/domain";

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

class MockTenancyRepo implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return (
      this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null
    );
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.memberships
      .filter((m) => m.userId === userId && m.status === "active")
      .map((membership) => {
        const organization = this.organizations.find((o) => o.id === membership.orgId);
        if (!organization) throw new Error("Missing org");
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(): Promise<never> {
    throw new Error("Not implemented");
  }
  async listOrgMembers(): Promise<never> {
    throw new Error("Not implemented");
  }
  async addOrgMember(): Promise<never> {
    throw new Error("Not implemented");
  }
  async createOrgInvitation(): Promise<never> {
    throw new Error("Not implemented");
  }
  async acceptOrgInvitationByTokenHash(): Promise<never> {
    throw new Error("Not implemented");
  }

  async getProfilesByUserIds(userIds: string[]) {
    const res: Record<string, { id: string; email: string; fullName: string }> = {};
    for (const uid of userIds) {
      res[uid] = {
        id: uid,
        email: `${uid}@example.com`,
        fullName: uid.includes("rep-1") ? "Elena Rostova" : "David Chen",
      };
    }
    return res;
  }
}

describe("Workstream 3: Territory & Field Team Analytics", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  const managerUser: AuthenticatedUser = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "manager@enterprise.com",
  };

  const repUser: AuthenticatedUser = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "rep@enterprise.com",
  };

  function setup() {
    const tenancyRepo = new MockTenancyRepo();
    const reportingRepo = new MockReportingRepo();

    tenancyRepo.organizations = [
      {
        id: orgId,
        name: "Enterprise Field Corp",
        slug: "field-corp",
        status: "active",
        createdBy: managerUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    tenancyRepo.memberships = [
      {
        id: "m-mgr",
        orgId,
        userId: managerUser.id,
        managerUserId: null,
        role: "manager",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-rep",
        orgId,
        userId: repUser.id,
        managerUserId: null,
        role: "field_employee",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    // Seed Stores
    const stores: Store[] = [
      {
        id: "store-north-1",
        orgId,
        name: "North Flagship Target",
        city: "Seattle",
        region: "North",
        addressLine1: "100 Pine St",
        addressLine2: null,
        stateProvince: "WA",
        postalCode: "98101",
        countryCode: "US",
        latitude: 47.6062,
        longitude: -122.3321,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "store-north-2",
        orgId,
        name: "North Suburban Walmart",
        city: "Bellevue",
        region: "North",
        addressLine1: "200 Bellevue Way",
        addressLine2: null,
        stateProvince: "WA",
        postalCode: "98004",
        countryCode: "US",
        latitude: 47.6101,
        longitude: -122.2015,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "store-south-1",
        orgId,
        name: "South Central Best Buy",
        city: "Portland",
        region: "South",
        addressLine1: "500 Pioneer Square",
        addressLine2: null,
        stateProvince: "OR",
        postalCode: "97201",
        countryCode: "US",
        latitude: 45.5152,
        longitude: -122.6784,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    // Seed Trip
    const trips: Trip[] = [
      {
        id: "trip-1",
        orgId,
        ownerUserId: repUser.id,
        title: "North Pacific Route",
        purpose: "Weekly compliance and display check",
        status: "completed",
        startDate: "2026-10-20",
        endDate: "2026-10-22",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-22T00:00:00.000Z",
        submittedAt: "2026-10-18T10:00:00.000Z",
        decidedAt: "2026-10-18T12:00:00.000Z",
        decidedBy: managerUser.id,
        decisionNote: null,
      },
    ];

    // Seed Trip Stops
    const tripStops: TripStop[] = [
      {
        id: "stop-1",
        orgId,
        tripId: "trip-1",
        storeId: "store-north-1",
        sequenceNumber: 1,
        plannedAt: "2026-10-20T09:00:00.000Z",
        status: "visited",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-20T10:30:00.000Z",
      },
      {
        id: "stop-2",
        orgId,
        tripId: "trip-1",
        storeId: "store-north-2",
        sequenceNumber: 2,
        plannedAt: "2026-10-21T09:00:00.000Z",
        status: "planned",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-18T00:00:00.000Z",
      },
    ];

    // Seed Completed Visit for Stop 1
    const visits: Visit[] = [
      {
        id: "visit-1",
        orgId,
        tripStopId: "stop-1",
        employeeUserId: repUser.id,
        status: "reviewed",
        checkedInAt: "2026-10-20T09:15:00.000Z",
        checkedOutAt: "2026-10-20T10:15:00.000Z",
        checkInLocation: buildUnverifiedDeviceLocation({
          lat: 47.6062,
          lng: -122.3321,
          accuracyMeters: 10,
          status: "captured_unverified",
        }),
        checkOutLocation: buildUnverifiedDeviceLocation({
          lat: 47.6062,
          lng: -122.3321,
          accuracyMeters: 10,
          status: "captured_unverified",
        }),
        checkInIdempotencyKey: null,
        checkOutIdempotencyKey: null,
        notes: "All endcaps compliant.",
        createdAt: "2026-10-20T09:15:00.000Z",
        updatedAt: "2026-10-20T11:00:00.000Z",
      },
    ];

    reportingRepo.dataset = {
      stores,
      trips,
      tripStops,
      visits,
      checklistItems: [],
      evidence: [],
      auditEvents: [],
    };

    return { tenancyRepo, reportingRepo };
  }

  it("aggregates territory metrics accurately including planned, completed, missed, and coverage rate", async () => {
    const { tenancyRepo, reportingRepo } = setup();

    const analytics = await getTerritoryAnalyticsForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "30d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: new Date("2026-10-25T12:00:00.000Z"),
    });

    expect(analytics.territoryMetrics).toHaveLength(2);

    const northTerritory = analytics.territoryMetrics.find((t) => t.territory === "North");
    expect(northTerritory).toBeDefined();
    expect(northTerritory?.storeCount).toBe(2);
    expect(northTerritory?.plannedVisits).toBe(2);
    expect(northTerritory?.completedVisits).toBe(1);
    expect(northTerritory?.missedVisits).toBe(1);
    expect(northTerritory?.visitCompletionRate).toBe(50);
    expect(northTerritory?.coveragePercentage).toBe(50); // 1 of 2 stores visited
  });

  it("calculates representative workloads including assigned trips, planned stops, and outstanding assignments", async () => {
    const { tenancyRepo, reportingRepo } = setup();

    const analytics = await getTerritoryAnalyticsForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "30d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: new Date("2026-10-25T12:00:00.000Z"),
    });

    expect(analytics.repWorkloads).toHaveLength(1);
    const rep = analytics.repWorkloads[0];
    expect(rep).toBeDefined();
    expect(rep?.userId).toBe(repUser.id);
    expect(rep?.assignedTrips).toBe(1);
    expect(rep?.plannedStops).toBe(2);
    expect(rep?.completedVisits).toBe(1);
    expect(rep?.outstandingAssignments).toBe(1); // 2 planned - 1 completed
    expect(rep?.completionRate).toBe(50);
  });

  it("tracks account-level store frequencies, completion rates, and last visited timestamps", async () => {
    const { tenancyRepo, reportingRepo } = setup();

    const analytics = await getTerritoryAnalyticsForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "30d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: new Date("2026-10-25T12:00:00.000Z"),
    });

    expect(analytics.storeFrequencies).toHaveLength(3);

    const visitedStore = analytics.storeFrequencies.find((s) => s.storeId === "store-north-1");
    expect(visitedStore?.completedVisitsCount).toBe(1);
    expect(visitedStore?.plannedVisitsCount).toBe(1);
    expect(visitedStore?.completionRate).toBe(100);
    expect(visitedStore?.lastVisitedAt).toBe("2026-10-20T10:15:00.000Z");

    const unvisitedStore = analytics.storeFrequencies.find((s) => s.storeId === "store-south-1");
    expect(unvisitedStore?.completedVisitsCount).toBe(0);
    expect(unvisitedStore?.lastVisitedAt).toBeNull();
  });

  it("strictly enforces manager/admin authorization for territory analytics (403 for field employees)", async () => {
    const { tenancyRepo, reportingRepo } = setup();

    await expect(
      getTerritoryAnalyticsForOrg({
        user: repUser,
        candidateOrgId: orgId,
        rawQuery: { range: "30d" },
        tenancyRepository: tenancyRepo,
        reportingRepository: reportingRepo,
      })
    ).rejects.toThrow();
  });
});
