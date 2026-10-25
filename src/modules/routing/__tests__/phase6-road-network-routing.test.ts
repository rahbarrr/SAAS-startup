import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/http/envelope";
import type { StoresRepository } from "@/modules/stores/repository";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { TripsRepository } from "@/modules/trips/repository";
import {
  HAVERSINE_DISCLAIMER,
  ROAD_NETWORK_DISCLAIMER,
  type RouteStopCandidate,
} from "../domain";
import { optimizeTripRoute } from "../optimizer";
import {
  HaversineDistanceProvider,
  OsrmRoadNetworkProvider,
  ResilientRoadRoutingProvider,
  resolveRouteDistanceProvider,
} from "../provider";
import { applyOptimizedRouteToTrip } from "../service";

describe("Phase 6: Road-Network Routing, Caching, and Resilience", () => {
  const coordA = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
  const coordB = { latitude: 37.8044, longitude: -122.2712 }; // Oakland

  it("calculates driving distance via OsrmRoadNetworkProvider and caches result in-memory", async () => {
    let fetchCalls = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCalls++;
      expect(url).toContain("/route/v1/driving/");
      return {
        ok: true,
        json: async () => ({
          code: "Ok",
          routes: [
            {
              distance: 18500, // 18.5 km
              duration: 1200, // 20 minutes (1200s)
            },
          ],
        }),
      };
    });

    const osrm = new OsrmRoadNetworkProvider({
      baseUrl: "https://router.project-osrm.org",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result1 = await osrm.calculateDistance(coordA, coordB);
    expect(result1.distanceMeters).toBe(18500);
    expect(result1.durationMinutes).toBe(20);
    expect(result1.distanceType).toBe("road_network_driving");
    expect(result1.providerName).toBe("osrm");
    expect(result1.disclaimer).toBe(ROAD_NETWORK_DISCLAIMER);
    expect(fetchCalls).toBe(1);

    // Second call with same coordinates: should hit in-memory cache without fetch
    const result2 = await osrm.calculateDistance(coordA, coordB);
    expect(result2.distanceMeters).toBe(18500);
    expect(fetchCalls).toBe(1);
  });

  it("handles OSRM failure by seamlessly falling back to Haversine in ResilientRoadRoutingProvider", async () => {
    const failingFetch = vi.fn().mockImplementation(async () => {
      throw new Error("Network timeout / DNS resolution error");
    });

    const osrm = new OsrmRoadNetworkProvider({
      fetchFn: failingFetch as unknown as typeof fetch,
    });
    const resilientProvider = new ResilientRoadRoutingProvider(osrm);

    const result = await resilientProvider.calculateDistance(coordA, coordB);
    expect(result.distanceType).toBe("straight_line_haversine");
    expect(result.distanceMeters).toBeGreaterThan(10000);
    expect(result.disclaimer).toMatch(/temporarily unavailable/i);
    expect(result.disclaimer).toMatch(/straight-line fallback used/i);
  });

  it("resolves Haversine by default, and OSRM when ROUTING_PROVIDER=osrm is set", () => {
    const prevEnv = process.env.ROUTING_PROVIDER;

    try {
      delete process.env.ROUTING_PROVIDER;
      const defaultProvider = resolveRouteDistanceProvider();
      expect(defaultProvider).toBeInstanceOf(HaversineDistanceProvider);

      process.env.ROUTING_PROVIDER = "osrm";
      const osrmProvider = resolveRouteDistanceProvider();
      expect(osrmProvider).toBeInstanceOf(ResilientRoadRoutingProvider);
    } finally {
      process.env.ROUTING_PROVIDER = prevEnv;
    }
  });

  it("tags route optimization proposals with the actual provider name and disclaimer", async () => {
    const stops: RouteStopCandidate[] = [
      {
        id: "stop-1",
        storeId: "store-1",
        storeName: "Downtown Store",
        address: "100 Market St",
        city: "San Francisco",
        region: "West",
        coordinates: coordA,
        sequenceNumber: 1,
      },
      {
        id: "stop-2",
        storeId: "store-2",
        storeName: "Bay Store",
        address: "200 Broadway",
        city: "Oakland",
        region: "West",
        coordinates: coordB,
        sequenceNumber: 2,
      },
    ];

    const proposal = await optimizeTripRoute({
      stops,
      distanceProvider: new HaversineDistanceProvider(),
    });

    expect(proposal.providerName).toBe("haversine");
    expect(proposal.distanceType).toBe("straight_line_haversine");
    expect(proposal.distanceDisclaimer).toBe(HAVERSINE_DISCLAIMER);
  });

  it("requires explicit confirmation before modifying route order of an already approved trip", async () => {
    const mockTrip = {
      id: "trip-approved-1",
      organizationId: "org-test",
      ownerUserId: "user-1",
      title: "Approved West Coast Tour",
      purpose: "Compliance check",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      status: "approved" as const,
      submittedAt: "2026-10-20T10:00:00Z",
      decidedBy: "mgr-1",
      decidedAt: "2026-10-21T10:00:00Z",
      decisionNote: "Approved",
      createdAt: "2026-10-20T09:00:00Z",
      updatedAt: "2026-10-21T10:00:00Z",
    };

    const testOrgId = "22222222-2222-4222-8222-222222222222";
    const testTripId = "11111111-1111-4111-8111-111111111111";

    const mockTenancyRepository: Partial<TenancyRepository> = {
      getMembershipByUserAndOrg: async () => ({
        id: "mem-1",
        orgId: testOrgId,
        organizationId: testOrgId,
        userId: "user-1",
        role: "field_employee",
        status: "active",
        managerUserId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    };

    const mockTripsRepository: Partial<TripsRepository> = {
      getTripDetail: async () => ({
        trip: {
          ...mockTrip,
          id: testTripId,
          orgId: testOrgId,
          organizationId: testOrgId,
        },
        stops: [],
        auditEvents: [],
      }),
      updateTripDraftWithStops: async () => {
        throw new Error("Should not be called if confirmation missing");
      },
    };

    const mockStoresRepository: Partial<StoresRepository> = {
      getStoresByIds: async () => [],
    };

    // Attempting without confirmApprovedTripModification must throw CONFLICT
    await expect(
      applyOptimizedRouteToTrip({
        user: { id: "user-1", email: "rep@fieldtrack.app" },
        candidateOrgId: testOrgId,
        candidateTripId: testTripId,
        proposedStopOrder: [],
        confirmApprovedTripModification: false,
        tenancyRepository: mockTenancyRepository as TenancyRepository,
        tripsRepository: mockTripsRepository as TripsRepository,
        storesRepository: mockStoresRepository as StoresRepository,
      })
    ).rejects.toThrow(AppError);

    // Verify error code is CONFLICT
    try {
      await applyOptimizedRouteToTrip({
        user: { id: "user-1", email: "rep@fieldtrack.app" },
        candidateOrgId: testOrgId,
        candidateTripId: testTripId,
        proposedStopOrder: [],
        confirmApprovedTripModification: false,
        tenancyRepository: mockTenancyRepository as TenancyRepository,
        tripsRepository: mockTripsRepository as TripsRepository,
        storesRepository: mockStoresRepository as StoresRepository,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("CONFLICT");
    }
  });
});
