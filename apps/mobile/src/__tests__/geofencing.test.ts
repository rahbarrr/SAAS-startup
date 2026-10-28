import * as Location from "expo-location";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentManager } from "../services/consent";
import { EventQueueManager } from "../services/eventQueue";
import {
  buildRegionIdentifier,
  DEFAULT_GEOFENCE_RADIUS_METERS,
  FIELDTRACK_GEOFENCE_TASK,
  GeofenceManager,
  handleGeofenceTaskEvent,
  MAX_CONCURRENT_REGIONS,
  parseRegionIdentifier,
} from "../services/geofencing";
import type { MobileTrip, MobileTripStop } from "../types";

// Mock expo-location
vi.mock("expo-location", () => ({
  startGeofencingAsync: vi.fn().mockResolvedValue(undefined),
  stopGeofencingAsync: vi.fn().mockResolvedValue(undefined),
  hasStartedGeofencingAsync: vi.fn().mockResolvedValue(true),
  getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  getBackgroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestBackgroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getLastKnownPositionAsync: vi.fn().mockResolvedValue({
    coords: { latitude: 40.7128, longitude: -74.006, accuracy: 15 },
  }),
  GeofencingEventType: {
    Enter: 1,
    Exit: 2,
  },
}));

// Mock expo-task-manager
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn().mockResolvedValue(true),
}));

// Mock expo-secure-store
let store: Record<string, string> = {};
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: vi.fn((key: string, val: string) => {
    store[key] = val;
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
}));

