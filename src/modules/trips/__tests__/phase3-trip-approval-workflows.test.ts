import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/http/envelope";
import type { StoresRepository } from "@/modules/stores/repository";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { Trip, TripStop } from "@/modules/trips/domain";
import type { TripsRepository } from "@/modules/trips/repository";
import {
  decideTripForOrg,
  getTripDetailForOrg,
  submitTripForApproval,
} from "@/modules/trips/service";

describe("Phase 3: Production Trip and Approval Workflows", () => {
  const ORG_A_ID = "a0000000-0000-4000-8000-000000000001";
  const ORG_B_ID = "b0000000-0000-4000-8000-000000000002";

  const REP_USER: AuthenticatedUser = {
    id: "c0000000-0000-4000-8000-000000000001",
    email: "rep1@alpha.com",
  };

  const MANAGER_USER: AuthenticatedUser = {
    id: "c0000000-0000-4000-8000-000000000002",
    email: "manager@alpha.com",
  };

  const OTHER_ORG_MANAGER: AuthenticatedUser = {
    id: "c0000000-0000-4000-8000-000000000004",
    email: "manager@beta.com",
  };

  const TRIP_ID = "d0000000-0000-4000-8000-000000000001";
  const STOP_1_ID = "e0000000-0000-4000-8000-000000000001";
  const STOP_2_ID = "e0000000-0000-4000-8000-000000000002";
  const STORE_1_ID = "f0000000-0000-4000-8000-000000000001";
  const STORE_2_ID = "f0000000-0000-4000-8000-000000000002";

  function createMockTenancyRepo(): TenancyRepository {
    return {
      getMembershipByUserAndOrg: async (userId: string, orgId: string) => {
        if (orgId === ORG_A_ID) {
          if (userId === REP_USER.id) {
            return {
              id: "10000000-0000-4000-8000-000000000001",
              orgId,
              userId,
              role: "field_employee",
              status: "active",
              managerUserId: MANAGER_USER.id,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            };
          }
          if (userId === MANAGER_USER.id) {
            return {
              id: "10000000-0000-4000-8000-000000000002",
              orgId,
              userId,
              role: "manager",
              status: "active",
              managerUserId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            };
          }
        }
        if (orgId === ORG_B_ID && userId === OTHER_ORG_MANAGER.id) {
          return {
            id: "10000000-0000-4000-8000-000000000004",
            orgId,
            userId,
            role: "manager",
            status: "active",
            managerUserId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        }
        return null;
      },
      listUserOrganizations: async () => [],
      createOrganizationWithOwner: async () => {
        throw new Error("Not implemented");
      },
      listOrgMembers: async () => ({
        items: [],
        pagination: { limit: 50, hasMore: false, nextCursor: null },
      }),
      addOrgMember: async () => {
        throw new Error("Not implemented");
      },
      createOrgInvitation: async () => {
        throw new Error("Not implemented");
      },
      acceptOrgInvitationByTokenHash: async () => {
        throw new Error("Not implemented");
      },
    };
  }

  function createMockStoresRepo(): StoresRepository {
    return {
      getStoresByIds: async (orgId, storeIds) => {
        return storeIds.map((id) => ({
          id,
          orgId,
          name: `Store ${id.slice(0, 8)}`,
          region: "North",
          addressLine1: "123 Market St",
          addressLine2: null,
          city: "Chicago",
          stateProvince: "IL",
          postalCode: "60601",
          countryCode: "US",
          latitude: 41.88,
          longitude: -87.63,
          active: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }));
      },
      createStore: async () => {
        throw new Error("Not implemented");
      },
      getStoreById: async () => null,
      updateStore: async () => {
        throw new Error("Not implemented");
      },
      listStores: async () => ({
        items: [],
        pagination: { limit: 50, hasMore: false, nextCursor: null },
      }),
    };
  }

  function createMockTripsRepo(initialTrip: Trip, initialStops: TripStop[]): TripsRepository {
    let currentTrip = { ...initialTrip };
    const currentStops = [...initialStops];

    return {
      getTripDetail: async (orgId: string, tripId: string) => {
        if (currentTrip.orgId === orgId && currentTrip.id === tripId) {
          return {
            trip: currentTrip,
            stops: currentStops,
            auditEvents: [],
          };
        }
        return null;
      },
      transitionTripStatusWithAudit: async (input) => {
        currentTrip = {
          ...currentTrip,
          status: input.newStatus,
          submittedAt: input.submittedAt !== undefined ? input.submittedAt : currentTrip.submittedAt,
          decidedBy: input.decidedBy !== undefined ? input.decidedBy : currentTrip.decidedBy,
          decidedAt: input.decidedAt !== undefined ? input.decidedAt : currentTrip.decidedAt,
          decisionNote: input.decisionNote !== undefined ? input.decisionNote : currentTrip.decisionNote,
          updatedAt: "2026-10-25T10:30:00.000Z",
        };
        return {
          trip: currentTrip,
          stops: currentStops,
          auditEvents: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              tripId: currentTrip.id,
              orgId: currentTrip.orgId,
              actorUserId: input.actorUserId,
              eventType: input.eventType,
              oldStatus: input.oldStatus,
              newStatus: input.newStatus,
              note: input.auditNote,
              metadata: input.metadata ?? {},
              createdAt: "2026-10-25T10:30:00.000Z",
            },
          ],
        };
      },
      createTripDraftWithStops: async () => {
        throw new Error("Not implemented");
      },
      updateTripDraftWithStops: async () => {
        throw new Error("Not implemented");
      },
      listTrips: async () => ({
        items: [],
        pagination: { limit: 50, hasMore: false, nextCursor: null },
      }),
    };
  }

  const BASE_DRAFT_TRIP: Trip = {
    id: TRIP_ID,
    orgId: ORG_A_ID,
    ownerUserId: REP_USER.id,
    title: "Regional Store Audits",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    purpose: "Verify promotional merchandise setup and stock compliance",
    status: "draft",
    submittedAt: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: "2026-10-25T08:00:00.000Z",
    updatedAt: "2026-10-25T08:00:00.000Z",
  };

  const BASE_STOPS: TripStop[] = [
    {
      id: STOP_1_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_ID,
      storeId: STORE_1_ID,
      sequenceNumber: 1,
      plannedAt: "2026-10-26T09:00:00.000Z",
      status: "planned",
      createdAt: "2026-10-25T08:00:00.000Z",
      updatedAt: "2026-10-25T08:00:00.000Z",
    },
    {
      id: STOP_2_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_ID,
      storeId: STORE_2_ID,
      sequenceNumber: 2,
      plannedAt: "2026-10-26T13:00:00.000Z",
      status: "planned",
      createdAt: "2026-10-25T08:00:00.000Z",
      updatedAt: "2026-10-25T08:00:00.000Z",
    },
  ];

  it("submits a trip draft successfully with audit trail", async () => {
    const tenancyRepo = createMockTenancyRepo();
    const storesRepo = createMockStoresRepo();
    const tripsRepo = createMockTripsRepo(BASE_DRAFT_TRIP, BASE_STOPS);

    const result = await submitTripForApproval({
      user: REP_USER,
      candidateOrgId: ORG_A_ID,
      candidateTripId: BASE_DRAFT_TRIP.id,
      rawInput: { note: "Please approve for travel next week" },
      tenancyRepository: tenancyRepo,
      storesRepository: storesRepo,
      tripsRepository: tripsRepo,
    });

    expect(result.trip.status).toBe("submitted");
    expect(result.trip.submittedAt).toBeTruthy();
    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0]?.eventType).toBe("trip_submitted");
  });

  it("prevents self-approval when manager attempts to approve their own trip", async () => {
    const tenancyRepo = createMockTenancyRepo();
    // Manager owns this trip
    const managerOwnedTrip: Trip = {
      ...BASE_DRAFT_TRIP,
      ownerUserId: MANAGER_USER.id,
      status: "submitted",
      submittedAt: "2026-10-25T09:00:00.000Z",
    };
    const tripsRepo = createMockTripsRepo(managerOwnedTrip, BASE_STOPS);

    await expect(
      decideTripForOrg({
        user: MANAGER_USER, // The manager who owns the trip attempts to decide it
        candidateOrgId: ORG_A_ID,
        candidateTripId: managerOwnedTrip.id,
        rawInput: {
          decision: "approved",
          note: "Self approval attempt",
        },
        tenancyRepository: tenancyRepo,
        tripsRepository: tripsRepo,
      })
    ).rejects.toThrowError(AppError);
  });

  it("allows peer manager to approve a submitted trip", async () => {
    const tenancyRepo = createMockTenancyRepo();
    const submittedTrip: Trip = {
      ...BASE_DRAFT_TRIP,
      status: "submitted",
      submittedAt: "2026-10-25T09:00:00.000Z",
    };
    const tripsRepo = createMockTripsRepo(submittedTrip, BASE_STOPS);

    const result = await decideTripForOrg({
      user: MANAGER_USER,
      candidateOrgId: ORG_A_ID,
      candidateTripId: submittedTrip.id,
      rawInput: {
        decision: "approved",
        note: "All planned routes look efficient and within budget",
      },
      tenancyRepository: tenancyRepo,
      tripsRepository: tripsRepo,
    });

    expect(result.trip.status).toBe("approved");
    expect(result.trip.decidedBy).toBe(MANAGER_USER.id);
    expect(result.trip.decisionNote).toContain("All planned routes");
  });

  it("requires explanatory note when requesting changes or rejecting", async () => {
    const tenancyRepo = createMockTenancyRepo();
    const submittedTrip: Trip = {
      ...BASE_DRAFT_TRIP,
      status: "submitted",
      submittedAt: "2026-10-25T09:00:00.000Z",
    };
    const tripsRepo = createMockTripsRepo(submittedTrip, BASE_STOPS);

    // Rejecting without note should fail validation
    await expect(
      decideTripForOrg({
        user: MANAGER_USER,
        candidateOrgId: ORG_A_ID,
        candidateTripId: submittedTrip.id,
        rawInput: {
          decision: "rejected",
          note: "", // Empty note
        },
        tenancyRepository: tenancyRepo,
        tripsRepository: tripsRepo,
      })
    ).rejects.toThrow();

    // Rejecting with valid note succeeds
    const rejectResult = await decideTripForOrg({
      user: MANAGER_USER,
      candidateOrgId: ORG_A_ID,
      candidateTripId: submittedTrip.id,
      rawInput: {
        decision: "rejected",
        note: "Store 200 is currently undergoing remodeling and cannot receive field visits",
      },
      tenancyRepository: tenancyRepo,
      tripsRepository: tripsRepo,
    });

    expect(rejectResult.trip.status).toBe("rejected");
    expect(rejectResult.trip.decisionNote).toContain("remodeling");
  });

  it("blocks cross-workspace trip access attempts", async () => {
    const tenancyRepo = createMockTenancyRepo();
    const tripsRepo = createMockTripsRepo(BASE_DRAFT_TRIP, BASE_STOPS);

    // User in Org B tries to access trip in Org A
    await expect(
      getTripDetailForOrg({
        user: OTHER_ORG_MANAGER,
        candidateOrgId: ORG_B_ID,
        candidateTripId: BASE_DRAFT_TRIP.id,
        tenancyRepository: tenancyRepo,
        tripsRepository: tripsRepo,
      })
    ).rejects.toThrowError(AppError);
  });
});
