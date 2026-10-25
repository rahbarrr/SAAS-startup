import { describe, expect, it } from "vitest";
import type {
  InsertAuditEventInput,
  OrganizationAuditEvent,
} from "@/modules/audit/domain";
import type { AuditRepository } from "@/modules/audit/repository";
import type {
  RecordBreadcrumbInput,
  TripLocationBreadcrumb,
} from "@/modules/location/domain";
import type { LocationRepository } from "@/modules/location/repository";
import {
  listTripBreadcrumbs,
  purgeExpiredLocationBreadcrumbsForOrg,
  recordActiveTripBreadcrumb,
} from "@/modules/location/service";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type {
  Trip,
  TripDetail,
  TripStatus,
  TripStop,
} from "@/modules/trips/domain";
import type { TripsRepository } from "@/modules/trips/repository";

class MockLocationRepo implements LocationRepository {
  public breadcrumbs: TripLocationBreadcrumb[] = [];

  async recordBreadcrumb(
    userId: string,
    input: RecordBreadcrumbInput
  ): Promise<TripLocationBreadcrumb> {
    const record: TripLocationBreadcrumb = {
      id: `crumb-${this.breadcrumbs.length + 1}`,
      orgId: input.orgId,
      tripId: input.tripId,
      userId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.breadcrumbs.push(record);
    return record;
  }

  async listBreadcrumbsForTrip(
    orgId: string,
    tripId: string,
    limit = 50
  ): Promise<TripLocationBreadcrumb[]> {
    return this.breadcrumbs
      .filter((b) => b.orgId === orgId && b.tripId === tripId)
      .slice(0, limit);
  }

  async purgeExpiredBreadcrumbs(
    orgId: string,
    _retentionDays = 30
  ): Promise<number> {
    const beforeCount = this.breadcrumbs.length;
    // Simulate purge
    this.breadcrumbs = this.breadcrumbs.filter((b) => b.orgId !== orgId);
    return beforeCount - this.breadcrumbs.length;
  }
}

class MockTripRepo implements Pick<TripsRepository, "getTripDetail"> {
  public trips: Trip[] = [];
  public stops: TripStop[] = [];

  async findTripById(orgId: string, tripId: string): Promise<Trip | null> {
    return this.trips.find((t) => t.orgId === orgId && t.id === tripId) ?? null;
  }

  async getTripDetail(orgId: string, tripId: string): Promise<TripDetail | null> {
    const trip = await this.findTripById(orgId, tripId);
    if (!trip) return null;
    const stops = this.stops.filter((s) => s.tripId === tripId && s.orgId === orgId);
    return { trip, stops, auditEvents: [] };
  }

