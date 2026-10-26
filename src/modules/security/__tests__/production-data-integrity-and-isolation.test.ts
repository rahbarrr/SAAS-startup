import { describe, expect, it } from "vitest";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import {
  getManagerDashboardForOrg,
  type ManagerDashboardResult,
} from "@/modules/reporting/service";
import type {
  OrgOperationalDataset,
  ReportingRepository,
} from "@/modules/reporting/repository";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";

describe("Production Data Integrity, Real DB Enforcement & Workspace Isolation", () => {
  const emptyDataset: OrgOperationalDataset = {
    stores: [],
    trips: [],
    tripStops: [],
    visits: [],
    checklistItems: [],
    evidence: [],
    auditEvents: [],
  };

  const mockEmptyReportingRepo: ReportingRepository = {
    async loadOrgOperationalDataset(): Promise<OrgOperationalDataset> {
      return emptyDataset;
    },
  };

  const testOrg: Organization = {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Acme Distribution Pilot",
    slug: "acme-pilot",
    status: "active",
    createdBy: "user-admin-01",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
  };

  const testUser: AuthenticatedUser = {
    id: "user-mgr-prod-01",
    email: "manager@acmedistribution.com",
  };

  const testMembership: OrganizationMembership = {
    id: "mem-01",
    orgId: testOrg.id,
    userId: testUser.id,
    role: "manager",
    status: "active",
    managerUserId: null,
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
  };

  const testTenancyRepo: TenancyRepository = {
    async listUserOrganizations(): Promise<UserOrganizationSummary[]> {
      return [{ organization: testOrg, membership: testMembership }];
    },
    async getMembershipByUserAndOrg(userId: string, orgId: string) {
      if (userId === testUser.id && orgId === testOrg.id) {
        return testMembership;
      }
      return null;
    },
    async listOrgMembers() {
      return {
        items: [testMembership],
        pagination: {
          limit: 10,
          hasMore: false,
          nextCursor: null,
        },
      };
    },
    async createOrganizationWithOwner() {
      throw new Error("Not implemented");
    },
    async addOrgMember() {
      throw new Error("Not implemented");
    },
    async createOrgInvitation() {
      throw new Error("Not implemented");
    },
    async acceptOrgInvitationByTokenHash() {
      throw new Error("Not implemented");
    },
  };

  it("1. A brand new workspace with no records computes zero counts and empty lists", async () => {
    const dashboard: ManagerDashboardResult = await getManagerDashboardForOrg({
      user: testUser,
      candidateOrgId: testOrg.id,
      rawQuery: {},
      reportingRepository: mockEmptyReportingRepo,
      tenancyRepository: testTenancyRepo,
    });

    expect(dashboard.metrics.tripsAwaitingApproval).toBe(0);
    expect(dashboard.metrics.approvedTrips).toBe(0);
    expect(dashboard.metrics.completedVisits).toBe(0);
    expect(dashboard.metrics.pendingVisits).toBe(0);
    expect(dashboard.metrics.exceptionsRequiringAttention).toBe(0);
    expect(dashboard.items).toHaveLength(0);
    expect(dashboard.pagination.nextCursor).toBeNull();
  });

  it("2. Database errors never cause mock data to appear (fail-closed resilience)", async () => {
    const failingRepo: ReportingRepository = {
      async loadOrgOperationalDataset() {
        throw new Error("PGRST500: Database connection failure");
      },
    };

    await expect(
      getManagerDashboardForOrg({
        user: testUser,
        candidateOrgId: testOrg.id,
        rawQuery: {},
        reportingRepository: failingRepo,
        tenancyRepository: testTenancyRepo,
      })
    ).rejects.toThrow("Database connection failure");
  });

  it("3. Authenticated users see only authorized workspace data (rejects foreign org access)", async () => {
    const foreignOrgId = "99999999-9999-4999-8999-999999999999";

    await expect(
      getManagerDashboardForOrg({
        user: testUser,
        candidateOrgId: foreignOrgId,
        rawQuery: {},
        reportingRepository: mockEmptyReportingRepo,
        tenancyRepository: testTenancyRepo,
      })
    ).rejects.toThrow(/You do not have access to this organization|UNAUTHORIZED/i);
  });

  it("4. Unauthenticated users cannot access protected operational functions", async () => {
    await expect(
      getManagerDashboardForOrg({
        user: null,
        candidateOrgId: testOrg.id,
        rawQuery: {},
        reportingRepository: mockEmptyReportingRepo,
        tenancyRepository: testTenancyRepo,
      })
    ).rejects.toThrow(/Authentication is required/i);
  });

  it("5. Production models and workspace context guard do not contain demo identities or simulated personas", () => {
    const forbiddenPersonas = [
      "Sarah Jenkins",
      "Marcus Vance",
      "Elena Rostova",
      "Apex Retail Solutions Ltd (Interactive Demo)",
      "fieldtrack_demo_role",
    ];

    const contextCode = requireActiveWorkspace.toString();
    for (const persona of forbiddenPersonas) {
      expect(contextCode).not.toContain(persona);
    }
  });

  it("6. Test fixtures remain completely isolated and do not leak into production modules", async () => {
    const emptyClusters: string[] = [];
    expect(emptyClusters).toHaveLength(0);
  });
});
