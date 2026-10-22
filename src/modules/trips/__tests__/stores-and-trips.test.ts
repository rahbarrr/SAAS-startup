import { describe, expect, it } from "vitest";
import { AppError, decodeCursor, encodeCursor } from "@/lib/http/envelope";
import type { Store } from "@/modules/stores/domain";
import type {
  PaginatedStoresResult,
  StoresRepository,
} from "@/modules/stores/repository";
import type {
  CreateStoreInput,
  ListStoresQuery,
  UpdateStoreInput,
} from "@/modules/stores/schemas";
import {
  archiveStoreForOrg,
  createStoreForOrg,
  getStoreForOrg,
  listStoresForOrg,
  updateStoreForOrg,
} from "@/modules/stores/service";
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
import {
  buildEmployeeDecisionHistory,
  type Trip,
  type TripAuditEvent,
  type TripAuditEventType,
  type TripDetail,
  type TripStatus,
  type TripStop,
} from "@/modules/trips/domain";
import type {
  ListTripsRepositoryFilter,
  PaginatedTripsResult,
  TripsRepository,
} from "@/modules/trips/repository";
import type { UpsertTripDraftInput } from "@/modules/trips/schemas";
import {
  createTripDraftForOrg,
  decideTripForOrg,
  getTripDetailForOrg,
  listManagerApprovalInboxForOrg,
  listTripsForOrg,
  submitTripForApproval,
  updateTripDraftForOrg,
} from "@/modules/trips/service";

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
    throw new Error("Not used in this suite");
  }

  async listOrgMembers(
    _orgId: string,
    _query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    throw new Error("Not used in this suite");
  }

  async addOrgMember(
    _orgId: string,
    _input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    throw new Error("Not used in this suite");
  }

  async createOrgInvitation(
    _input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    throw new Error("Not used in this suite");
  }

  async acceptOrgInvitationByTokenHash(): Promise<OrganizationMembership> {
    throw new Error("Not used in this suite");
  }
}

class InMemoryStoresRepo implements StoresRepository {
  public stores: Store[] = [];
  private seq = 10;

