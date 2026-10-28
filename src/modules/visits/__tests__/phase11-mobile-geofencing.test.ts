import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/http/envelope";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { Store } from "@/modules/stores/domain";
import type { StoresRepository } from "@/modules/stores/repository";
import type { Trip, TripStop } from "@/modules/trips/domain";
import {
  buildUnverifiedDeviceLocation,
  type Visit,
  type VisitChecklistItem,
  type VisitDetail,
  type VisitGeofenceEvent,
} from "@/modules/visits/domain";
import type {
  TripStopExecutionContext,
  VisitsRepository,
} from "@/modules/visits/repository";
import { processGeofenceEventForOrg } from "@/modules/visits/service";

class MockTenancyRepo implements TenancyRepository {
  public memberships: OrganizationMembership[] = [];
  public organizations: Organization[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null;
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.memberships
      .filter((m) => m.userId === userId && m.status === "active")
      .map((m) => {
        const organization = this.organizations.find((o) => o.id === m.orgId);
        if (!organization) throw new Error("Missing org");
        return { organization, membership: m };
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

class MockStoresRepo implements Pick<StoresRepository, "getStoreById"> {
  public stores: Store[] = [];

  async getStoreById(orgId: string, storeId: string): Promise<Store | null> {
    return this.stores.find((s) => s.orgId === orgId && s.id === storeId) ?? null;
  }
}

class MockVisitsRepo {
  public visits: Visit[] = [];
  public checklistItems: Map<string, VisitChecklistItem[]> = new Map();
  public geofenceEvents: VisitGeofenceEvent[] = [];
  public stopsContext: Map<string, TripStopExecutionContext> = new Map();

  async getTripStopExecutionContext(
    _orgId: string,
    tripStopId: string
  ): Promise<TripStopExecutionContext | null> {
    return this.stopsContext.get(tripStopId) ?? null;
  }

  async getVisitByTripStopId(_orgId: string, tripStopId: string): Promise<Visit | null> {
    return this.visits.find((v) => v.tripStopId === tripStopId) ?? null;
  }

  async getActiveVisitForEmployee(
    _orgId: string,
    employeeUserId: string
  ): Promise<Visit | null> {
    return (
      this.visits.find(
        (v) => v.employeeUserId === employeeUserId && v.status === "in_progress"
      ) ?? null
    );
  }

  async getGeofenceEventByClientId(
    orgId: string,
    clientEventId: string
  ): Promise<VisitGeofenceEvent | null> {
    return (
      this.geofenceEvents.find(
        (e) => e.orgId === orgId && e.clientEventId === clientEventId
      ) ?? null
    );
  }

  async recordGeofenceEvent(params: {
    orgId: string;
    tripId: string;
    tripStopId: string;
    storeId: string;
    employeeUserId: string;
    visitId: string | null;
    eventType: "geofence_entry" | "geofence_exit";
    clientEventId: string;
    deviceRecordedAt: string;
    serverReceivedAt: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    geofenceRadiusMeters: number;
    dwellTimeSeconds: number | null;
    status: "processed" | "pending_review" | "rejected" | "duplicate";
    rejectionReason: string | null;
  }): Promise<VisitGeofenceEvent> {
    const event: VisitGeofenceEvent = {
      id: `ge-${this.geofenceEvents.length + 1}`,
      orgId: params.orgId,
      tripId: params.tripId,
      tripStopId: params.tripStopId,
      storeId: params.storeId,
      employeeUserId: params.employeeUserId,
      visitId: params.visitId,
      eventType: params.eventType,
      clientEventId: params.clientEventId,
      deviceRecordedAt: params.deviceRecordedAt,
      serverReceivedAt: params.serverReceivedAt,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters,
      geofenceRadiusMeters: params.geofenceRadiusMeters,
      dwellTimeSeconds: params.dwellTimeSeconds,
      status: params.status,
      rejectionReason: params.rejectionReason,
      createdAt: new Date().toISOString(),
    };
    this.geofenceEvents.push(event);
    return event;
  }

  async checkInStopAtomic(params: {
    orgId: string;
    tripStopId: string;
    employeeUserId: string;
    checkedInAt: string;
    idempotencyKey: string | null;
    location: ReturnType<typeof buildUnverifiedDeviceLocation>;
    source?: "automatic_geofence" | "manual";
    deviceTimestamp?: string | null;
    radiusMeters?: number | null;
    verificationStatus?: "verified" | "pending_review";
    verificationNotes?: string | null;
  }): Promise<VisitDetail> {
    const newVisit: Visit = {
      id: `visit-${this.visits.length + 1}`,
      orgId: params.orgId,
      tripStopId: params.tripStopId,
      employeeUserId: params.employeeUserId,
      status: "in_progress",
      checkedInAt: params.checkedInAt,
      checkedOutAt: null,
      notes: "",
      checkInLocation: params.location,
      checkOutLocation: buildUnverifiedDeviceLocation({
        lat: null,
        lng: null,
        accuracyMeters: null,
        status: "unavailable",
      }),
      checkInSource: params.source ?? "manual",
      checkOutSource: null,
      checkInDeviceTimestamp: params.deviceTimestamp ?? null,
      checkOutDeviceTimestamp: null,
      verificationStatus: params.verificationStatus ?? "verified",
      verificationNotes: params.verificationNotes ?? null,
      geofenceRadiusMeters: params.radiusMeters ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.visits.push(newVisit);

    const stopCtx = this.stopsContext.get(params.tripStopId);
    if (!stopCtx) throw new Error("Stop context not found");

    return {
      visit: newVisit,
      checklistItems: [],
      evidence: [],
    };
  }

  async checkOutVisitAtomic(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    checkedOutAt: string;
    notes?: string;
    idempotencyKey: string | null;
    location: ReturnType<typeof buildUnverifiedDeviceLocation>;
    source?: "automatic_geofence" | "manual";
    deviceTimestamp?: string | null;
    verificationStatus?: "verified" | "pending_review";
    verificationNotes?: string | null;
  }): Promise<VisitDetail> {
    const visit = this.visits.find((v) => v.id === params.visitId);
    if (!visit) throw new Error("Visit not found");

    visit.status = "submitted";
    visit.checkedOutAt = params.checkedOutAt;
    visit.checkOutLocation = params.location;
    visit.checkOutSource = params.source ?? "manual";
    visit.checkOutDeviceTimestamp = params.deviceTimestamp ?? null;
    if (params.verificationStatus) {
      visit.verificationStatus = params.verificationStatus;
    }
    if (params.verificationNotes) {
      visit.verificationNotes = params.verificationNotes;
    }

    const stopCtx = Array.from(this.stopsContext.values()).find(
      (c) => c.stop.id === visit.tripStopId
    );
    if (!stopCtx) throw new Error("Stop context not found");

    return {
      visit,
      checklistItems: this.checklistItems.get(visit.id) ?? [],
      evidence: [],
    };
  }

  async getVisitDetail(orgId: string, visitId: string): Promise<VisitDetail | null> {
    const visit = this.visits.find((v) => v.orgId === orgId && v.id === visitId);
    if (!visit) return null;
    const stopCtx = Array.from(this.stopsContext.values()).find(
      (c) => c.stop.id === visit.tripStopId
    );
    if (!stopCtx) return null;

    return {
      visit,
      checklistItems: this.checklistItems.get(visit.id) ?? [],
      evidence: [],
    };
  }

  async listVisits(): Promise<never> {
    throw new Error("Not implemented");
  }
  async updateVisitExecution(): Promise<never> {
    throw new Error("Not implemented");
  }
  async createSignedEvidenceUploadTicket(): Promise<never> {
    throw new Error("Not implemented");
  }
  async verifyStorageObjectUploaded(): Promise<never> {
    throw new Error("Not implemented");
  }
  async recordConfirmedEvidence(): Promise<never> {
    throw new Error("Not implemented");
  }
  async createSignedEvidenceDownloadUrl(): Promise<never> {
    throw new Error("Not implemented");
  }
}

describe("Phase 11 Mobile Geofencing Service Integration", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";

  const user: AuthenticatedUser = {
    id: userId,
    email: "rahul@fieldtrack.com",
  };

  const sampleTrip: Trip = {
    id: "33333333-3333-4333-8333-333333333333",
    orgId,
    ownerUserId: userId,
    title: "Bengaluru Central Route",
    startDate: "2026-10-28",
    endDate: "2026-10-28",
    purpose: "Store routine audits",
    status: "approved",
    submittedAt: "2026-10-28T00:00:00Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: "2026-10-28T00:00:00Z",
    updatedAt: "2026-10-28T00:00:00Z",
  };

  const sampleStop: TripStop = {
    id: "44444444-4444-4444-8444-444444444444",
    orgId,
    tripId: "33333333-3333-4333-8333-333333333333",
    storeId: "55555555-5555-4555-8555-555555555555",
    sequenceNumber: 1,
    status: "planned",
    plannedAt: "2026-10-28T10:00:00Z",
    createdAt: "2026-10-28T00:00:00Z",
    updatedAt: "2026-10-28T00:00:00Z",
  };

  const sampleStore: Store = {
    id: "55555555-5555-4555-8555-555555555555",
    orgId,
    name: "Indiranagar Supermarket",
    region: "Bengaluru East",
    addressLine1: "100ft Road",
    addressLine2: null,
    city: "Bengaluru",
    stateProvince: "Karnataka",
    postalCode: "560038",
    countryCode: "IN",
    latitude: 12.9716,
    longitude: 77.5946,
    active: true,
    createdAt: "2026-10-28T00:00:00Z",
    updatedAt: "2026-10-28T00:00:00Z",
  };

  function setupFixture() {
    const tenancyRepo = new MockTenancyRepo();
    tenancyRepo.organizations.push({
      id: orgId,
      name: "Acme Corp",
      slug: "acme-corp",
      status: "active",
      createdBy: userId,
      createdAt: "2026-10-28T00:00:00Z",
      updatedAt: "2026-10-28T00:00:00Z",
    });
    tenancyRepo.memberships.push({
      id: "mem-1",
      orgId,
      userId,
      role: "field_employee",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-28T00:00:00Z",
      updatedAt: "2026-10-28T00:00:00Z",
    });

    const storesRepo = new MockStoresRepo();
    storesRepo.stores.push(sampleStore);

    const visitsRepo = new MockVisitsRepo();
    visitsRepo.stopsContext.set(sampleStop.id, {
      stop: sampleStop,
      trip: sampleTrip,
    });

    return { tenancyRepo, storesRepo, visitsRepo };
  }

  it("handles valid arrival (geofence_entry) with automatic check-in", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const result = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-entry-001",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 12.5,
        geofenceRadiusMeters: 120,
        dwellTimeSeconds: 45,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("processed");
    expect(result.visitId).toBeDefined();

    const createdVisit = visitsRepo.visits[0];
    if (!createdVisit) throw new Error("createdVisit not defined");
    expect(createdVisit.checkInSource).toBe("automatic_geofence");
    expect(createdVisit.verificationStatus).toBe("verified");
    expect(createdVisit.geofenceRadiusMeters).toBe(120);
    expect(createdVisit.checkInDeviceTimestamp).toBe("2026-10-28T10:00:00Z");

    expect(visitsRepo.geofenceEvents.length).toBe(1);
    const firstEvent = visitsRepo.geofenceEvents[0];
    if (!firstEvent) throw new Error("firstEvent not defined");
    expect(firstEvent.status).toBe("processed");
  });

  it("handles idempotent duplicate delivery gracefully", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const eventPayload = {
      tripId: sampleTrip.id,
      tripStopId: sampleStop.id,
      storeId: sampleStore.id,
      eventType: "geofence_entry" as const,
      clientEventId: "client-event-entry-duplicate-test",
      deviceRecordedAt: "2026-10-28T10:00:00Z",
      latitude: 12.97165,
      longitude: 77.59462,
      accuracyMeters: 12.5,
      geofenceRadiusMeters: 120,
    };

    const firstResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: eventPayload,
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(firstResult.status).toBe("processed");

    // Second call with same clientEventId
    const secondResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: eventPayload,
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:10Z"),
    });

    expect(secondResult.status).toBe("duplicate");
    expect(secondResult.visitId).toBe(firstResult.visitId);
    expect(visitsRepo.visits.length).toBe(1);
    expect(visitsRepo.geofenceEvents.length).toBe(1);
  });

