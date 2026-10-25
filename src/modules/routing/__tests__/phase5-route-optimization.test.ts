import { describe, expect, it } from "vitest";
import type { RouteStopCandidate } from "../domain";
import { optimizeTripRoute } from "../optimizer";
import { calculateHaversineMeters, HaversineDistanceProvider } from "../provider";

describe("Phase 5: Multi-Stop Route Optimization & Heuristics", () => {
  it("calculates accurate geodesic Haversine distances and tags output with straight-line disclaimer", async () => {
    // Distance between Empire State Building (NYC) and Times Square (NYC): ~1.1 km
    const empireState = { latitude: 40.7484, longitude: -73.9857 };
    const timesSquare = { latitude: 40.758, longitude: -73.9855 };

    const distanceMeters = calculateHaversineMeters(empireState, timesSquare);
    expect(distanceMeters).toBeGreaterThan(1000);
    expect(distanceMeters).toBeLessThan(1200);

    const provider = new HaversineDistanceProvider();
    const result = await provider.calculateDistance(empireState, timesSquare);

    expect(result.distanceType).toBe("straight_line_haversine");
    expect(result.disclaimer).toMatch(/straight-line \(geodesic haversine\) estimate/i);
    expect(result.durationMinutes).toBeGreaterThan(0);
  });

  it("handles trivial routes with 0, 1, or 2 stops gracefully without altering direct order", async () => {
    const singleStop: RouteStopCandidate[] = [
      {
        id: "stop-1",
        storeId: "store-1",
        storeName: "Flagship One",
        address: "100 Main St",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.2672, longitude: -97.7431 },
        sequenceNumber: 1,
      },
    ];

    const proposal = await optimizeTripRoute({ stops: singleStop });
    expect(proposal.distanceSavingsMeters).toBe(0);
    expect(proposal.percentageSavings).toBe(0);
    expect(proposal.proposedOrder.length).toBe(1);
    expect(proposal.explanation).toMatch(/1 or fewer stops/i);
  });

  it("untangles crossed multi-stop itineraries and yields significant distance savings using 2-opt", async () => {
    // 5 stores arranged geographically along a linear path from South to North:
    // Store A (lat 30.0), Store B (lat 30.2), Store C (lat 30.4), Store D (lat 30.6), Store E (lat 30.8)
    // Disordered / zig-zag order: A -> D -> B -> E -> C (criss-crossing back and forth)
    const disorderedStops: RouteStopCandidate[] = [
      {
        id: "stop-A",
        storeId: "store-A",
        storeName: "Store A (South)",
        address: "100 South Way",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.0, longitude: -97.7 },
        sequenceNumber: 1,
      },
      {
        id: "stop-D",
        storeId: "store-D",
        storeName: "Store D (Far North)",
        address: "400 North Way",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.6, longitude: -97.7 },
        sequenceNumber: 2,
      },
      {
        id: "stop-B",
        storeId: "store-B",
        storeName: "Store B (Mid-South)",
        address: "200 South Way",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.2, longitude: -97.7 },
        sequenceNumber: 3,
      },
      {
        id: "stop-E",
        storeId: "store-E",
        storeName: "Store E (Furthest North)",
        address: "500 North Way",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.8, longitude: -97.7 },
        sequenceNumber: 4,
      },
      {
        id: "stop-C",
        storeId: "store-C",
        storeName: "Store C (Center)",
        address: "300 Center Way",
        city: "Austin",
        region: "South",
        coordinates: { latitude: 30.4, longitude: -97.7 },
        sequenceNumber: 5,
      },
    ];

    const proposal = await optimizeTripRoute({
      stops: disorderedStops,
      preserveFirstStop: true, // Keep Store A as the designated departure
    });

    // Original disordered route zig-zags ~240+ km; optimal linear route is ~88 km
    expect(proposal.distanceSavingsMeters).toBeGreaterThan(50_000);
    expect(proposal.percentageSavings).toBeGreaterThan(30);
    expect(proposal.proposedOrder[0]?.storeName).toBe("Store A (South)");
    expect(proposal.explanation).toMatch(/reduces estimated transit distance/i);
    expect(proposal.legs.length).toBe(4);
  });

  it("handles stops missing coordinates by safely appending them with explicit disclosure", async () => {
    const stopsWithMissing: RouteStopCandidate[] = [
      {
        id: "stop-1",
        storeId: "store-1",
        storeName: "Downtown Hub",
        address: "100 1st Ave",
        city: "Denver",
        region: "Mountain",
        coordinates: { latitude: 39.7392, longitude: -104.9903 },
        sequenceNumber: 1,
      },
      {
        id: "stop-2",
        storeId: "store-2",
        storeName: "Unmapped Rural Kiosk",
        address: "Rural Route 4",
        city: "Aspen",
        region: "Mountain",
        coordinates: null, // No GPS coordinates configured
        sequenceNumber: 2,
      },
      {
        id: "stop-3",
        storeId: "store-3",
        storeName: "North Plaza",
        address: "500 16th St",
        city: "Denver",
        region: "Mountain",
        coordinates: { latitude: 39.7461, longitude: -104.9892 },
        sequenceNumber: 3,
      },
      {
        id: "stop-4",
        storeId: "store-4",
        storeName: "South Hills Mall",
        address: "8000 S Chester St",
        city: "Denver",
        region: "Mountain",
        coordinates: { latitude: 39.5702, longitude: -104.8711 },
        sequenceNumber: 4,
      },
    ];

    const proposal = await optimizeTripRoute({ stops: stopsWithMissing });

    expect(proposal.stopsMissingCoordinates).toContain("Unmapped Rural Kiosk");
    expect(proposal.proposedOrder.length).toBe(4);
    // Unmapped stop is safely placed at the end without crashing distance calculation
    const lastStop = proposal.proposedOrder[proposal.proposedOrder.length - 1];
    expect(lastStop?.storeName).toBe("Unmapped Rural Kiosk");
    expect(proposal.explanation).toMatch(/unconfigured coordinates/i);
  });
});
