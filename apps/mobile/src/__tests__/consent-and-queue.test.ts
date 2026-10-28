import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentManager } from "../services/consent";
import { calculateBackoffDelayMs, EventQueueManager } from "../services/eventQueue";

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

let foregroundGranted = false;
let backgroundGranted = false;
let iosAccuracy: "full" | "reduced" = "full";

vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: vi.fn(() =>
    Promise.resolve({
      granted: foregroundGranted,
      ios: { scope: foregroundGranted ? "whenInUse" : "none", accuracy: iosAccuracy },
    })
  ),
  getBackgroundPermissionsAsync: vi.fn(() =>
    Promise.resolve({ granted: backgroundGranted })
  ),
  requestForegroundPermissionsAsync: vi.fn(() => {
    foregroundGranted = true;
    return Promise.resolve({
      status: "granted",
      granted: true,
      ios: { scope: "whenInUse", accuracy: iosAccuracy },
    });
  }),
  requestBackgroundPermissionsAsync: vi.fn(() => {
    backgroundGranted = true;
    return Promise.resolve({ status: "granted", granted: true });
  }),
}));

describe("FieldTrack Mobile Consent and Event Queue", () => {
  beforeEach(async () => {
    store = {};
    foregroundGranted = false;
    backgroundGranted = false;
    iosAccuracy = "full";
    ConsentManager.resetMemoryCache();
    EventQueueManager.resetMemoryCache();
    await EventQueueManager.clearQueue();
    await ConsentManager.revokeConsent();
  });

  it("enforces explicit employee consent before requesting permissions", async () => {
    const initialState = await ConsentManager.getConsentState();
    expect(initialState.consented).toBe(false);

    // Requesting permissions without consent throws error
    await expect(ConsentManager.requestForegroundPermission()).rejects.toThrow(
      /Explicit employee consent is required/
    );

    // Requesting background before foreground throws error
    await ConsentManager.grantConsent();
    await expect(ConsentManager.requestBackgroundPermission()).rejects.toThrow(
      /Foreground location permission must be granted before requesting background/
    );

    // Now foreground permission can be requested
    const fgGranted = await ConsentManager.requestForegroundPermission();
    expect(fgGranted).toBe(true);

    // Now background permission can be requested
    const bgGranted = await ConsentManager.requestBackgroundPermission();
    expect(bgGranted).toBe(true);

    const isAuth = await ConsentManager.isGeofencingAuthorized();
    expect(isAuth).toBe(true);

    // If iOS accuracy is reduced (Approximate location), geofencing authorization must be false
    iosAccuracy = "reduced";
    expect(await ConsentManager.isGeofencingAuthorized()).toBe(false);
  });

  it("supports prompt revocation of consent and survives cold restart from SecureStore", async () => {
    await ConsentManager.grantConsent();
    await ConsentManager.requestForegroundPermission();
    await ConsentManager.requestBackgroundPermission();

    expect(await ConsentManager.isGeofencingAuthorized()).toBe(true);

    // Simulate cold app restart
    ConsentManager.resetMemoryCache();
    expect(await ConsentManager.isGeofencingAuthorized()).toBe(true);

    const revoked = await ConsentManager.revokeConsent();
    expect(revoked.consented).toBe(false);
    expect(revoked.revokedAt).toBeDefined();

    ConsentManager.resetMemoryCache();
    expect(await ConsentManager.isGeofencingAuthorized()).toBe(false);
  });

  it("persists each event in its own SecureStore key (<2048 bytes) and survives cold restart", async () => {
    const e1 = await EventQueueManager.enqueueEvent({
      eventType: "geofence_entry",
      tripId: "trip-1",
      tripStopId: "stop-1",
      storeId: "store-1",
      latitude: 40.7128,
      longitude: -74.006,
      accuracyMeters: 12,
      geofenceRadiusMeters: 120,
      deviceRecordedAt: "2026-10-28T10:00:00.000Z",
    });

    const e2 = await EventQueueManager.enqueueEvent({
      eventType: "geofence_exit",
      tripId: "trip-1",
      tripStopId: "stop-1",
      storeId: "store-1",
      latitude: 40.7129,
      longitude: -74.0061,
      accuracyMeters: 15,
      geofenceRadiusMeters: 120,
      dwellTimeSeconds: 900,
      deviceRecordedAt: "2026-10-28T10:15:00.000Z",
    });

    // Verify per-item storage keys exist and each serialized value is well under 2048 bytes
    for (const [k, v] of Object.entries(store)) {
      expect(v.length).toBeLessThan(2048);
      expect(k).toBeTruthy();
    }

    // Simulate an interrupted "syncing" state before app crash/restart
    const itemKey = `fieldtrack_geofence_item_${e1.clientEventId}`;
    store[itemKey] = JSON.stringify({ ...e1, status: "syncing" });

    // Simulate cold app restart
    EventQueueManager.resetMemoryCache();

    const recoveredQueue = await EventQueueManager.getQueue();
    expect(recoveredQueue).toHaveLength(2);
    // Interrupted "syncing" event is recovered back to "queued" on startup
    expect(recoveredQueue.find((x) => x.clientEventId === e1.clientEventId)?.status).toBe(
      "queued"
    );
    expect(recoveredQueue.find((x) => x.clientEventId === e2.clientEventId)?.dwellTimeSeconds).toBe(
      900
    );
  });

  it("syncs queued events chronologically and applies exponential backoff on network failure", async () => {
    await EventQueueManager.enqueueEvent({
      eventType: "geofence_entry",
      tripId: "trip-1",
      tripStopId: "stop-1",
      storeId: "store-1",
      latitude: 40.7128,
      longitude: -74.006,
      accuracyMeters: 10,
      geofenceRadiusMeters: 120,
      deviceRecordedAt: "2026-10-28T10:00:00.000Z",
    });

    await EventQueueManager.enqueueEvent({
      eventType: "geofence_exit",
      tripId: "trip-1",
      tripStopId: "stop-1",
      storeId: "store-1",
      latitude: 40.7129,
      longitude: -74.0061,
      accuracyMeters: 15,
      geofenceRadiusMeters: 120,
      deviceRecordedAt: "2026-10-28T10:45:00.000Z",
    });

    // First attempt fails with network error on head-of-line entry event and halts sequential sync
    const failingSend = vi.fn().mockRejectedValue(new Error("Network offline"));
    const firstAttempt = await EventQueueManager.syncPendingEvents(failingSend);
    expect(firstAttempt.synced).toBe(0);
    expect(firstAttempt.failed).toBe(1);

    const queueAfterFailure = await EventQueueManager.getQueue();
    expect(queueAfterFailure[0]?.attempts).toBe(1);
    expect(queueAfterFailure[0]?.lastError).toBe("Network offline");
    expect(queueAfterFailure[0]?.nextRetryAt).toBeDefined();
    // Second event remains untouched ('queued') behind head-of-line event
    expect(queueAfterFailure[1]?.status).toBe("queued");
    expect(queueAfterFailure[1]?.attempts).toBe(0);
    expect(calculateBackoffDelayMs(1)).toBe(1000);
    expect(calculateBackoffDelayMs(2)).toBe(2000);
    expect(calculateBackoffDelayMs(3)).toBe(4000);

    // Immediate retry before backoff window is skipped
    const skippedAttempt = await EventQueueManager.syncPendingEvents(failingSend);
    expect(skippedAttempt.synced).toBe(0);
    expect(skippedAttempt.failed).toBe(0);

    // Force-bypassing backoff window succeeds in chronological order
    const calls: string[] = [];
    const mockSend = vi.fn((evt) => {
      calls.push(evt.eventType);
      return Promise.resolve({
        success: true,
        status: "processed" as const,
        serverReceivedAt: "2026-10-28T10:45:05.000Z",
        syncDelayMs: 5000,
      });
    });

    const { synced, failed } = await EventQueueManager.syncPendingEvents(mockSend, {
      ignoreBackoff: true,
    });

    expect(synced).toBe(2);
    expect(failed).toBe(0);
    expect(calls).toEqual(["geofence_entry", "geofence_exit"]);
    expect(await EventQueueManager.getQueue()).toHaveLength(0);
  });
});