describe("FieldTrack Mobile Geofencing Manager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    store = {
      fieldtrack_geofence_consent_v1: JSON.stringify({
        consented: true,
        consentedAt: "2026-10-28T00:00:00.000Z",
        revokedAt: null,
        foregroundGranted: true,
        backgroundGranted: true,
      }),
    };
    ConsentManager.resetMemoryCache();
    EventQueueManager.resetMemoryCache();
    await EventQueueManager.clearQueue();
    await GeofenceManager.stopGeofencing();
  });

  it("builds and parses region identifiers reliably", () => {
    const tripId = "trip-123";
    const stopId = "stop-456";
    const storeId = "store-789";

    const id = buildRegionIdentifier(tripId, stopId, storeId);
    expect(id).toBe("trip-123:stop-456:store-789");

    const parsed = parseRegionIdentifier(id);
    expect(parsed).toEqual({
      tripId: "trip-123",
      tripStopId: "stop-456",
      storeId: "store-789",
    });

    expect(parseRegionIdentifier("invalid")).toBeNull();
    expect(parseRegionIdentifier("a:b")).toBeNull();
    expect(FIELDTRACK_GEOFENCE_TASK).toBe("FIELDTRACK_BACKGROUND_GEOFENCE_TASK");
  });

  it("registers valid stops sorted by sequenceNumber within the 120m default radius", async () => {
    const trip: MobileTrip = {
      id: "trip-1",
      orgId: "org-1",
      title: "Manhattan Retail Tour",
      status: "approved",
      ownerUserId: "emp-1",
      stops: [
        {
          id: "stop-2",
          storeId: "store-2",
          storeName: "Crosby Boutique",
          sequenceNumber: 2,
          latitude: 40.72,
          longitude: -74.0,
          addressLine1: "45 Crosby St",
          city: "New York",
          status: "planned",
        },
        {
          id: "stop-1",
          storeId: "store-1",
          storeName: "Broadway Supermarket",
          sequenceNumber: 1,
          latitude: 40.7128,
          longitude: -74.006,
          addressLine1: "123 Broadway",
          city: "New York",
          status: "planned",
        },
      ],
    };

    const result = await GeofenceManager.registerTripGeofences(trip, {
      currentUserId: "emp-1",
    });
    expect(result.registeredCount).toBe(2);
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0]?.radius).toBe(DEFAULT_GEOFENCE_RADIUS_METERS);
    expect(result.regions[0]?.identifier).toBe("trip-1:stop-1:store-1");
    expect(result.regions[1]?.identifier).toBe("trip-1:stop-2:store-2");
    expect(result.skippedUnconfiguredCount).toBe(0);
    expect(result.overlappingRegionWarnings).toHaveLength(0);
  });

  it("detects overlapping store geofence boundaries and shrinks radii to prevent cross-triggering", async () => {
    const trip: MobileTrip = {
      id: "trip-overlap",
      orgId: "org-1",
      title: "Adjacent Stores Tour",
      status: "approved",
      ownerUserId: "emp-1",
      stops: [
        {
          id: "stop-a",
          storeId: "store-a",
          storeName: "Store A",
          sequenceNumber: 1,
          latitude: 40.7128,
          longitude: -74.006,
          addressLine1: "100 Main St",
          city: "New York",
          status: "planned",
        },
        {
          id: "stop-b",
          storeId: "store-b",
          storeName: "Store B (100m away)",
          sequenceNumber: 2,
          latitude: 40.7135, // ~78m north of Store A (< 240m combined radii)
          longitude: -74.006,
          addressLine1: "104 Main St",
          city: "New York",
          status: "planned",
        },
      ],
    };

    const result = await GeofenceManager.registerTripGeofences(trip);
    expect(result.registeredCount).toBe(2);
    expect(result.overlappingRegionWarnings).toHaveLength(1);
    expect(result.overlappingRegionWarnings[0]).toContain("Store A");
    expect(result.overlappingRegionWarnings[0]).toContain("Store B");
    expect(result.regions[0]!.radius).toBeLessThan(DEFAULT_GEOFENCE_RADIUS_METERS);
    expect(result.regions[1]!.radius).toBeLessThan(DEFAULT_GEOFENCE_RADIUS_METERS);
  });

  it("skips stops without coordinates and stops already visited", async () => {
    const trip: MobileTrip = {
      id: "trip-2",
      orgId: "org-1",
      title: "Mixed Stops Trip",
      status: "in_progress",
      ownerUserId: "emp-1",
      stops: [
        {
          id: "stop-1",
          storeId: "store-1",
          storeName: "Valid Planned Store",
          sequenceNumber: 1,
          latitude: 40.71,
          longitude: -74.01,
          addressLine1: "1 Main St",
          city: "New York",
          status: "planned",
        },
        {
          id: "stop-2",
          storeId: "store-2",
          storeName: "Unconfigured Store",
          sequenceNumber: 2,
          latitude: null,
          longitude: null,
          addressLine1: "2 Main St",
          city: "New York",
          status: "planned",
        },
        {
          id: "stop-3",
          storeId: "store-3",
          storeName: "Already Visited Store",
          sequenceNumber: 3,
          latitude: 40.73,
          longitude: -74.03,
          addressLine1: "3 Main St",
          city: "New York",
          status: "visited",
        },
      ],
    };

    const result = await GeofenceManager.registerTripGeofences(trip);
    expect(result.registeredCount).toBe(1);
    expect(result.regions[0]?.identifier).toBe("trip-2:stop-1:store-1");
    expect(result.skippedUnconfiguredCount).toBe(1);
  });

  it("strictly enforces the cross-platform maximum limit of 20 regions", async () => {
    const stops: MobileTripStop[] = [];
    for (let i = 1; i <= 25; i++) {
      stops.push({
        id: `stop-${i}`,
        storeId: `store-${i}`,
        storeName: `Store ${i}`,
        sequenceNumber: i,
        latitude: 40.7 + i * 0.003,
        longitude: -74.0 + i * 0.003,
        addressLine1: `${i} Market St`,
        city: "New York",
        status: "planned",
      });
    }

    const trip: MobileTrip = {
      id: "trip-large",
      orgId: "org-1",
      title: "Large Store Chain Route",
      status: "approved",
      ownerUserId: "emp-1",
      stops,
    };

    const result = await GeofenceManager.registerTripGeofences(trip);
    expect(result.registeredCount).toBe(MAX_CONCURRENT_REGIONS);
    expect(result.regions).toHaveLength(20);
  });

  it("rejects geofencing when trip status is not approved/in_progress or owner does not match", async () => {
    const draftTrip: MobileTrip = {
      id: "trip-draft",
      orgId: "org-1",
      title: "Draft Trip",
      status: "completed",
      ownerUserId: "emp-1",
      stops: [
        {
          id: "stop-1",
          storeId: "store-1",
          storeName: "Store 1",
          sequenceNumber: 1,
          latitude: 40.7,
          longitude: -74.0,
          addressLine1: "1 Main St",
          city: "New York",
          status: "planned",
        },
      ],
    };

    await expect(GeofenceManager.registerTripGeofences(draftTrip)).rejects.toThrow(
      /Cannot start geofencing: trip status is 'completed'/
    );

    const wrongOwnerTrip: MobileTrip = {
      ...draftTrip,
      status: "approved",
      ownerUserId: "emp-owner",
    };

    await expect(
      GeofenceManager.registerTripGeofences(wrongOwnerTrip, {
        currentUserId: "emp-other",
      })
    ).rejects.toThrow(/only the assigned trip owner can register geofences/);
  });

  it("processes background Enter and Exit task events, computes dwellTimeSeconds, and suppresses rapid hysteresis oscillations", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-28T10:00:00.000Z"));
      const region = {
        identifier: "trip-1:stop-1:store-1",
        latitude: 40.7128,
        longitude: -74.006,
        radius: 120,
      };

      // 1. Enter event
      await handleGeofenceTaskEvent({
        data: {
          eventType: Location.GeofencingEventType.Enter,
          region,
        },
        error: null,
      });

      let queue = await EventQueueManager.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.eventType).toBe("geofence_entry");
      expect(queue[0]?.dwellTimeSeconds).toBeNull();

      // 2. Rapid duplicate Enter within 15s hysteresis window is suppressed
      vi.advanceTimersByTime(10_000);
      await handleGeofenceTaskEvent({
        data: {
          eventType: Location.GeofencingEventType.Enter,
          region,
        },
        error: null,
      });

      queue = await EventQueueManager.getQueue();
      expect(queue).toHaveLength(1); // still 1

      // 3. Advance 10 minutes (600s total dwell time since initial entry) and fire Exit event
      vi.setSystemTime(new Date("2026-10-28T10:10:00.000Z"));
      await handleGeofenceTaskEvent({
        data: {
          eventType: Location.GeofencingEventType.Exit,
          region,
        },
        error: null,
      });

      queue = await EventQueueManager.getQueue();
      expect(queue).toHaveLength(2);
      const exitEvent = queue.find((e) => e.eventType === "geofence_exit");
      expect(exitEvent).toBeDefined();
      expect(exitEvent?.dwellTimeSeconds).toBe(600);
    } finally {
      vi.useRealTimers();
    }
  });

  it("immediately deregisters OS geofences when ConsentManager.revokeConsent() is called", async () => {
    const trip: MobileTrip = {
      id: "trip-1",
      orgId: "org-1",
      title: "Active Trip",
      status: "in_progress",
      ownerUserId: "emp-1",
      stops: [
        {
          id: "stop-1",
          storeId: "store-1",
          storeName: "Store 1",
          sequenceNumber: 1,
          latitude: 40.7128,
          longitude: -74.006,
          addressLine1: "123 Broadway",
          city: "New York",
          status: "planned",
        },
      ],
    };

    await GeofenceManager.registerTripGeofences(trip);
    expect(GeofenceManager.getActiveTrip()?.id).toBe("trip-1");

    await ConsentManager.revokeConsent();

    expect(Location.stopGeofencingAsync).toHaveBeenCalledWith(FIELDTRACK_GEOFENCE_TASK);
    expect(GeofenceManager.getActiveTrip()).toBeNull();
  });
});
