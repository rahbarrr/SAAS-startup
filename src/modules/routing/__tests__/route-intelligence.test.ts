import { describe, expect, it } from "vitest";
import { assessLocationFreshness } from "@/modules/location/domain";
import { evaluateTripRouteActivity } from "@/modules/routing/intelligence";

describe("Live Location, Freshness & Route Intelligence Engine", () => {
  it("correctly assesses location freshness: fresh (< 3 mins), delayed (3-10 mins), stale (> 10 mins)", () => {
    const now = new Date("2026-10-30T12:00:00Z");

    const fresh = assessLocationFreshness("2026-10-30T11:58:30Z", 20, now);
    expect(fresh.status).toBe("fresh");
    expect(fresh.isAccurate).toBe(true);
    expect(fresh.warningNote).toBeNull();

    const lowAccuracy = assessLocationFreshness("2026-10-30T11:58:30Z", 120, now);
    expect(lowAccuracy.status).toBe("fresh");
    expect(lowAccuracy.isAccurate).toBe(false);
    expect(lowAccuracy.warningNote).toContain("GPS accuracy is low");

    const delayed = assessLocationFreshness("2026-10-30T11:55:00Z", 30, now);
    expect(delayed.status).toBe("delayed");
    expect(delayed.warningNote).toContain("delayed");

    const stale = assessLocationFreshness("2026-10-30T11:40:00Z", 25, now);
    expect(stale.status).toBe("stale");
    expect(stale.warningNote).toContain("stale");

    const unavailable = assessLocationFreshness(null, null, now);
    expect(unavailable.status).toBe("unavailable");
  });

  it("evaluates route deviations: identifies out-of-boundary checkins and missed stores", () => {
    const now = new Date("2026-10-30T15:00:00Z");

    const analysis = evaluateTripRouteActivity({
      trip: {
        id: "trip-1",
        ownerUserId: "emp-1",
        startDate: "2026-10-30",
        endDate: "2026-10-30",
        status: "completed",
      },
      stops: [
        {
          id: "stop-1",
          storeId: "store-1",
          sequenceNumber: 1,
          status: "visited",
          store: {
            name: "Downtown Supermarket",
            latitude: 37.7749,
            longitude: -122.4194,
          },
        },
        {
          id: "stop-2",
          storeId: "store-2",
          sequenceNumber: 2,
          status: "planned", // not visited on completed trip
          store: {
            name: "Uptown Market",
            latitude: 37.7849,
            longitude: -122.4094,
          },
        },
      ],
      visits: [
        {
          id: "vis-1",
          tripStopId: "stop-1",
          checkedInAt: "2026-10-30T10:00:00Z",
          checkedOutAt: "2026-10-30T10:45:00Z",
          status: "submitted",
          checkInLocation: {
            latitude: 37.78, // ~600m away from store
            longitude: -122.4194,
            accuracyMeters: 20,
            status: "captured_unverified",
          },
        },
      ],
      latestLocation: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyM: 15,
        recordedAt: "2026-10-30T11:00:00Z",
      },
      now,
    });

    expect(analysis.visitedStopCount).toBe(1);
    expect(analysis.missedStopCount).toBe(1);

    // Should flag out_of_boundary_checkin and missed_store
    const outOfBounds = analysis.alerts.find((a) => a.type === "out_of_boundary_checkin");
    expect(outOfBounds).toBeDefined();
    expect(outOfBounds?.message).toContain("exceeds 150m geofence radius");

    const missed = analysis.alerts.find((a) => a.type === "missed_store");
    expect(missed).toBeDefined();
    expect(missed?.message).toContain("was not visited");
  });

  it("detects extended inactivity alerts during active in_progress trips", () => {
    const now = new Date("2026-10-30T14:00:00Z");

    const analysis = evaluateTripRouteActivity({
      trip: {
        id: "trip-active",
        ownerUserId: "emp-2",
        startDate: "2026-10-30",
        endDate: "2026-10-30",
        status: "in_progress",
      },
      stops: [
        {
          id: "stop-1",
          storeId: "store-1",
          sequenceNumber: 1,
          status: "planned",
          store: { name: "Store 1", latitude: 37.7, longitude: -122.4 },
        },
      ],
      visits: [],
      latestLocation: {
        latitude: 37.7,
        longitude: -122.4,
        accuracyM: 15,
        recordedAt: "2026-10-30T12:00:00Z", // 2 hours ago
      },
      now,
    });

    const inactivityAlert = analysis.alerts.find((a) => a.type === "extended_inactivity");
    expect(inactivityAlert).toBeDefined();
    expect(inactivityAlert?.severity).toBe("critical");
    expect(inactivityAlert?.message).toContain(
      "No GPS location updates received for 120 minutes"
    );
  });
});
