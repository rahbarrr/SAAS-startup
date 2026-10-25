import { describe, expect, it } from "vitest";
import {
  buildManagerReportCsv,
  MANAGER_REPORT_CSV_HEADERS,
  sanitizeAndQuoteCsvText,
} from "@/modules/reporting/csv";
import type {
  OrgOperationalDataset,
  ReportingRepository,
} from "@/modules/reporting/repository";
import {
  exportManagerReportCsvForOrg,
  getManagerDashboardForOrg,
  getTripPlannedVsActualForOrg,
  getVisitPlannedVsActualForOrg,
} from "@/modules/reporting/service";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type {
  CreateInvitationRecordInput,
  PaginatedMembersResult,
  TenancyRepository,
} from "@/modules/tenancy/repository";
import type {
  AddOrgMemberInput,
  CreateOrganizationInput,
  ListOrgMembersQuery,
} from "@/modules/tenancy/schemas";
import { buildUnverifiedDeviceLocation } from "@/modules/visits/domain";

class InMemoryTenancyRepo implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null;
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

  async createOrganizationWithOwner(
    _userId: string,
    _input: CreateOrganizationInput
  ): Promise<Organization> {
    throw new Error("Not used");
  }

  async listOrgMembers(
    _orgId: string,
    _query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    throw new Error("Not used");
  }

  async addOrgMember(
    _orgId: string,
    _input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }

  async createOrgInvitation(
    _input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    throw new Error("Not used");
  }

  async acceptOrgInvitationByTokenHash(): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }
}

class InMemoryReportingRepo implements ReportingRepository {
  constructor(public readonly fullDataset: OrgOperationalDataset) {}

  async loadOrgOperationalDataset(orgId: string): Promise<OrgOperationalDataset> {
    return {
      stores: this.fullDataset.stores.filter((s) => s.orgId === orgId),
      trips: this.fullDataset.trips.filter((t) => t.orgId === orgId),
      tripStops: this.fullDataset.tripStops.filter((s) => s.orgId === orgId),
      visits: this.fullDataset.visits.filter((v) => v.orgId === orgId),
      checklistItems: this.fullDataset.checklistItems.filter((c) => c.orgId === orgId),
      evidence: this.fullDataset.evidence.filter((e) => e.orgId === orgId),
      auditEvents: this.fullDataset.auditEvents.filter((a) => a.orgId === orgId),
    };
  }
}

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const MANAGER_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "marcus.manager@acme.local",
};
const EMPLOYEE_A1: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "fiona.field@acme.local",
};
const EMPLOYEE_A2: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000004",
  email: "evan.field@acme.local",
};
const MANAGER_B: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000005",
  email: "brenda.manager@beta.local",
};

const STORE_A1_ID = "40000000-0000-4000-8000-000000000001";
const STORE_A2_ID = "40000000-0000-4000-8000-000000000002";
const STORE_B1_ID = "40000000-0000-4000-8000-000000000003";

// Trips in Org A:
// 1. TRIP_SUBMITTED_A: status = 'submitted' (awaiting approval)
// 2. TRIP_APPROVED_IN_PROGRESS_A: status = 'in_progress', 2 stops (Stop 1 checked out/submitted, Stop 2 still in_progress with 1 flagged item & denied location)
// 3. TRIP_COMPLETED_A: status = 'completed', 1 stop (Stop 1 checked out/reviewed with captured_unverified location)
// 4. TRIP_CHANGES_REQUESTED_A: status = 'changes_requested', 1 stop (requires attention)
// Plus 1 trip in Org B (must never leak into Org A aggregates or CSV exports!)
const TRIP_SUBMITTED_A = "50000000-0000-4000-8000-000000000011";
const TRIP_APPROVED_IN_PROGRESS_A = "50000000-0000-4000-8000-000000000012";
const TRIP_COMPLETED_A = "50000000-0000-4000-8000-000000000013";
const TRIP_CHANGES_REQUESTED_A = "50000000-0000-4000-8000-000000000014";
const TRIP_ORG_B = "50000000-0000-4000-8000-000000000099";

const STOP_SUBMITTED_1 = "60000000-0000-4000-8000-000000000011";
const STOP_INPROG_1_DONE = "60000000-0000-4000-8000-000000000012";
const STOP_INPROG_2_ACTIVE = "60000000-0000-4000-8000-000000000013";
const STOP_COMPLETED_1 = "60000000-0000-4000-8000-000000000014";
const STOP_CHANGES_1 = "60000000-0000-4000-8000-000000000015";
const STOP_ORG_B_1 = "60000000-0000-4000-8000-000000000099";

