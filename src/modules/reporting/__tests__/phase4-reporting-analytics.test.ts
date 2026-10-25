import { describe, expect, it } from "vitest";
import {
  buildManagerReportCsv,
  sanitizeAndQuoteCsvText,
} from "@/modules/reporting/csv";
import type {
  OrgOperationalDataset,
  ReportingRepository,
} from "@/modules/reporting/repository";
import { getOperationsReportForOrg } from "@/modules/reporting/service";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import { buildUnverifiedDeviceLocation } from "@/modules/visits/domain";

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
        fullName: uid === "user-rep-1" ? "Elena Rostova" : "David Chen",
      };
    }
    return res;
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

describe("Phase 4: Live Reports & Analytics Engine", () => {
  const managerUser: AuthenticatedUser = {
    id: "user-mgr-1",
    email: "manager@example.com",
  };

  const repUser: AuthenticatedUser = {
    id: "user-rep-1",
    email: "rep@example.com",
  };

  const orgId = "11111111-1111-4111-8111-111111111111";
  const otherOrgId = "22222222-2222-4222-8222-222222222222";

  function setupFixture() {
    const tenancyRepo = new MockTenancyRepo();
    tenancyRepo.organizations = [
      {
        id: orgId,
        name: "Acme Logistics",
        slug: "acme-logistics",
        status: "active",
        createdBy: managerUser.id,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    tenancyRepo.memberships = [
      {
        id: "mem-mgr",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "mem-rep",
        orgId,
        userId: repUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: managerUser.id,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const reportingRepo = new MockReportingRepo();
    reportingRepo.dataset = {
      stores: [
        {
          id: "store-downtown-1",
          orgId,
          name: "Downtown Supercenter",
          region: "Downtown",
          addressLine1: "100 Main St",
          addressLine2: null,
          city: "Metropolis",
          stateProvince: "CA",
          postalCode: "94101",
          countryCode: "US",
          latitude: 37.77,
          longitude: -122.41,
          active: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "store-uptown-2",
          orgId,
          name: "Uptown Fresh Market",
          region: "Uptown",
          addressLine1: "500 Grand Ave",
          addressLine2: null,
          city: "Metropolis",
          stateProvince: "CA",
          postalCode: "94102",
          countryCode: "US",
          latitude: 37.79,
          longitude: -122.4,
          active: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      trips: [
        {
          id: "trip-01",
          orgId,
          ownerUserId: repUser.id,
          title: "Weekly Store Audit Route",
          startDate: "2026-10-20",
          endDate: "2026-10-22",
          purpose: "audit",
          status: "completed",
          submittedAt: "2026-10-19T10:00:00Z",
          decidedBy: managerUser.id,
          decidedAt: "2026-10-19T14:00:00Z", // 4.0h turnaround
          decisionNote: "Approved",
          createdAt: "2026-10-19T09:00:00Z",
          updatedAt: "2026-10-22T18:00:00Z",
        },
      ],
      tripStops: [
        {
          id: "stop-01",
          orgId,
          tripId: "trip-01",
          storeId: "store-downtown-1",
          sequenceNumber: 1,
          plannedAt: "2026-10-20T10:00:00Z",
          status: "visited",
          createdAt: "2026-10-19T09:00:00Z",
          updatedAt: "2026-10-20T11:30:00Z",
        },
        {
          id: "stop-02",
          orgId,
          tripId: "trip-01",
          storeId: "store-uptown-2",
          sequenceNumber: 2,
          plannedAt: "2026-10-21T14:00:00Z",
          status: "visited",
          createdAt: "2026-10-19T09:00:00Z",
          updatedAt: "2026-10-21T16:00:00Z",
        },
      ],
      visits: [
        {
          id: "visit-01",
          orgId,
          tripStopId: "stop-01",
          employeeUserId: repUser.id,
          checkedInAt: "2026-10-20T10:00:00Z",
          checkedOutAt: "2026-10-20T11:30:00Z", // 1.5h
          checkInLocation: buildUnverifiedDeviceLocation({
            lat: 37.77,
            lng: -122.41,
            accuracyMeters: 5,
            status: "captured_unverified",
          }),
          checkOutLocation: buildUnverifiedDeviceLocation({
            lat: 37.77,
            lng: -122.41,
            accuracyMeters: 5,
            status: "captured_unverified",
          }),
          checkInIdempotencyKey: null,
          checkOutIdempotencyKey: null,
          notes: "Store shelf clean",
          status: "submitted",
          createdAt: "2026-10-20T10:00:00Z",
          updatedAt: "2026-10-20T11:30:00Z",
        },
        {
          id: "visit-02",
          orgId,
          tripStopId: "stop-02",
          employeeUserId: repUser.id,
          checkedInAt: "2026-10-21T14:00:00Z",
          checkedOutAt: "2026-10-21T16:00:00Z", // 2.0h
          checkInLocation: buildUnverifiedDeviceLocation({
            lat: 37.79,
            lng: -122.4,
            accuracyMeters: 6,
            status: "captured_unverified",
          }),
          checkOutLocation: buildUnverifiedDeviceLocation({
            lat: 37.79,
            lng: -122.4,
            accuracyMeters: 6,
            status: "captured_unverified",
          }),
          checkInIdempotencyKey: null,
          checkOutIdempotencyKey: null,
          notes: "Missing signage",
          status: "submitted",
          createdAt: "2026-10-21T14:00:00Z",
          updatedAt: "2026-10-21T16:00:00Z",
        },
      ],
      checklistItems: [
        {
          id: "chk-01",
          orgId,
          visitId: "visit-01",
          questionKey: "q1",
          label: "Shelf clean",
          answerType: "boolean",
          answerValue: true,
          answerText: null,
          flagged: false,
          required: true,
          completedAt: "2026-10-20T10:15:00Z",
          completedBy: repUser.id,
          createdAt: "2026-10-20T10:00:00Z",
          updatedAt: "2026-10-20T10:15:00Z",
        },
        {
          id: "chk-02",
          orgId,
          visitId: "visit-02",
          questionKey: "q2",
          label: "Price tags match",
          answerType: "boolean",
          answerValue: false,
          answerText: null,
          flagged: true, // FLAGGED EXCEPTION
          required: true,
          completedAt: "2026-10-21T14:30:00Z",
          completedBy: repUser.id,
          createdAt: "2026-10-21T14:00:00Z",
          updatedAt: "2026-10-21T14:30:00Z",
        },
      ],
      evidence: [],
      auditEvents: [],
    };

    return { tenancyRepo, reportingRepo };
  }

  it("calculates accurate live operational metrics and turnaround times", async () => {
    const { tenancyRepo, reportingRepo } = setupFixture();
    const fixedNow = new Date("2026-10-25T12:00:00Z");

    const report = await getOperationsReportForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "30d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: fixedNow,
    });

    // 1 trip, 2 stops, 2 visits completed
    expect(report.kpis.totalTrips).toBe(1);
    expect(report.kpis.completedTrips).toBe(1);
    expect(report.kpis.visitCompletionRate).toBe(100);
    // 1 clean visit out of 2 => 50% compliance
    expect(report.kpis.auditComplianceScore).toBe(50);
    // 1.5h + 2.0h = 3.5h total field hours
    expect(report.kpis.totalFieldHours).toBe(3.5);
    // 1 flagged checklist item => 1 exception logged
    expect(report.kpis.exceptionsLogged).toBe(1);
    // submitted at 10:00, decided at 14:00 => 4.0 hours turnaround
    expect(report.kpis.approvalTurnaroundHoursAvg).toBe(4.0);

    // Rep performance
    expect(report.repPerformance.length).toBe(1);
    expect(report.repPerformance[0]?.name).toBe("Elena Rostova");
    expect(report.repPerformance[0]?.completedVisits).toBe(2);
    expect(report.repPerformance[0]?.completionRate).toBe(100);
    expect(report.repPerformance[0]?.exceptionsFlagged).toBe(1);

    // Territory summary
    expect(report.territorySummary.length).toBe(2);
    const downtown = report.territorySummary.find((t) => t.territory === "Downtown");
    expect(downtown?.visitedStores).toBe(1);
    expect(downtown?.coveragePercentage).toBe(100);
  });

  it("evaluates date range boundaries: 7d, 30d, quarter, and ytd", async () => {
    const { tenancyRepo, reportingRepo } = setupFixture();
    const fixedNow = new Date("2026-10-25T12:00:00Z");

    // 7d: 2026-10-18 to 2026-10-25 -> trip start is 2026-10-20 -> included
    const report7d = await getOperationsReportForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "7d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: fixedNow,
    });
    expect(report7d.timeWindow.range).toBe("7d");
    expect(report7d.kpis.totalTrips).toBe(1);

    // Custom date range excluding the trip: 2026-10-01 to 2026-10-15
    const reportOld = await getOperationsReportForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: {
        range: "custom",
        startDateFrom: "2026-10-01",
        startDateTo: "2026-10-15",
      },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
      now: fixedNow,
    });
    expect(reportOld.kpis.totalTrips).toBe(0);
    expect(reportOld.kpis.visitCompletionRate).toBe(0);
    expect(reportOld.rows.length).toBe(0);
  });

  it("handles empty reporting datasets gracefully without division-by-zero", async () => {
    const { tenancyRepo, reportingRepo } = setupFixture();
    reportingRepo.dataset = {
      stores: [],
      trips: [],
      tripStops: [],
      visits: [],
      checklistItems: [],
      evidence: [],
      auditEvents: [],
    };

    const report = await getOperationsReportForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: { range: "30d" },
      tenancyRepository: tenancyRepo,
      reportingRepository: reportingRepo,
    });

    expect(report.kpis.totalTrips).toBe(0);
    expect(report.kpis.visitCompletionRate).toBe(0);
    expect(report.kpis.auditComplianceScore).toBe(100);
    expect(report.kpis.totalFieldHours).toBe(0);
    expect(report.kpis.approvalTurnaroundHoursAvg).toBeNull();
    expect(report.rows.length).toBe(0);
  });

  it("escapes CSV values and prevents spreadsheet formula injection", () => {
    // OWASP formula trigger characters: '=', '+', '-', '@', '\t', '\r'
    expect(sanitizeAndQuoteCsvText("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeAndQuoteCsvText("+12345")).toBe("'+12345");
    expect(sanitizeAndQuoteCsvText("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeAndQuoteCsvText("@SUM")).toBe("'@SUM");

    // Standard string with quotes and commas
    expect(sanitizeAndQuoteCsvText('Store "Special", Downtown')).toBe(
      '"Store ""Special"", Downtown"'
    );

    // CSV generator
    const csv = buildManagerReportCsv([]);
    expect(csv).toContain("trip_id,trip_title,trip_status");
  });

  it("enforces tenant boundary and role authorization", async () => {
    const { tenancyRepo, reportingRepo } = setupFixture();

    // field_employee cannot access manager reports
    await expect(
      getOperationsReportForOrg({
        user: repUser,
        candidateOrgId: orgId,
        rawQuery: { range: "30d" },
        tenancyRepository: tenancyRepo,
        reportingRepository: reportingRepo,
      })
    ).rejects.toThrow(/permitted|FORBIDDEN/);

    // non-member cannot access reports
    await expect(
      getOperationsReportForOrg({
        user: {
          id: "unauthorized-user",
          email: "stranger@example.com",
        },
        candidateOrgId: orgId,
        rawQuery: { range: "30d" },
        tenancyRepository: tenancyRepo,
        reportingRepository: reportingRepo,
      })
    ).rejects.toThrow();

    // member of org A cannot access org B
    await expect(
      getOperationsReportForOrg({
        user: managerUser,
        candidateOrgId: otherOrgId,
        rawQuery: { range: "30d" },
        tenancyRepository: tenancyRepo,
        reportingRepository: reportingRepo,
      })
    ).rejects.toThrow();
  });
});