  async listTrips(): Promise<Trip[]> {
    return this.trips;
  }
  async createTripWithStops(): Promise<never> {
    throw new Error("Not implemented");
  }
  async updateTripDraftWithStops(): Promise<never> {
    throw new Error("Not implemented");
  }
  async submitTrip(): Promise<never> {
    throw new Error("Not implemented");
  }
  async reviewTrip(): Promise<never> {
    throw new Error("Not implemented");
  }
  async updateTripStatus(
    orgId: string,
    tripId: string,
    status: TripStatus
  ): Promise<Trip> {
    const trip = await this.findTripById(orgId, tripId);
    if (!trip) throw new Error("Trip not found");
    trip.status = status;
    return trip;
  }
  async replaceTripStops(): Promise<never> {
    throw new Error("Not implemented");
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
}

class MockAuditRepo implements AuditRepository {
  public events: OrganizationAuditEvent[] = [];
  async insertAuditEvent(input: InsertAuditEventInput): Promise<OrganizationAuditEvent> {
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
      changes: input.changes ?? {},
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }
  async listAuditEvents() {
    return { items: [], pagination: { nextCursor: null, hasMore: false, limit: 25 } };
  }
  async streamAuditEventsForExport() {
    return [];
  }
}

describe("Workstream 4: Controlled, Privacy-Aware Location Tracking", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const repUser: AuthenticatedUser = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "rep@fieldtrack.com",
  };
  const otherRepUser: AuthenticatedUser = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "other@fieldtrack.com",
  };
  const adminUser: AuthenticatedUser = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    email: "admin@fieldtrack.com",
  };

  const activeTrip: Trip = {
    id: "33333333-3333-4333-8333-333333333333",
    orgId,
    ownerUserId: repUser.id,
    title: "Regional Store Audits",
    purpose: "Routine shelf inventory and compliance",
    status: "in_progress",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    createdAt: "2026-10-25T08:00:00.000Z",
    updatedAt: "2026-10-25T08:00:00.000Z",
    submittedAt: "2026-10-25T08:30:00.000Z",
    decidedAt: "2026-10-25T09:00:00.000Z",
    decidedBy: adminUser.id,
    decisionNote: "Approved",
  };

  function setup() {
    const locationRepo = new MockLocationRepo();
    const tripRepo = new MockTripRepo();
    const tenancyRepo = new MockTenancyRepo();
    const auditRepo = new MockAuditRepo();

    tenancyRepo.organizations = [
      {
        id: orgId,
        name: "Enterprise Field Org",
        slug: "field-org",
        status: "active",
        createdBy: adminUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    tenancyRepo.memberships = [
      {
        id: "m-rep",
        orgId,
        userId: repUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: adminUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-other",
        orgId,
        userId: otherRepUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: adminUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-admin",
        orgId,
        userId: adminUser.id,
        role: "admin",
        status: "active",
        managerUserId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    tripRepo.trips = [{ ...activeTrip }];

    return { locationRepo, tripRepo, tenancyRepo, auditRepo };
  }

  describe("Active Trip Location Checkpoints", () => {
    it("successfully records breadcrumb for an in_progress trip owned by the user", async () => {
      const { locationRepo, tripRepo, tenancyRepo } = setup();

      const crumb = await recordActiveTripBreadcrumb({
        user: repUser,
        candidateOrgId: orgId,
        candidateTripId: activeTrip.id,
        rawInput: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracyMeters: 12.5,
          batteryLevel: 0.88,
          isMoving: true,
        },
        tenancyRepository: tenancyRepo,
        tripsRepository: tripRepo,
        locationRepository: locationRepo,
      });

      expect(crumb.id).toBeDefined();
      expect(crumb.latitude).toBe(37.7749);
      expect(crumb.longitude).toBe(-122.4194);
      expect(crumb.accuracyMeters).toBe(12.5);
      expect(locationRepo.breadcrumbs).toHaveLength(1);
    });

    it("strictly rejects breadcrumb capture when trip is not in_progress (e.g. approved or draft) (409 CONFLICT)", async () => {
      const { locationRepo, tripRepo, tenancyRepo } = setup();

      // Set trip status to 'approved' (not yet in_progress)
      const firstTrip = tripRepo.trips[0];
      if (firstTrip) {
        firstTrip.status = "approved";
      }

      await expect(
        recordActiveTripBreadcrumb({
          user: repUser,
          candidateOrgId: orgId,
          candidateTripId: activeTrip.id,
          rawInput: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracyMeters: 10,
          },
          tenancyRepository: tenancyRepo,
          tripsRepository: tripRepo,
          locationRepository: locationRepo,
        })
      ).rejects.toThrow();

      expect(locationRepo.breadcrumbs).toHaveLength(0);
    });

    it("strictly rejects breadcrumb recording if caller is not the trip owner (403 FORBIDDEN)", async () => {
      const { locationRepo, tripRepo, tenancyRepo } = setup();

      // otherRepUser tries to post breadcrumbs to repUser's trip
      await expect(
        recordActiveTripBreadcrumb({
          user: otherRepUser,
          candidateOrgId: orgId,
          candidateTripId: activeTrip.id,
          rawInput: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
          tenancyRepository: tenancyRepo,
          tripsRepository: tripRepo,
          locationRepository: locationRepo,
        })
      ).rejects.toThrow();

      expect(locationRepo.breadcrumbs).toHaveLength(0);
    });
  });

  describe("Breadcrumb Querying & Privacy Boundaries", () => {
    it("allows trip owner to list captured breadcrumbs", async () => {
      const { locationRepo, tripRepo, tenancyRepo } = setup();

      // Seed a breadcrumb
      await locationRepo.recordBreadcrumb(repUser.id, {
        orgId,
        tripId: activeTrip.id,
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 15,
      });

      const list = await listTripBreadcrumbs({
        user: repUser,
        candidateOrgId: orgId,
        candidateTripId: activeTrip.id,
        tenancyRepository: tenancyRepo,
        tripsRepository: tripRepo,
        locationRepository: locationRepo,
      });

      expect(list).toHaveLength(1);
      expect(list[0]?.latitude).toBe(37.7749);
    });

    it("rejects non-owner peer field employees from listing another rep's breadcrumbs", async () => {
      const { locationRepo, tripRepo, tenancyRepo } = setup();

      await expect(
        listTripBreadcrumbs({
          user: otherRepUser,
          candidateOrgId: orgId,
          candidateTripId: activeTrip.id,
          tenancyRepository: tenancyRepo,
          tripsRepository: tripRepo,
          locationRepository: locationRepo,
        })
      ).rejects.toThrow();
    });
  });

  describe("Admin Location Retention Purge", () => {
    it("allows administrators to execute retention purge and audits the event", async () => {
      const { locationRepo, tenancyRepo, auditRepo } = setup();

      // Seed breadcrumb
      await locationRepo.recordBreadcrumb(repUser.id, {
        orgId,
        tripId: activeTrip.id,
        latitude: 37.7749,
        longitude: -122.4194,
      });

      const purgeResult = await purgeExpiredLocationBreadcrumbsForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        rawInput: { retentionDays: 30 },
        tenancyRepository: tenancyRepo,
        locationRepository: locationRepo,
        auditRepository: auditRepo,
      });

      expect(purgeResult.deletedCount).toBe(1);
      expect(locationRepo.breadcrumbs).toHaveLength(0);

      // Verify audit log
      const auditEvent = auditRepo.events.find(
        (e) => e.actionType === "location.breadcrumbs_purged"
      );
      expect(auditEvent).toBeDefined();
      expect(auditEvent?.actorUserId).toBe(adminUser.id);
    });

    it("rejects field employees from executing location retention purge (403 FORBIDDEN)", async () => {
      const { locationRepo, tenancyRepo, auditRepo } = setup();

      await expect(
        purgeExpiredLocationBreadcrumbsForOrg({
          user: repUser,
          candidateOrgId: orgId,
          rawInput: { retentionDays: 30 },
          tenancyRepository: tenancyRepo,
          locationRepository: locationRepo,
          auditRepository: auditRepo,
        })
      ).rejects.toThrow();
    });
  });
});