const VISIT_INPROG_STOP1_DONE = "70000000-0000-4000-8000-000000000012";
const VISIT_INPROG_STOP2_ACTIVE = "70000000-0000-4000-8000-000000000013";
const VISIT_COMPLETED_STOP1 = "70000000-0000-4000-8000-000000000014";
const VISIT_ORG_B = "70000000-0000-4000-8000-000000000099";

function setupReportingFixtures() {
  const tenancyRepository = new InMemoryTenancyRepo();
  tenancyRepository.organizations.push(
    {
      id: ORG_A_ID,
      name: "Acme Retail North",
      slug: "acme-retail-north",
      status: "active",
      createdBy: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: ORG_B_ID,
      name: "Beta FMCG South",
      slug: "beta-fmcg-south",
      status: "active",
      createdBy: MANAGER_B.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    }
  );

  tenancyRepository.memberships.push(
    {
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_A_ID,
      userId: MANAGER_A.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_A1.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_A2.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      orgId: ORG_B_ID,
      userId: MANAGER_B.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    }
  );

  const capturedLocation = buildUnverifiedDeviceLocation({
    lat: 41.8837,
    lng: -87.6324,
    accuracyMeters: 10.5,
    status: "captured_unverified",
  });
  const deniedLocation = buildUnverifiedDeviceLocation({
    lat: null,
    lng: null,
    accuracyMeters: null,
    status: "permission_denied",
  });

  const dataset: OrgOperationalDataset = {
    stores: [
      {
        id: STORE_A1_ID,
        orgId: ORG_A_ID,
        name: "Downtown Fresh Mart #101",
        region: "North-Central",
        addressLine1: "120 Main St",
        addressLine2: null,
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60601",
        countryCode: "US",
        latitude: 41.8837,
        longitude: -87.6324,
        active: true,
        createdAt: "2026-10-20T08:00:00.000Z",
        updatedAt: "2026-10-20T08:00:00.000Z",
      },
      {
        id: STORE_A2_ID,
        orgId: ORG_A_ID,
        name: "Lakeside Supercenter #204",
        region: "North-East",
        addressLine1: "850 Lake Shore Dr",
        addressLine2: null,
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60611",
        countryCode: "US",
        latitude: 41.8975,
        longitude: -87.6196,
        active: true,
        createdAt: "2026-10-20T08:00:00.000Z",
        updatedAt: "2026-10-20T08:00:00.000Z",
      },
      {
        id: STORE_B1_ID,
        orgId: ORG_B_ID,
        name: "Beta Sunbelt Grocers #12",
        region: "South-West",
        addressLine1: "400 Congress Ave",
        addressLine2: null,
        city: "Austin",
        stateProvince: "TX",
        postalCode: "78701",
        countryCode: "US",
        latitude: 30.2672,
        longitude: -97.7431,
        active: true,
        createdAt: "2026-10-20T08:00:00.000Z",
        updatedAt: "2026-10-20T08:00:00.000Z",
      },
    ],
    trips: [
      {
        id: TRIP_SUBMITTED_A,
        orgId: ORG_A_ID,
        ownerUserId: EMPLOYEE_A1.id,
        title: "Submitted Route Awaiting Review",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        purpose: "Endcap audit",
        status: "submitted",
        submittedAt: "2026-10-22T08:00:00.000Z",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        createdAt: "2026-10-22T07:00:00.000Z",
        updatedAt: "2026-10-22T08:00:00.000Z",
      },
      {
        id: TRIP_APPROVED_IN_PROGRESS_A,
        orgId: ORG_A_ID,
        ownerUserId: EMPLOYEE_A1.id,
        title: "Active Field Route",
        startDate: "2026-10-22",
        endDate: "2026-10-23",
        purpose: "Beverage reset",
        status: "in_progress",
        submittedAt: "2026-10-21T08:00:00.000Z",
        decidedBy: MANAGER_A.id,
        decidedAt: "2026-10-21T09:00:00.000Z",
        decisionNote: "Approved",
        createdAt: "2026-10-21T07:00:00.000Z",
        updatedAt: "2026-10-22T09:00:00.000Z",
      },
      {
        id: TRIP_COMPLETED_A,
        orgId: ORG_A_ID,
        ownerUserId: EMPLOYEE_A2.id,
        title: "Completed Evanston Audit",
        startDate: "2026-10-20",
        endDate: "2026-10-20",
        purpose: "Weekly stock check",
        status: "completed",
        submittedAt: "2026-10-19T08:00:00.000Z",
        decidedBy: MANAGER_A.id,
        decidedAt: "2026-10-19T09:00:00.000Z",
        decisionNote: "Approved",
        createdAt: "2026-10-19T07:00:00.000Z",
        updatedAt: "2026-10-20T17:00:00.000Z",
      },
      {
        id: TRIP_CHANGES_REQUESTED_A,
        orgId: ORG_A_ID,
        ownerUserId: EMPLOYEE_A2.id,
        title: "=SUM(1,2) Formula Injected Title",
        startDate: "2026-10-24",
        endDate: "2026-10-24",
        purpose: "Needs stop reorder",
        status: "changes_requested",
        submittedAt: "2026-10-21T10:00:00.000Z",
        decidedBy: MANAGER_A.id,
        decidedAt: "2026-10-21T11:00:00.000Z",
        decisionNote: "Please reorder stops",
        createdAt: "2026-10-21T09:00:00.000Z",
        updatedAt: "2026-10-21T11:00:00.000Z",
      },
      {
        id: TRIP_ORG_B,
        orgId: ORG_B_ID,
        ownerUserId: MANAGER_B.id,
        title: "Org B Confidential Route",
        startDate: "2026-10-22",
        endDate: "2026-10-23",
        purpose: "Org B only",
        status: "submitted",
        submittedAt: "2026-10-22T08:00:00.000Z",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        createdAt: "2026-10-22T07:00:00.000Z",
        updatedAt: "2026-10-22T08:00:00.000Z",
      },
    ],
    tripStops: [
      {
        id: STOP_SUBMITTED_1,
        orgId: ORG_A_ID,
        tripId: TRIP_SUBMITTED_A,
        storeId: STORE_A1_ID,
        sequenceNumber: 1,
        plannedAt: "2026-10-25T09:00:00.000Z",
        status: "planned",
        createdAt: "2026-10-22T07:00:00.000Z",
        updatedAt: "2026-10-22T07:00:00.000Z",
      },
      {
        id: STOP_INPROG_1_DONE,
        orgId: ORG_A_ID,
        tripId: TRIP_APPROVED_IN_PROGRESS_A,
        storeId: STORE_A1_ID,
        sequenceNumber: 1,
        plannedAt: "2026-10-22T09:00:00.000Z",
        status: "visited",
        createdAt: "2026-10-21T07:00:00.000Z",
        updatedAt: "2026-10-22T10:00:00.000Z",
      },
      {
        id: STOP_INPROG_2_ACTIVE,
        orgId: ORG_A_ID,
        tripId: TRIP_APPROVED_IN_PROGRESS_A,
        storeId: STORE_A2_ID,
        sequenceNumber: 2,
        plannedAt: "2026-10-22T11:00:00.000Z",
        status: "planned",
        createdAt: "2026-10-21T07:00:00.000Z",
        updatedAt: "2026-10-22T11:00:00.000Z",
      },
      {
        id: STOP_COMPLETED_1,
        orgId: ORG_A_ID,
        tripId: TRIP_COMPLETED_A,
        storeId: STORE_A2_ID,
        sequenceNumber: 1,
        plannedAt: "2026-10-20T09:00:00.000Z",
        status: "visited",
        createdAt: "2026-10-19T07:00:00.000Z",
        updatedAt: "2026-10-20T10:00:00.000Z",
      },
      {
        id: STOP_CHANGES_1,
        orgId: ORG_A_ID,
        tripId: TRIP_CHANGES_REQUESTED_A,
        storeId: STORE_A1_ID,
        sequenceNumber: 1,
        plannedAt: "2026-10-24T09:00:00.000Z",
        status: "planned",
        createdAt: "2026-10-21T09:00:00.000Z",
        updatedAt: "2026-10-21T09:00:00.000Z",
      },
      {
        id: STOP_ORG_B_1,
        orgId: ORG_B_ID,
        tripId: TRIP_ORG_B,
        storeId: STORE_B1_ID,
        sequenceNumber: 1,
        plannedAt: "2026-10-22T09:00:00.000Z",
        status: "visited",
        createdAt: "2026-10-22T07:00:00.000Z",
        updatedAt: "2026-10-22T10:00:00.000Z",
      },
    ],
    visits: [
      {
        id: VISIT_INPROG_STOP1_DONE,
        orgId: ORG_A_ID,
        tripStopId: STOP_INPROG_1_DONE,
        employeeUserId: EMPLOYEE_A1.id,
        checkedInAt: "2026-10-22T09:05:00.000Z",
        checkedOutAt: "2026-10-22T09:50:00.000Z",
        checkInLocation: capturedLocation,
        checkOutLocation: capturedLocation,
        checkInIdempotencyKey: "secret-idem-key-1",
        checkOutIdempotencyKey: "secret-idem-key-2",
        notes: "Completed endcap audit cleanly",
        status: "submitted",
        createdAt: "2026-10-22T09:05:00.000Z",
        updatedAt: "2026-10-22T09:50:00.000Z",
      },
      {
        id: VISIT_INPROG_STOP2_ACTIVE,
        orgId: ORG_A_ID,
        tripStopId: STOP_INPROG_2_ACTIVE,
        employeeUserId: EMPLOYEE_A1.id,
        checkedInAt: "2026-10-22T11:10:00.000Z",
        checkedOutAt: null,
        checkInLocation: deniedLocation,
        checkOutLocation: deniedLocation,
        checkInIdempotencyKey: "secret-idem-key-3",
        checkOutIdempotencyKey: null,
        notes: "+cmd|' /C calc'!A0 Malicious note",
        status: "in_progress",
        createdAt: "2026-10-22T11:10:00.000Z",
        updatedAt: "2026-10-22T11:10:00.000Z",
      },
      {
        id: VISIT_COMPLETED_STOP1,
        orgId: ORG_A_ID,
        tripStopId: STOP_COMPLETED_1,
        employeeUserId: EMPLOYEE_A2.id,
        checkedInAt: "2026-10-20T09:02:00.000Z",
        checkedOutAt: "2026-10-20T09:40:00.000Z",
        checkInLocation: capturedLocation,
        checkOutLocation: capturedLocation,
        checkInIdempotencyKey: null,
        checkOutIdempotencyKey: null,
        notes: "All items verified",
        status: "reviewed",
        createdAt: "2026-10-20T09:02:00.000Z",
        updatedAt: "2026-10-20T09:40:00.000Z",
      },
      {
        id: VISIT_ORG_B,
        orgId: ORG_B_ID,
        tripStopId: STOP_ORG_B_1,
        employeeUserId: MANAGER_B.id,
        checkedInAt: "2026-10-22T09:00:00.000Z",
        checkedOutAt: "2026-10-22T09:30:00.000Z",
        checkInLocation: capturedLocation,
        checkOutLocation: capturedLocation,
        checkInIdempotencyKey: null,
        checkOutIdempotencyKey: null,
        notes: "Org B confidential visit",
        status: "submitted",
        createdAt: "2026-10-22T09:00:00.000Z",
        updatedAt: "2026-10-22T09:30:00.000Z",
      },
    ],
    checklistItems: [
      {
        id: "80000000-0000-4000-8000-000000000011",
        orgId: ORG_A_ID,
        visitId: VISIT_INPROG_STOP1_DONE,
        questionKey: "shelf_planogram_compliant",
        label: "Planogram compliant",
        answerType: "boolean",
        answerValue: true,
        answerText: null,
        flagged: false,
        required: true,
        completedAt: "2026-10-22T09:30:00.000Z",
        completedBy: EMPLOYEE_A1.id,
        createdAt: "2026-10-22T09:05:00.000Z",
        updatedAt: "2026-10-22T09:30:00.000Z",
      },
      {
        id: "80000000-0000-4000-8000-000000000012",
        orgId: ORG_A_ID,
        visitId: VISIT_INPROG_STOP2_ACTIVE,
        questionKey: "promo_signage_visible",
        label: "Signage visible",
        answerType: "boolean",
        answerValue: false,
        answerText: "Damaged signage",
        flagged: true, // Flagged exception!
        required: true,
        completedAt: null,
        completedBy: null,
        createdAt: "2026-10-22T11:10:00.000Z",
        updatedAt: "2026-10-22T11:15:00.000Z",
      },
    ],
    evidence: [
      {
        id: "90000000-0000-4000-8000-000000000011",
        orgId: ORG_A_ID,
        visitId: VISIT_INPROG_STOP1_DONE,
        storagePath: `${ORG_A_ID}/${VISIT_INPROG_STOP1_DONE}/99999999-0000-4000-8000-000000000011.jpg`,
        fileType: "image/jpeg",
        fileSize: 245_000,
        caption: "Endcap photo",
        uploadedBy: EMPLOYEE_A1.id,
        idempotencyKey: "secret-evidence-idem",
        createdAt: "2026-10-22T09:35:00.000Z",
      },
    ],
    auditEvents: [],
  };

  const reportingRepository = new InMemoryReportingRepo(dataset);
  return { tenancyRepository, reportingRepository };
}

