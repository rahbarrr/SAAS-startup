import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ROAD_NETWORK_DISCLAIMER } from "../domain";
import { GoogleRoutesDistanceProvider } from "../google-provider";
import {
  HaversineDistanceProvider,
  ResilientRoadRoutingProvider,
  resolveRouteDistanceProvider,
  UnconfiguredGoogleRoutingFallbackProvider,
} from "../provider";
import { optimizeTripRoute } from "../optimizer";
import type { RouteStopCandidate } from "../domain";

describe("Phase 10: Google Routes API Provider & Resilience", () => {
  const coordA = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
  const coordB = { latitude: 37.8044, longitude: -122.2712 }; // Oakland
  const coordC = { latitude: 37.3382, longitude: -121.8863 }; // San Jose

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calculates driving distance via Google Routes API and caches identical requests", async () => {
    let callCount = 0;
    const mockFetch = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        callCount++;
        expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "test-google-key",
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        });

        const body = JSON.parse(init?.body as string);
        expect(body.origin.location.latLng.latitude).toBe(coordA.latitude);
        expect(body.destination.location.latLng.latitude).toBe(coordB.latitude);
        expect(body.travelMode).toBe("DRIVE");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                distanceMeters: 19200, // 19.2 km
                duration: "1380s", // 23 minutes
              },
            ],
          }),
        };
      });

    const provider = new GoogleRoutesDistanceProvider({
      apiKey: "test-google-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result1 = await provider.calculateDistance(coordA, coordB);
    expect(result1.distanceMeters).toBe(19200);
    expect(result1.durationMinutes).toBe(23);
    expect(result1.distanceType).toBe("road_network_driving");
    expect(result1.providerName).toBe("google");
    expect(result1.disclaimer).toContain(ROAD_NETWORK_DISCLAIMER);
    expect(result1.disclaimer).toContain("Google Routes API");
    expect(callCount).toBe(1);

    // Identical second call must return cached result without hitting network
    const result2 = await provider.calculateDistance(coordA, coordB);
    expect(result2.distanceMeters).toBe(19200);
    expect(result2.durationMinutes).toBe(23);
    expect(callCount).toBe(1);
  });

  it("throws clear error when GOOGLE_MAPS_ROUTES_API_KEY is not configured", async () => {
    delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    const provider = new GoogleRoutesDistanceProvider({ apiKey: "" });

    await expect(provider.calculateDistance(coordA, coordB)).rejects.toThrow(
      /Google Routes API key is not configured/i
    );
  });

  it("handles Google Routes quota exhaustion (HTTP 429) cleanly", async () => {
    const quotaFetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        error: { code: 429, message: "Resource has been exhausted (e.g. check quota)." },
      }),
    }));

    const provider = new GoogleRoutesDistanceProvider({
      apiKey: "test-key",
      fetchFn: quotaFetch as unknown as typeof fetch,
    });

    await expect(provider.calculateDistance(coordA, coordB)).rejects.toThrow(
      /quota exceeded/i
    );
  });

  it("handles Google Routes API forbidden/permission errors (HTTP 403)", async () => {
    const forbiddenFetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({
        error: { code: 403, message: "API key restricted or billing disabled." },
      }),
    }));

    const provider = new GoogleRoutesDistanceProvider({
      apiKey: "test-key",
      fetchFn: forbiddenFetch as unknown as typeof fetch,
    });

    await expect(provider.calculateDistance(coordA, coordB)).rejects.toThrow(
      /forbidden: verify key restrictions/i
    );
  });

  it("handles request timeout and network failures gracefully via ResilientRoadRoutingProvider", async () => {
    const timeoutFetch = vi.fn().mockImplementation(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "AbortError";
      throw err;
    });

    const googleProvider = new GoogleRoutesDistanceProvider({
      apiKey: "test-key",
      fetchFn: timeoutFetch as unknown as typeof fetch,
    });

    const resilient = new ResilientRoadRoutingProvider(googleProvider);
    const result = await resilient.calculateDistance(coordA, coordB);

    // Resilient fallback must return straight-line Haversine with honest disclaimer
    expect(result.distanceType).toBe("straight_line_haversine");
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.disclaimer).toContain("was temporarily unavailable");
    expect(result.disclaimer).toContain("Straight-line fallback used");
  });

  it("resolves Google provider when ROUTING_PROVIDER=google and key is set", () => {
    process.env.ROUTING_PROVIDER = "google";
    process.env.GOOGLE_MAPS_ROUTES_API_KEY = "test-secret-routes-key";

    const provider = resolveRouteDistanceProvider();
    expect(provider).toBeInstanceOf(ResilientRoadRoutingProvider);
    expect(provider.providerName).toBe("google");
  });

  it("returns honest fallback provider when ROUTING_PROVIDER=google but key is missing", async () => {
    process.env.ROUTING_PROVIDER = "google";
    delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;

    const provider = resolveRouteDistanceProvider();
    expect(provider).toBeInstanceOf(UnconfiguredGoogleRoutingFallbackProvider);
    expect(provider.providerName).toBe("haversine");

    const result = await provider.calculateDistance(coordA, coordB);
    expect(result.distanceType).toBe("straight_line_haversine");
    expect(result.disclaimer).toContain("GOOGLE_MAPS_ROUTES_API_KEY is not configured");
  });

  it("preserves stop order and produces proposal with Google provider disclaimer", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{ distanceMeters: 15000, duration: "900s" }],
      }),
    }));

    const googleProvider = new GoogleRoutesDistanceProvider({
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const stops: RouteStopCandidate[] = [
      {
        id: "stop-1",
        storeId: "store-1",
        storeName: "Downtown SF",
        address: "Market St",
        city: "San Francisco",
        region: "Bay Area",
        coordinates: coordA,
        sequenceNumber: 1,
      },
      {
        id: "stop-2",
        storeId: "store-2",
        storeName: "Oakland Center",
        address: "Broadway",
        city: "Oakland",
        region: "Bay Area",
        coordinates: coordB,
        sequenceNumber: 2,
      },
      {
        id: "stop-3",
        storeId: "store-3",
        storeName: "San Jose Plaza",
        address: "First St",
        city: "San Jose",
        region: "South Bay",
        coordinates: coordC,
        sequenceNumber: 3,
      },
    ];

    const proposal = await optimizeTripRoute({
      stops,
      distanceProvider: googleProvider,
    });

    expect(proposal.providerName).toBe("google");
    expect(proposal.distanceType).toBe("road_network_driving");
    expect(proposal.distanceDisclaimer).toContain("Google Routes API");
    expect(proposal.proposedOrder.length).toBe(3);
    expect(proposal.legs.length).toBe(2);
    expect(proposal.legs[0]?.distanceMeters).toBe(15000);
  });

  it("flags stops missing coordinates and appends them to the end of proposal", async () => {
    const stops: RouteStopCandidate[] = [
      {
        id: "stop-1",
        storeId: "store-1",
        storeName: "Valid Stop 1",
        address: "100 Main",
        city: "City",
        region: "Region",
        coordinates: coordA,
        sequenceNumber: 1,
      },
      {
        id: "stop-2",
        storeId: "store-2",
        storeName: "Missing Coords Stop",
        address: "Unresolved",
        city: "City",
        region: "Region",
        coordinates: null,
        sequenceNumber: 2,
      },
      {
        id: "stop-3",
        storeId: "store-3",
        storeName: "Valid Stop 2",
        address: "200 Oak",
        city: "City",
        region: "Region",
        coordinates: coordB,
        sequenceNumber: 3,
      },
      {
        id: "stop-4",
        storeId: "store-4",
        storeName: "Valid Stop 3",
        address: "300 Pine",
        city: "City",
        region: "Region",
        coordinates: coordC,
        sequenceNumber: 4,
      },
    ];

    const proposal = await optimizeTripRoute({
      stops,
      distanceProvider: new HaversineDistanceProvider(),
    });

    expect(proposal.stopsMissingCoordinates).toContain("Missing Coords Stop");
    // Stop with missing coordinates should be placed at the end
    const lastStop = proposal.proposedOrder[proposal.proposedOrder.length - 1];
    expect(lastStop?.storeName).toBe("Missing Coords Stop");
  });
});