  it("routes ambiguous event (poor GPS accuracy > 200m) to pending_review", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const result = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-poor-accuracy",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 285.0, // Exceeds 200m threshold
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("pending_review");

    const visit = visitsRepo.visits[0];
    if (!visit) throw new Error("visit not defined");
    expect(visit.verificationStatus).toBe("pending_review");
    expect(visit.verificationNotes).toContain(
      "Reported GPS accuracy (285m) exceeds reliable threshold (200m)"
    );
  });

  it("routes event with excessive store distance to pending_review", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const result = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-far-distance",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.985, // Far outside 120m + 150m boundary
        longitude: 77.61,
        accuracyMeters: 20.0,
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(result.status).toBe("pending_review");
    const visit = visitsRepo.visits[0];
    if (!visit) throw new Error("visit not defined");
    expect(visit.verificationStatus).toBe("pending_review");
    expect(visit.verificationNotes).toContain("exceeded geofence radius");
  });

  it("detects delayed synchronization (> 5 minutes latency) and annotates pending review", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const result = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-delayed-sync",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 15.0,
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:15:00Z"), // 15 minutes later (900 seconds)
    });

    expect(result.status).toBe("pending_review");
    expect(result.syncDelayMs).toBe(900_000);
    const visit = visitsRepo.visits[0];
    if (!visit) throw new Error("visit not defined");
    expect(visit.verificationNotes).toContain("Delayed sync (900s latency)");
  });

  it("handles departure (geofence_exit) with completed checklist as verified", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    // First check in
    const entryResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-entry-ok",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 15.0,
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(entryResult.visitId).toBeDefined();
    const visitId = entryResult.visitId ?? "";

    // Add completed checklist item
    visitsRepo.checklistItems.set(visitId, [
      {
        id: "item-1",
        orgId,
        visitId,
        questionKey: "shelf_display_stocked",
        label: "Check shelf display",
        required: true,
        answerType: "boolean",
        answerValue: true,
        answerText: null,
        flagged: false,
        completedBy: userId,
        completedAt: "2026-10-28T10:20:00Z",
        createdAt: "2026-10-28T10:00:00Z",
        updatedAt: "2026-10-28T10:20:00Z",
      },
    ]);

    // Now exit
    const exitResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_exit",
        clientEventId: "client-event-exit-ok",
        deviceRecordedAt: "2026-10-28T10:30:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 15.0,
        geofenceRadiusMeters: 120,
        dwellTimeSeconds: 1800,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:30:05Z"),
    });

    expect(exitResult.success).toBe(true);
    expect(exitResult.status).toBe("processed");

    const checkedOutVisit = visitsRepo.visits[0];
    if (!checkedOutVisit) throw new Error("checkedOutVisit not defined");
    expect(checkedOutVisit.status).toBe("submitted");
    expect(checkedOutVisit.checkOutSource).toBe("automatic_geofence");
    expect(checkedOutVisit.checkOutDeviceTimestamp).toBe("2026-10-28T10:30:00Z");
  });

  it("routes departure with incomplete required checklist items to pending_review without throwing", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    // First check in
    const entryResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_entry",
        clientEventId: "client-event-entry-ok-2",
        deviceRecordedAt: "2026-10-28T10:00:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 15.0,
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:00:05Z"),
    });

    expect(entryResult.visitId).toBeDefined();
    const visitId = entryResult.visitId ?? "";

    // Required checklist item is uncompleted
    visitsRepo.checklistItems.set(visitId, [
      {
        id: "item-req",
        orgId,
        visitId,
        questionKey: "store_manager_signature",
        label: "Obtain store manager signature",
        required: true,
        answerType: "text",
        answerValue: null,
        answerText: null,
        flagged: false,
        completedBy: null,
        completedAt: null, // NOT COMPLETED
        createdAt: "2026-10-28T10:00:00Z",
        updatedAt: "2026-10-28T10:00:00Z",
      },
    ]);

    // Exit occurs
    const exitResult = await processGeofenceEventForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: {
        tripId: sampleTrip.id,
        tripStopId: sampleStop.id,
        storeId: sampleStore.id,
        eventType: "geofence_exit",
        clientEventId: "client-event-exit-incomplete",
        deviceRecordedAt: "2026-10-28T10:25:00Z",
        latitude: 12.97165,
        longitude: 77.59462,
        accuracyMeters: 15.0,
        geofenceRadiusMeters: 120,
      },
      tenancyRepository: tenancyRepo,
      visitsRepository: visitsRepo as unknown as VisitsRepository,
      storesRepository: storesRepo,
      now: new Date("2026-10-28T10:25:05Z"),
    });

    expect(exitResult.success).toBe(true);
    expect(exitResult.status).toBe("pending_review");
    expect(exitResult.message).toContain("store_manager_signature");
  });

  it("rejects unauthorized user who is not assigned to the trip", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    const otherUser: AuthenticatedUser = {
      id: "99999999-9999-4999-8999-999999999999",
      email: "other@fieldtrack.com",
    };

    tenancyRepo.memberships.push({
      id: "mem-other",
      orgId,
      userId: otherUser.id,
      role: "field_employee",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-28T00:00:00Z",
      updatedAt: "2026-10-28T00:00:00Z",
    });

    await expect(
      processGeofenceEventForOrg({
        user: otherUser,
        candidateOrgId: orgId,
        rawInput: {
          tripId: sampleTrip.id,
          tripStopId: sampleStop.id,
          storeId: sampleStore.id,
          eventType: "geofence_entry",
          clientEventId: "client-event-unauth",
          deviceRecordedAt: "2026-10-28T10:00:00Z",
          latitude: 12.97165,
          longitude: 77.59462,
          geofenceRadiusMeters: 120,
        },
        tenancyRepository: tenancyRepo,
        visitsRepository: visitsRepo as unknown as VisitsRepository,
        storesRepository: storesRepo,
      })
    ).rejects.toThrowError(AppError);
  });

  it("throws 404 NOT_FOUND or 409 CONFLICT without inserting invalid foreign keys when stop is missing or mismatched", async () => {
    const { tenancyRepo, storesRepo, visitsRepo } = setupFixture();

    await expect(
      processGeofenceEventForOrg({
        user,
        candidateOrgId: orgId,
        rawInput: {
          tripId: sampleTrip.id,
          tripStopId: "99999999-8888-4777-8666-555555555555",
          storeId: sampleStore.id,
          eventType: "geofence_entry",
          clientEventId: "client-event-missing-stop",
          deviceRecordedAt: "2026-10-28T10:00:00Z",
          latitude: 12.97165,
          longitude: 77.59462,
          geofenceRadiusMeters: 120,
        },
        tenancyRepository: tenancyRepo,
        visitsRepository: visitsRepo as unknown as VisitsRepository,
        storesRepository: storesRepo,
      })
    ).rejects.toMatchObject({ status: 404 });

    expect(visitsRepo.geofenceEvents).toHaveLength(0);

    await expect(
      processGeofenceEventForOrg({
        user,
        candidateOrgId: orgId,
        rawInput: {
          tripId: sampleTrip.id,
          tripStopId: sampleStop.id,
          storeId: "99999999-8888-4777-8666-444444444444", // Mismatched storeId
          eventType: "geofence_entry",
          clientEventId: "client-event-mismatch-store",
          deviceRecordedAt: "2026-10-28T10:00:00Z",
          latitude: 12.97165,
          longitude: 77.59462,
          geofenceRadiusMeters: 120,
        },
        tenancyRepository: tenancyRepo,
        visitsRepository: visitsRepo as unknown as VisitsRepository,
        storesRepository: storesRepo,
      })
    ).rejects.toMatchObject({ status: 409 });

    expect(visitsRepo.geofenceEvents).toHaveLength(0);
  });
});