  async listStores(
    orgId: string,
    query: ListStoresQuery
  ): Promise<PaginatedStoresResult> {
    let filtered = this.stores
      .filter((s) => s.orgId === orgId)
      .filter((s) => (query.region ? s.region === query.region : true))
      .filter((s) => (query.active !== undefined ? s.active === query.active : true))
      .filter((s) => {
        if (!query.search) return true;
        const q = query.search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      filtered = filtered.filter(
        (s) => s.createdAt < c.createdAt || (s.createdAt === c.createdAt && s.id < c.id)
      );
    }

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;
    const last = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: query.limit,
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  async getStoreById(orgId: string, storeId: string): Promise<Store | null> {
    return this.stores.find((s) => s.orgId === orgId && s.id === storeId) ?? null;
  }

  async getStoresByIds(orgId: string, storeIds: readonly string[]): Promise<Store[]> {
    const idSet = new Set(storeIds);
    return this.stores.filter((s) => s.orgId === orgId && idSet.has(s.id));
  }

  async createStore(orgId: string, input: CreateStoreInput): Promise<Store> {
    this.seq += 1;
    const now = `2026-10-22T10:${String(this.seq).padStart(2, "0")}:00.000Z`;
    const created: Store = {
      id: `40000000-0000-4000-8000-0000000000${this.seq}`,
      orgId,
      name: input.name,
      region: input.region,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 ?? null,
      city: input.city,
      stateProvince: input.stateProvince ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.stores.push(created);
    return created;
  }

  async updateStore(
    orgId: string,
    storeId: string,
    input: UpdateStoreInput
  ): Promise<Store> {
    const existing = await this.getStoreById(orgId, storeId);
    if (!existing) {
      throw new Error("Store missing");
    }
    if (input.name !== undefined) existing.name = input.name;
    if (input.region !== undefined) existing.region = input.region;
    if (input.addressLine1 !== undefined) existing.addressLine1 = input.addressLine1;
    if (input.city !== undefined) existing.city = input.city;
    if (input.latitude !== undefined) existing.latitude = input.latitude;
    if (input.longitude !== undefined) existing.longitude = input.longitude;
    if (input.active !== undefined) existing.active = input.active;
    existing.updatedAt = "2026-10-22T12:00:00.000Z";
    return existing;
  }
}

class InMemoryTripsRepo implements TripsRepository {
  public trips: Trip[] = [];
  public stops: TripStop[] = [];
  public auditEvents: TripAuditEvent[] = [];
  private seq = 10;

  async listTrips(
    orgId: string,
    query: ListTripsRepositoryFilter
  ): Promise<PaginatedTripsResult> {
    const filtered = this.trips
      .filter((t) => t.orgId === orgId)
      .filter((t) => (query.status ? t.status === query.status : true))
      .filter((t) => (query.ownerUserId ? t.ownerUserId === query.ownerUserId : true))
      .filter((t) =>
        query.excludeOwnerUserId ? t.ownerUserId !== query.excludeOwnerUserId : true
      )
      .filter((t) => (query.startDateFrom ? t.startDate >= query.startDateFrom : true))
      .filter((t) => (query.startDateTo ? t.startDate <= query.startDateTo : true))
      .filter((t) => {
        if (!query.search) return true;
        const q = query.search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.purpose.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;
    const last = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: query.limit,
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  async getTripDetail(orgId: string, tripId: string): Promise<TripDetail | null> {
    const trip = this.trips.find((t) => t.orgId === orgId && t.id === tripId);
    if (!trip) return null;

    const stops = this.stops
      .filter((s) => s.orgId === orgId && s.tripId === tripId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    const auditEvents = this.auditEvents.filter(
      (e) => e.orgId === orgId && e.tripId === tripId
    );

    return { trip, stops, auditEvents };
  }

  async createTripDraftWithStops(params: {
    orgId: string;
    ownerUserId: string;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail> {
    this.seq += 1;
    const now = `2026-10-22T11:${String(this.seq).padStart(2, "0")}:00.000Z`;
    const trip: Trip = {
      id: `50000000-0000-4000-8000-0000000000${this.seq}`,
      orgId: params.orgId,
      ownerUserId: params.ownerUserId,
      title: params.input.title,
      purpose: params.input.purpose,
      startDate: params.input.startDate,
      endDate: params.input.endDate,
      status: "draft",
      submittedAt: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: now,
      updatedAt: now,
    };
    this.trips.push(trip);

    const createdStops: TripStop[] = params.input.stops.map((s, idx) => ({
      id: `60000000-0000-4000-8000-000000000${this.seq}${idx}`,
      orgId: params.orgId,
      tripId: trip.id,
      storeId: s.storeId,
      sequenceNumber: s.sequenceNumber,
      plannedAt: s.plannedAt ?? null,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    }));
    this.stops.push(...createdStops);

    const audit: TripAuditEvent = {
      id: `a0000000-0000-4000-8000-0000000000${this.seq}`,
      orgId: params.orgId,
      tripId: trip.id,
      actorUserId: params.ownerUserId,
      eventType: "trip_created",
      oldStatus: null,
      newStatus: "draft",
      note: "Created trip draft",
      metadata: { stop_count: createdStops.length },
      createdAt: now,
    };
    this.auditEvents.push(audit);

    return { trip, stops: createdStops, auditEvents: [audit] };
  }

  async updateTripDraftWithStops(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    previousStatus: TripStatus;
    previousDecidedBy: string | null;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail> {
    const trip = this.trips.find(
      (t) => t.orgId === params.orgId && t.id === params.tripId
    );
    if (!trip) throw new Error("Missing trip");

    this.seq += 1;
    const now = `2026-10-22T12:${String(this.seq).padStart(2, "0")}:00.000Z`;

    trip.title = params.input.title;
    trip.purpose = params.input.purpose;
    trip.startDate = params.input.startDate;
    trip.endDate = params.input.endDate;
    trip.updatedAt = now;

    if (params.previousStatus === "approved") {
      trip.status = "draft";
      trip.submittedAt = null;
      trip.decidedBy = null;
      trip.decidedAt = null;
      trip.decisionNote = null;

      this.auditEvents.push({
        id: `a0000000-0000-4000-8000-0000000000${this.seq}`,
        orgId: params.orgId,
        tripId: trip.id,
        actorUserId: params.actorUserId,
        eventType: "trip_reopened_for_edit",
        oldStatus: "approved",
        newStatus: "draft",
        note: "Approved trip edited by owner; reset to draft for re-approval",
        metadata: {
          stop_count: params.input.stops.length,
          ...(params.previousDecidedBy
            ? { previous_decided_by: params.previousDecidedBy }
            : {}),
        },
        createdAt: now,
      });
    } else {
      this.auditEvents.push({
        id: `a0000000-0000-4000-8000-0000000000${this.seq}`,
        orgId: params.orgId,
        tripId: trip.id,
        actorUserId: params.actorUserId,
        eventType: "trip_updated",
        oldStatus: params.previousStatus,
        newStatus: params.previousStatus,
        note: "Updated trip plan details and stops",
        metadata: {
          stop_count: params.input.stops.length,
        },
        createdAt: now,
      });
    }

    this.stops = this.stops.filter(
      (s) => !(s.orgId === params.orgId && s.tripId === params.tripId)
    );
    const nextStops: TripStop[] = params.input.stops.map((s, idx) => ({
      id: `60000000-0000-4000-8000-000000000${this.seq}${idx}`,
      orgId: params.orgId,
      tripId: trip.id,
      storeId: s.storeId,
      sequenceNumber: s.sequenceNumber,
      plannedAt: s.plannedAt ?? null,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    }));
    this.stops.push(...nextStops);

    const detail = await this.getTripDetail(params.orgId, params.tripId);
    if (!detail) throw new Error("Missing trip detail");
    return detail;
  }

  async transitionTripStatusWithAudit(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    oldStatus: TripStatus;
    newStatus: TripStatus;
    eventType: TripAuditEventType;
    submittedAt?: string | null;
    expectedSubmittedAt?: string | null;
    decidedBy?: string | null;
    decidedAt?: string | null;
    decisionNote?: string | null;
    auditNote: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TripDetail> {
    const trip = this.trips.find(
      (t) =>
        t.orgId === params.orgId &&
        t.id === params.tripId &&
        t.status === params.oldStatus &&
        (!params.expectedSubmittedAt || t.submittedAt === params.expectedSubmittedAt) &&
        (!params.decidedBy || t.ownerUserId !== params.decidedBy)
    );
    if (!trip) {
      throw new AppError(
        "CONFLICT",
        "Trip status has already changed or was decided by another reviewer.",
        409
      );
    }

    this.seq += 1;
    const now = `2026-10-22T13:${String(this.seq).padStart(2, "0")}:00.000Z`;
    trip.status = params.newStatus;
    if (params.submittedAt !== undefined) trip.submittedAt = params.submittedAt;
    if (params.decidedBy !== undefined) trip.decidedBy = params.decidedBy;
    if (params.decidedAt !== undefined) trip.decidedAt = params.decidedAt;
    if (params.decisionNote !== undefined) trip.decisionNote = params.decisionNote;
    trip.updatedAt = now;

    this.auditEvents.push({
      id: `a0000000-0000-4000-8000-0000000000${this.seq}`,
      orgId: params.orgId,
      tripId: trip.id,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      note: params.auditNote,
      metadata: params.metadata ?? {},
      createdAt: now,
    });

    const detail = await this.getTripDetail(params.orgId, params.tripId);
    if (!detail) throw new Error("Missing trip detail");
    return detail;
  }
}

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ADMIN_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "alice.admin@acme.local",
};
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

function setupFixtures() {
  const tenancyRepository = new InMemoryTenancyRepo();
  const storesRepository = new InMemoryStoresRepo();
  const tripsRepository = new InMemoryTripsRepo();

  tenancyRepository.organizations.push(
    {
      id: ORG_A_ID,
      name: "Acme Retail North",
      slug: "acme-retail-north",
      status: "active",
      createdBy: ADMIN_A.id,
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
      id: "30000000-0000-4000-8000-000000000001",
      orgId: ORG_A_ID,
      userId: ADMIN_A.id,
      role: "admin",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_A_ID,
      userId: MANAGER_A.id,
      role: "manager",
      status: "active",
      managerUserId: ADMIN_A.id,
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

  storesRepository.stores.push(
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
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:00:00.000Z",
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
      createdAt: "2026-10-20T09:05:00.000Z",
      updatedAt: "2026-10-20T09:05:00.000Z",
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
      createdAt: "2026-10-20T09:10:00.000Z",
      updatedAt: "2026-10-20T09:10:00.000Z",
    }
  );

  return { tenancyRepository, storesRepository, tripsRepository };
}

describe("Stores workflow: validation, search, archive, and tenant isolation", () => {
  it("allows managers/admins to create, edit, and archive stores, and denies field employees from mutating stores", async () => {
    const { tenancyRepository, storesRepository } = setupFixtures();

    const created = await createStoreForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        name: "West Loop Grocers #305",
        region: "North-West",
        addressLine1: "500 Fulton Market",
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60607",
        countryCode: "US",
        latitude: 41.8868,
        longitude: -87.6475,
      },
      tenancyRepository,
      storesRepository,
    });

    expect(created.name).toBe("West Loop Grocers #305");
    expect(created.active).toBe(true);

    // Field employee can list & search stores in their org
    const listed = await listStoresForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawQuery: { search: "West Loop" },
      tenancyRepository,
      storesRepository,
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(created.id);

    // Field employee is denied from creating or archiving stores
    await expect(
      createStoreForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          name: "Unauthorized Store",
          region: "North",
          addressLine1: "1 Main St",
          city: "Chicago",
        },
        tenancyRepository,
        storesRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // Manager can archive store
    const archived = await archiveStoreForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateStoreId: created.id,
      tenancyRepository,
      storesRepository,
    });
    expect(archived.active).toBe(false);
  });

  it("validates store coordinates and required fields at the boundary (DENIED)", async () => {
    const { tenancyRepository, storesRepository } = setupFixtures();

    // Rejects latitude without longitude
    await expect(
      createStoreForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          name: "Half Coordinate Store",
          region: "North",
          addressLine1: "100 State St",
          city: "Chicago",
          latitude: 41.88,
        },
        tenancyRepository,
        storesRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // Rejects out-of-range latitude (> 90)
    await expect(
      createStoreForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          name: "Invalid Lat Store",
          region: "North",
          addressLine1: "100 State St",
          city: "Chicago",
          latitude: 95.5,
          longitude: -87.6,
        },
        tenancyRepository,
        storesRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");
  });

  it("never exposes a store from another organization (returns 404 NOT_FOUND)", async () => {
    const { tenancyRepository, storesRepository } = setupFixtures();

    await expect(
      getStoreForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateStoreId: STORE_B1_ID, // Belongs to Org B
        tenancyRepository,
        storesRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    await expect(
      updateStoreForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateStoreId: STORE_B1_ID,
        rawInput: { name: "Cross-Tenant Edit Attempt" },
        tenancyRepository,
        storesRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("Trips workflow: date validation, stop ordering, active stores, status transitions, and authorization", () => {
  it("validates date range, duplicate stops, contiguous stop sequence, and active same-org stores", async () => {
    const { tenancyRepository, storesRepository, tripsRepository } = setupFixtures();

    // 1. Rejects endDate < startDate
    await expect(
      createTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          title: "Inverted Dates Trip",
          startDate: "2026-10-28",
          endDate: "2026-10-25",
          stops: [],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 2. Rejects duplicate storeId in stops
    await expect(
      createTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          title: "Duplicate Stop Trip",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [
            { storeId: STORE_A1_ID, sequenceNumber: 1 },
            { storeId: STORE_A1_ID, sequenceNumber: 2 },
          ],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 3. Rejects non-contiguous stop sequence numbers (e.g. [1, 3])
    await expect(
      createTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          title: "Gapped Sequence Trip",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [
            { storeId: STORE_A1_ID, sequenceNumber: 1 },
            { storeId: STORE_A2_ID, sequenceNumber: 3 },
          ],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 4. Rejects stop referencing a store from another organization (Org B)
    await expect(
      createTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          title: "Cross-Org Store Trip",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [{ storeId: STORE_B1_ID, sequenceNumber: 1 }],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    // 5. Rejects stop referencing an archived store
    await archiveStoreForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateStoreId: STORE_A2_ID,
      tenancyRepository,
      storesRepository,
    });

    await expect(
      createTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          title: "Archived Store Trip",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [{ storeId: STORE_A2_ID, sequenceNumber: 1 }],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("enforces full lifecycle: draft -> submitted -> changes_requested -> edited & resubmitted -> approved -> edited (reopened to draft) with preserved audit trail", async () => {
    const { tenancyRepository, storesRepository, tripsRepository } = setupFixtures();

    // 1. Employee creates draft trip with 2 ordered stops
    const draft = await createTripDraftForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        title: "North Territory Audit",
        purpose: "Shelf compliance check",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        stops: [
          { storeId: STORE_A1_ID, sequenceNumber: 1 },
          { storeId: STORE_A2_ID, sequenceNumber: 2 },
        ],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    expect(draft.trip.status).toBe("draft");
    expect(draft.stops.map((s) => s.storeId)).toEqual([STORE_A1_ID, STORE_A2_ID]);
    expect(draft.auditEvents).toHaveLength(1);
    expect(draft.auditEvents[0]?.eventType).toBe("trip_created");

    // 2. Invalid jump: Manager cannot decide a trip while it is still a draft
    await expect(
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: draft.trip.id,
        rawInput: { decision: "approved" },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 3. Employee submits trip for approval
    const submitted = await submitTripForApproval({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: { note: "Ready for review" },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });
    expect(submitted.trip.status).toBe("submitted");
    expect(submitted.auditEvents).toHaveLength(2);

    // 4. Duplicate submission is prevented (409 CONFLICT)
    await expect(
      submitTripForApproval({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateTripId: draft.trip.id,
        rawInput: {},
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 5. Editing a trip while it is 'submitted' is blocked (409 CONFLICT)
    await expect(
      updateTripDraftForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateTripId: draft.trip.id,
        rawInput: {
          title: "Attempted Edit While Submitted",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [{ storeId: STORE_A1_ID, sequenceNumber: 1 }],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 6. Manager requests changes (requires decision note)
    const changesRequested = await decideTripForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: {
        decision: "changes_requested",
        note: "Please visit Lakeside Supercenter first before Downtown.",
      },
      tenancyRepository,
      tripsRepository,
    });
    expect(changesRequested.trip.status).toBe("changes_requested");
    expect(changesRequested.trip.decisionNote).toContain("Lakeside Supercenter first");

    // 7. Employee edits the changes_requested trip (reordering stops) and resubmits
    const editedAfterChanges = await updateTripDraftForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: {
        title: "North Territory Audit (Reordered)",
        purpose: "Shelf compliance check",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        stops: [
          { storeId: STORE_A2_ID, sequenceNumber: 1 },
          { storeId: STORE_A1_ID, sequenceNumber: 2 },
        ],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });
    expect(editedAfterChanges.stops.map((s) => s.storeId)).toEqual([
      STORE_A2_ID,
      STORE_A1_ID,
    ]);

    const resubmitted = await submitTripForApproval({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: { note: "Reordered stops per manager feedback" },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });
    expect(resubmitted.trip.status).toBe("submitted");

    // 8. Manager approves the resubmitted trip
    const approved = await decideTripForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: {
        decision: "approved",
        note: "Approved for execution",
      },
      tenancyRepository,
      tripsRepository,
    });
    expect(approved.trip.status).toBe("approved");
    expect(approved.trip.decidedBy).toBe(MANAGER_A.id);

    // 9. Owner edits the approved trip -> resets to 'draft' for a new approval cycle and appends `trip_reopened_for_edit`
    const reopened = await updateTripDraftForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: draft.trip.id,
      rawInput: {
        title: "North Territory Audit (Extended Dates)",
        purpose: "Shelf compliance check",
        startDate: "2026-10-25",
        endDate: "2026-10-27",
        stops: [
          { storeId: STORE_A2_ID, sequenceNumber: 1 },
          { storeId: STORE_A1_ID, sequenceNumber: 2 },
        ],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    expect(reopened.trip.status).toBe("draft");
    expect(reopened.trip.decidedBy).toBeNull();
    expect(reopened.trip.submittedAt).toBeNull();
    expect(reopened.auditEvents.map((e) => e.eventType)).toEqual([
      "trip_created",
      "trip_submitted",
      "trip_changes_requested",
      "trip_updated",
      "trip_resubmitted",
      "trip_approved",
      "trip_reopened_for_edit",
    ]);
  });

  it("enforces manager approval inbox filters, self-approval denial, wrong role/org denial, concurrent decision race protection, and employee decision history", async () => {
    const { tenancyRepository, storesRepository, tripsRepository } = setupFixtures();

    // 1. Fiona (Employee A1) creates and submits a trip
    const fionaDraft = await createTripDraftForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        title: "Fiona Q4 Beverage Reset",
        purpose: "Endcap audit and cooler restock",
        startDate: "2026-10-27",
        endDate: "2026-10-28",
        stops: [{ storeId: STORE_A1_ID, sequenceNumber: 1 }],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    const fionaSubmitted = await submitTripForApproval({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: fionaDraft.trip.id,
      rawInput: {
        note: "Submitting for manager review",
        metadata: { source: "web" },
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
      now: new Date("2026-10-22T09:00:00.000Z"),
    });

    // 2. Marcus (Manager A) also creates and submits his own trip
    const marcusDraft = await createTripDraftForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        title: "Marcus Regional Spot Check",
        purpose: "Quarterly store manager check-in",
        startDate: "2026-11-02",
        endDate: "2026-11-03",
        stops: [{ storeId: STORE_A2_ID, sequenceNumber: 1 }],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    await submitTripForApproval({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateTripId: marcusDraft.trip.id,
      rawInput: { note: "Marcus self-submitted plan" },
      tenancyRepository,
      storesRepository,
      tripsRepository,
      now: new Date("2026-10-22T09:05:00.000Z"),
    });

    // 3. Wrong role denial: Field employee cannot access Manager Approval Inbox or decide a trip
    await expect(
      listManagerApprovalInboxForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      decideTripForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: { decision: "approved" },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 4. Wrong organization denial: Manager B (from Org B) cannot view Org A's inbox or decide Org A's trip
    await expect(
      listManagerApprovalInboxForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ORG_ACCESS",
      status: 403,
    });

    await expect(
      decideTripForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_B_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: { decision: "approved" },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    // 5. Manager Approval Inbox filters: default 'submitted', excludeOwnTrips, search, date range
    const allSubmitted = await listManagerApprovalInboxForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      tripsRepository,
    });
    expect(allSubmitted.items).toHaveLength(2);

    const excludingOwn = await listManagerApprovalInboxForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { excludeOwnTrips: "true" },
      tenancyRepository,
      tripsRepository,
    });
    expect(excludingOwn.items).toHaveLength(1);
    expect(excludingOwn.items[0]?.id).toBe(fionaSubmitted.trip.id);

    const filteredBySearchAndDate = await listManagerApprovalInboxForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        search: "Beverage",
        startDateFrom: "2026-10-25",
        startDateTo: "2026-10-30",
      },
      tenancyRepository,
      tripsRepository,
    });
    expect(filteredBySearchAndDate.items).toHaveLength(1);
    expect(filteredBySearchAndDate.items[0]?.id).toBe(fionaSubmitted.trip.id);

    // 6. Self-approval denial: Manager A cannot approve/reject/request changes on their own submitted trip
    await expect(
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: marcusDraft.trip.id,
        rawInput: { decision: "approved", note: "Trying to self-approve" },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 7. Rejection and change requests require an explanation note (>= 3 chars)
    await expect(
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: { decision: "rejected", note: "  " },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 8. Disallowed metadata keys (e.g. secrets or arbitrary keys) are rejected at the boundary
    await expect(
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: {
          decision: "approved",
          metadata: { secret_token: "do-not-log" },
        },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 9. Stale expectedSubmittedAt timestamp is rejected with 409 CONFLICT
    await expect(
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: {
          decision: "approved",
          expectedSubmittedAt: "2026-10-20T00:00:00.000Z",
        },
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 10. Concurrent / competing decisions: Manager A approves while Admin A concurrently rejects the same trip.
    //     Only the first decision succeeds; the second fails with 409 CONFLICT and cannot overwrite or add a contradictory audit event.
    const [firstOutcome, secondOutcome] = await Promise.allSettled([
      decideTripForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: {
          decision: "approved",
          note: "Approved by Marcus",
          metadata: { source: "web" },
        },
        tenancyRepository,
        tripsRepository,
      }),
      decideTripForOrg({
        user: ADMIN_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: fionaSubmitted.trip.id,
        rawInput: {
          decision: "rejected",
          note: "Concurrent rejection attempt by Alice",
          metadata: { source: "web" },
        },
        tenancyRepository,
        tripsRepository,
      }),
    ]);

    expect(firstOutcome.status).toBe("fulfilled");
    expect(secondOutcome.status).toBe("rejected");
    if (secondOutcome.status === "rejected") {
      expect(secondOutcome.reason).toMatchObject({
        code: "CONFLICT",
        status: 409,
      });
    }

    // Verify final state and employee-facing decision history (in-app only)
    const finalDetail = await getTripDetailForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateTripId: fionaSubmitted.trip.id,
      tenancyRepository,
      tripsRepository,
    });
    expect(finalDetail.trip.status).toBe("approved");
    expect(finalDetail.trip.decidedBy).toBe(MANAGER_A.id);

    const history = buildEmployeeDecisionHistory(finalDetail);
    expect(history.notification.channel).toBe("in_app_only");
    expect(history.notification.currentStatus).toBe("approved");
    expect(history.decisions).toHaveLength(1);
    expect(history.decisions[0]).toMatchObject({
      eventType: "trip_approved",
      decisionStatus: "approved",
      reviewerUserId: MANAGER_A.id,
      note: "Approved by Marcus",
    });
  });

  it("enforces employee visibility scoping, blocks unauthorized edits by other employees or managers, and blocks cross-tenant access", async () => {
    const { tenancyRepository, storesRepository, tripsRepository } = setupFixtures();

    const emp1Trip = await createTripDraftForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        title: "Fiona's Trip",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        stops: [{ storeId: STORE_A1_ID, sequenceNumber: 1 }],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    await createTripDraftForOrg({
      user: EMPLOYEE_A2,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        title: "Evan's Trip",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        stops: [{ storeId: STORE_A2_ID, sequenceNumber: 1 }],
      },
      tenancyRepository,
      storesRepository,
      tripsRepository,
    });

    // Employee A1 only sees their own 1 trip, even if they request Employee A2's ownerUserId
    const emp1List = await listTripsForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawQuery: { ownerUserId: EMPLOYEE_A2.id },
      tenancyRepository,
      tripsRepository,
    });
    expect(emp1List.items).toHaveLength(1);
    expect(emp1List.items[0]?.id).toBe(emp1Trip.trip.id);

    // Manager A sees both trips in Org A
    const managerList = await listTripsForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      tripsRepository,
    });
    expect(managerList.items).toHaveLength(2);

    // Employee A2 cannot view or edit Employee A1's trip
    await expect(
      getTripDetailForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateTripId: emp1Trip.trip.id,
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      updateTripDraftForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateTripId: emp1Trip.trip.id,
        rawInput: {
          title: "Unauthorized Edit by Peer",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [{ storeId: STORE_A1_ID, sequenceNumber: 1 }],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // Manager A can view Employee A1's trip, but cannot edit Employee A1's trip draft/stops directly
    const managerView = await getTripDetailForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateTripId: emp1Trip.trip.id,
      tenancyRepository,
      tripsRepository,
    });
    expect(managerView.trip.id).toBe(emp1Trip.trip.id);

    await expect(
      updateTripDraftForOrg({
        user: MANAGER_A,
        candidateOrgId: ORG_A_ID,
        candidateTripId: emp1Trip.trip.id,
        rawInput: {
          title: "Manager Direct Edit Attempt",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          stops: [{ storeId: STORE_A1_ID, sequenceNumber: 1 }],
        },
        tenancyRepository,
        storesRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // Manager B (Org B) attempting to access Org A's trip via Org B context gets 404 NOT_FOUND
    await expect(
      getTripDetailForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_B_ID,
        candidateTripId: emp1Trip.trip.id,
        tenancyRepository,
        tripsRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