describe("Manager Dashboard aggregates, server-side filters, planned-vs-actual views, and CSV formula escaping", () => {
  it("computes exact dashboard aggregates matching fixture records and never includes cross-organization records", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    const dashboard = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });

    // Compare dashboard aggregates against Org A fixture records:
    // - tripsAwaitingApproval: 1 (`TRIP_SUBMITTED_A`; Org B's submitted trip is excluded)
    // - approvedTrips: 2 (`TRIP_APPROVED_IN_PROGRESS_A` [inProgress: 1] + `TRIP_COMPLETED_A` [completedAllStopsCheckedOut: 1])
    // - completedVisits: 2 (`VISIT_INPROG_STOP1_DONE` [submitted] + `VISIT_COMPLETED_STOP1` [reviewed])
    // - pendingVisits: 1 (`STOP_INPROG_2_ACTIVE` on `TRIP_APPROVED_IN_PROGRESS_A` is in_progress)
    // - exceptionsRequiringAttention: 2 (`STOP_INPROG_2_ACTIVE` [flagged item + permission_denied] + `STOP_CHANGES_1` [trip status changes_requested])
    expect(dashboard.metrics.tripsAwaitingApproval).toBe(1);
    expect(dashboard.metrics.approvedTrips).toBe(2);
    expect(dashboard.metrics.approvedTripsBreakdown).toEqual({
      approvedNotStarted: 0,
      inProgress: 1,
      completedAllStopsCheckedOut: 1,
    });
    expect(dashboard.metrics.completedVisits).toBe(2);
    expect(dashboard.metrics.pendingVisits).toBe(1);
    expect(dashboard.metrics.exceptionsRequiringAttention).toBe(2);
    expect(dashboard.metrics.tripsByStatus).toEqual({
      draft: 0,
      submitted: 1,
      approved: 0,
      in_progress: 1,
      completed: 1,
      changes_requested: 1,
      rejected: 0,
    });

    // Every metric has a documented definition
    expect(dashboard.metrics.definitions.approvedTrips.completionRuleNote).toContain(
      "100% of its planned stops have a checked-out visit"
    );

    // Verify no Org B record ever appears in Org A's items
    expect(dashboard.items.some((r) => r.tripId === TRIP_ORG_B)).toBe(false);
    expect(dashboard.items).toHaveLength(5);
  });

  it("applies date range (UTC), employee, status, store, and exception filters and enforces role/tenant boundaries", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Field employee is denied from accessing the Manager Dashboard (403)
    await expect(
      getManagerDashboardForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 2. Cross-tenant Manager B is denied from accessing Org A's dashboard (403)
    await expect(
      getManagerDashboardForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ORG_ACCESS",
      status: 403,
    });

    // 3. Filter by employeeUserId (EMPLOYEE_A2) and date range
    const emp2Filtered = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        employeeUserId: EMPLOYEE_A2.id,
        startDateFrom: "2026-10-20",
        startDateTo: "2026-10-24",
      },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });
    expect(emp2Filtered.items).toHaveLength(2);
    expect(emp2Filtered.metrics.completedVisits).toBe(1);
    expect(emp2Filtered.metrics.exceptionsRequiringAttention).toBe(1);

    // 4. Filter by storeId (`STORE_A2_ID`) and `onlyExceptions: true`
    const store2Exceptions = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        storeId: STORE_A2_ID,
        onlyExceptions: "true",
      },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });
    expect(store2Exceptions.items).toHaveLength(1);
    expect(store2Exceptions.items[0]?.tripStopId).toBe(STOP_INPROG_2_ACTIVE);

    // 5. Cursor pagination works across pages
    const page1 = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { limit: 2 },
      tenancyRepository,
      reportingRepository,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).toBeTruthy();

    const page2 = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { limit: 2, cursor: page1.pagination.nextCursor ?? undefined },
      tenancyRepository,
      reportingRepository,
    });
    expect(page2.items).toHaveLength(2);
  });

  it("enforces authorization and unverified location disclosures on Trip and Visit Planned-vs-Actual detail views", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Trip owner (EMPLOYEE_A1) and Manager (MANAGER_A) can view TRIP_APPROVED_IN_PROGRESS_A planned-vs-actual detail
    const tripComparison = await getTripPlannedVsActualForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: TRIP_APPROVED_IN_PROGRESS_A,
      tenancyRepository,
      reportingRepository,
    });
    expect(tripComparison.totalStopCount).toBe(2);
    expect(tripComparison.completedStopCount).toBe(1);
    expect(tripComparison.isCompleteAllStopsCheckedOut).toBe(false);
    expect(tripComparison.locationDisclosure).toContain(
      "unverified device-reported data"
    );

    // 2. Peer employee (EMPLOYEE_A2) is denied from viewing EMPLOYEE_A1's trip or visit detail (403)
    await expect(
      getTripPlannedVsActualForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateTripId: TRIP_APPROVED_IN_PROGRESS_A,
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      getVisitPlannedVsActualForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: VISIT_INPROG_STOP1_DONE,
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 3. Cross-tenant IDs return 404 NOT_FOUND
    await expect(
      getVisitPlannedVsActualForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: VISIT_ORG_B,
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    // 4. Manager A can inspect VISIT_INPROG_STOP1_DONE planned vs actual detail
    const visitDetail = await getVisitPlannedVsActualForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: VISIT_INPROG_STOP1_DONE,
      tenancyRepository,
      reportingRepository,
    });
    expect(visitDetail.requiredChecklistCompletedCount).toBe(1);
    expect(visitDetail.requiredChecklistTotalCount).toBe(1);
    expect(visitDetail.evidence).toHaveLength(1);
    expect(visitDetail.visit.checkInLocation.verificationNotice).toBe(
      "unverified_device_reported"
    );
  });

  it("exports authorized CSV result sets, escapes spreadsheet formula prefixes, excludes secrets/internal keys, and handles empty datasets", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Unit-test formula injection escaping directly
    expect(sanitizeAndQuoteCsvText("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeAndQuoteCsvText("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeAndQuoteCsvText("-2+3+cmd|' /C calc'!A0")).toBe(
      "'-2+3+cmd|' /C calc'!A0"
    );
    expect(sanitizeAndQuoteCsvText("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
    expect(sanitizeAndQuoteCsvText("@SUM(A1:A5)")).toBe("'@SUM(A1:A5)");
    expect(sanitizeAndQuoteCsvText('  =HYPERLINK("http://evil")')).toBe(
      '"\'  =HYPERLINK(""http://evil"")"'
    );

    // 2. Export Org A CSV as Manager A
    const exported = await exportManagerReportCsvForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });

    expect(exported.rowCount).toBe(5);
    expect(exported.csv).toContain(MANAGER_REPORT_CSV_HEADERS.join(","));

    // Formula-injected trip title `=SUM(1,2) Formula Injected Title` and visit note `+cmd|' /C calc'!A0 Malicious note` are escaped with leading `'`
    expect(exported.csv).toContain("'=SUM(1,2) Formula Injected Title");
    expect(exported.csv).toContain("'+cmd|' /C calc'!A0 Malicious note");

    // Never exports Org B data or internal idempotency keys / storage paths
    expect(exported.csv).not.toContain("Org B Confidential Route");
    expect(exported.csv).not.toContain("secret-idem-key-1");
    expect(exported.csv).not.toContain("secret-evidence-idem");

    // 3. Empty dataset returns header line only with 0 rows
    const emptyExport = await exportManagerReportCsvForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        startDateFrom: "2030-01-01",
        startDateTo: "2030-01-02",
      },
      tenancyRepository,
      reportingRepository,
    });
    expect(emptyExport.rowCount).toBe(0);
    expect(emptyExport.csv).toBe(`${MANAGER_REPORT_CSV_HEADERS.join(",")}\r\n`);
    expect(buildManagerReportCsv([])).toBe(`${MANAGER_REPORT_CSV_HEADERS.join(",")}\r\n`);
  });

  it("verifies operational metric correctness across filter permutations (onlyExceptions, tripStatus, visitStatus)", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Filter by onlyExceptions: true
    const exceptionsOnly = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { onlyExceptions: "true" },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });

    expect(exceptionsOnly.metrics.tripsAwaitingApproval).toBe(0);
    expect(exceptionsOnly.metrics.approvedTrips).toBe(1);
    expect(exceptionsOnly.metrics.approvedTripsBreakdown).toEqual({
      approvedNotStarted: 0,
      inProgress: 1,
      completedAllStopsCheckedOut: 0,
    });
    expect(exceptionsOnly.metrics.completedVisits).toBe(0);
    expect(exceptionsOnly.metrics.pendingVisits).toBe(1);
    expect(exceptionsOnly.metrics.exceptionsRequiringAttention).toBe(2);
    expect(exceptionsOnly.metrics.tripsByStatus).toEqual({
      draft: 0,
      submitted: 0,
      approved: 0,
      in_progress: 1,
      completed: 0,
      changes_requested: 1,
      rejected: 0,
    });
    expect(exceptionsOnly.items).toHaveLength(2);
    expect(exceptionsOnly.items.every((r) => r.requiresAttention)).toBe(true);

    // 2. Filter by tripStatus: "submitted"
    const submittedOnly = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { tripStatus: "submitted" },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });

    expect(submittedOnly.metrics.tripsAwaitingApproval).toBe(1);
    expect(submittedOnly.metrics.approvedTrips).toBe(0);
    expect(submittedOnly.metrics.completedVisits).toBe(0);
    expect(submittedOnly.metrics.pendingVisits).toBe(0);
    expect(submittedOnly.metrics.tripsByStatus.submitted).toBe(1);
    expect(submittedOnly.items).toHaveLength(1);
    expect(submittedOnly.items[0]?.tripStatus).toBe("submitted");

    // 3. Filter by visitStatus: "submitted"
    const visitedSubmittedOnly = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { visitStatus: "submitted" },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });
    expect(visitedSubmittedOnly.metrics.completedVisits).toBe(1);
    expect(visitedSubmittedOnly.items).toHaveLength(1);
    expect(visitedSubmittedOnly.items[0]?.actualVisitStatus).toBe("submitted");
  });

  it("enforces strict ISO-8601 UTC date boundaries, including exact match, outer exclusion, overdue trip calculation, and inverted range rejection", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Exact date boundary match on start date
    const exactDate = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        startDateFrom: "2026-10-22",
        startDateTo: "2026-10-22",
      },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-22T12:00:00.000Z"),
    });
    expect(exactDate.items).toHaveLength(2);
    expect(exactDate.items.every((r) => r.tripStartDate === "2026-10-22")).toBe(true);

    // 2. Outer boundary: trips starting before startDateFrom are excluded
    const laterBound = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        startDateFrom: "2026-10-25",
      },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-25T12:00:00.000Z"),
    });
    expect(laterBound.items).toHaveLength(1);
    expect(laterBound.items[0]?.tripId).toBe(TRIP_SUBMITTED_A);

    // 3. Inverted date range (startDateTo < startDateFrom) throws validation error
    await expect(
      getManagerDashboardForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        rawQuery: {
          startDateFrom: "2026-10-25",
          startDateTo: "2026-10-20",
        },
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toThrow();

    // 4. Overdue calculation: trip end_date passed without completed checkout
    // When now is 2026-10-24, TRIP_APPROVED_IN_PROGRESS_A (end_date: 2026-10-23) is overdue
    const overdueDashboard = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        storeId: STORE_A2_ID,
      },
      tenancyRepository,
      reportingRepository,
      now: new Date("2026-10-24T12:00:00.000Z"),
    });
    const overdueStop = overdueDashboard.items.find(
      (r) => r.tripStopId === STOP_INPROG_2_ACTIVE
    );
    expect(overdueStop?.requiresAttention).toBe(true);
    expect(overdueStop?.attentionReasons.some((r) => r.includes("Overdue stop"))).toBe(
      true
    );
  });

  it("validates comprehensive OWASP formula injection prefix escaping and RFC 4180 export formatting", () => {
    // Escaping of all formula characters: =, +, -, @
    expect(sanitizeAndQuoteCsvText("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeAndQuoteCsvText("+1234")).toBe("'+1234");
    expect(sanitizeAndQuoteCsvText("-5678")).toBe("'-5678");
    expect(sanitizeAndQuoteCsvText("@SUM(A1:A5)")).toBe("'@SUM(A1:A5)");

    // Leading whitespace before formula characters
    expect(sanitizeAndQuoteCsvText("   =SUM(1,2)")).toBe('"\'   =SUM(1,2)"');
    expect(sanitizeAndQuoteCsvText("  +test")).toBe("'  +test");
    expect(sanitizeAndQuoteCsvText("  +test, with comma")).toBe(
      '"\'  +test, with comma"'
    );
    expect(sanitizeAndQuoteCsvText(" \t=evil")).toBe("' \t=evil");

    // Leading tab and carriage return characters
    expect(sanitizeAndQuoteCsvText("\tdata")).toBe("'\tdata");
    expect(sanitizeAndQuoteCsvText("\rdata")).toBe('"\'\rdata"');
    expect(sanitizeAndQuoteCsvText("  \tdata")).toBe("'  \tdata");

    // Quotes and commas per RFC 4180
    expect(sanitizeAndQuoteCsvText('Store "Flagship", North')).toBe(
      '"Store ""Flagship"", North"'
    );
    expect(sanitizeAndQuoteCsvText("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');

    // Safe regular text and null/empty
    expect(sanitizeAndQuoteCsvText("Chicago Downtown")).toBe("Chicago Downtown");
    expect(sanitizeAndQuoteCsvText("")).toBe("");
    expect(sanitizeAndQuoteCsvText(null)).toBe("");
    expect(sanitizeAndQuoteCsvText(undefined)).toBe("");
  });

  it("enforces organization isolation and role permissions across all dashboard, export, and comparison endpoints", async () => {
    const { tenancyRepository, reportingRepository } = setupReportingFixtures();

    // 1. Unauthenticated requests fail with 401
    await expect(
      getManagerDashboardForOrg({
        user: null,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    await expect(
      exportManagerReportCsvForOrg({
        user: null,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    // 2. Field rep is denied from CSV export with 403
    await expect(
      exportManagerReportCsvForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 3. Cross-tenant manager is denied from CSV export with 403
    await expect(
      exportManagerReportCsvForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ORG_ACCESS",
      status: 403,
    });

    // 4. Cross-tenant user requesting non-existent trip in active org returns 404
    await expect(
      getTripPlannedVsActualForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: TRIP_ORG_B,
        tenancyRepository,
        reportingRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("handles completely empty operational datasets safely with zeroed metrics, empty collections, and header-only CSV", async () => {
    const tenancyRepository = new InMemoryTenancyRepo();
    tenancyRepository.organizations.push({
      id: ORG_A_ID,
      name: "Empty Org",
      slug: "empty-org",
      status: "active",
      createdBy: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    });
    tenancyRepository.memberships.push({
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_A_ID,
      userId: MANAGER_A.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    });

    const emptyDataset: OrgOperationalDataset = {
      stores: [],
      trips: [],
      tripStops: [],
      visits: [],
      checklistItems: [],
      evidence: [],
      auditEvents: [],
    };

    const emptyReportingRepo = new InMemoryReportingRepo(emptyDataset);

    const dashboard = await getManagerDashboardForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      reportingRepository: emptyReportingRepo,
    });

    expect(dashboard.metrics.tripsAwaitingApproval).toBe(0);
    expect(dashboard.metrics.approvedTrips).toBe(0);
    expect(dashboard.metrics.approvedTripsBreakdown).toEqual({
      approvedNotStarted: 0,
      inProgress: 0,
      completedAllStopsCheckedOut: 0,
    });
    expect(dashboard.metrics.tripsByStatus).toEqual({
      draft: 0,
      submitted: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
      changes_requested: 0,
      rejected: 0,
    });
    expect(dashboard.metrics.completedVisits).toBe(0);
    expect(dashboard.metrics.pendingVisits).toBe(0);
    expect(dashboard.metrics.exceptionsRequiringAttention).toBe(0);
    expect(dashboard.items).toEqual([]);
    expect(dashboard.pagination.hasMore).toBe(false);
    expect(dashboard.pagination.nextCursor).toBeNull();

    const emptyExport = await exportManagerReportCsvForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      reportingRepository: emptyReportingRepo,
    });

    expect(emptyExport.rowCount).toBe(0);
    expect(emptyExport.csv).toBe(`${MANAGER_REPORT_CSV_HEADERS.join(",")}\r\n`);
  });
});
