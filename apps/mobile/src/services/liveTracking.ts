import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { LiveTrackingState } from "../types";
import { FieldTrackMobileApiClient } from "./api";
import { MobileAuthService } from "./auth";
import { ConsentManager } from "./consent";

export const FIELDTRACK_LIVE_TRACKING_TASK = "FIELDTRACK_LIVE_LOCATION_TASK";

let currentLiveState: LiveTrackingState = {
  isTracking: false,
  activeTripId: null,
  sessionId: null,
  lastUpdateAt: null,
  lastLatitude: null,
  lastLongitude: null,
  accuracyMeters: null,
  syncStatus: "offline",
};

type TrackingStateListener = (state: LiveTrackingState) => void;
const stateListeners = new Set<TrackingStateListener>();

function notifyListeners(): void {
  for (const listener of stateListeners) {
    try {
      listener({ ...currentLiveState });
    } catch {
      // Non-blocking
    }
  }
}

/**
 * TaskManager background location executor.
 */
TaskManager.defineTask(FIELDTRACK_LIVE_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[FieldTrack Live Tracking] Location task error:", error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  if (!latest?.coords) return;

  const { latitude, longitude, accuracy, speed, heading } = latest.coords;
  const recordedAt = new Date(latest.timestamp).toISOString();

  currentLiveState = {
    ...currentLiveState,
    lastUpdateAt: recordedAt,
    lastLatitude: latitude,
    lastLongitude: longitude,
    accuracyMeters: accuracy,
    syncStatus: "pending",
  };
  notifyListeners();

  if (!currentLiveState.activeTripId) return;

  try {
    const session = await MobileAuthService.getSavedSession();
    if (session?.activeOrgId) {
      const client = new FieldTrackMobileApiClient({
        baseUrl: session.baseUrl,
        authToken: session.accessToken,
        orgId: session.activeOrgId,
      });

      await client.sendLocationEvent({
        tripId: currentLiveState.activeTripId,
        latitude,
        longitude,
        accuracyM: accuracy,
        speedMps: speed,
        heading: heading,
        recordedAt,
        source: "mobile_background",
      });

      currentLiveState.syncStatus = "synced";
      notifyListeners();
    }
  } catch (err) {
    currentLiveState.syncStatus = "offline";
    notifyListeners();
  }
});

export class LiveTrackingManager {
  static subscribeState(listener: TrackingStateListener): () => void {
    stateListeners.add(listener);
    listener({ ...currentLiveState });
    return () => {
      stateListeners.delete(listener);
    };
  }

  static getState(): LiveTrackingState {
    return { ...currentLiveState };
  }

  /**
   * Starts live location tracking for an authorized work trip.
   */
  static async startTracking(
    tripId: string,
    client: FieldTrackMobileApiClient
  ): Promise<LiveTrackingState> {
    const isAuthorized = await ConsentManager.isGeofencingAuthorized();
    if (!isAuthorized) {
      throw new Error(
        "Location tracking requires employee consent and granted permissions."
      );
    }

    // Register tracking session on backend
    const sessionResult = await client.startTrackingSession({
      tripId,
      consentRecordedAt: new Date().toISOString(),
    });

    // Start background location updates with balanced power/distance configuration
    await Location.startLocationUpdatesAsync(FIELDTRACK_LIVE_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000, // Every 60s when moving
      distanceInterval: 25, // Or every 25 meters
      showsBackgroundLocationIndicator: true, // iOS blue bar / Android persistent indicator
      foregroundService: {
        notificationTitle: "FieldTrack Live Tracking Active",
        notificationBody: "Sharing trip location during authorized work hours.",
        notificationColor: "#2563eb",
      },
      pausesUpdatesAutomatically: true,
    });

    currentLiveState = {
      isTracking: true,
      activeTripId: tripId,
      sessionId: sessionResult.id,
      lastUpdateAt: new Date().toISOString(),
      lastLatitude: null,
      lastLongitude: null,
      accuracyMeters: null,
      syncStatus: "synced",
    };
    notifyListeners();

    // Trigger an immediate reading
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (current?.coords) {
        currentLiveState.lastLatitude = current.coords.latitude;
        currentLiveState.lastLongitude = current.coords.longitude;
        currentLiveState.accuracyMeters = current.coords.accuracy;
        await client.sendLocationEvent({
          tripId,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracyM: current.coords.accuracy,
          speedMps: current.coords.speed,
          heading: current.coords.heading,
          recordedAt: new Date(current.timestamp).toISOString(),
          source: "mobile_foreground",
        });
      }
    } catch {
      // Non-blocking initial fix
    }

    notifyListeners();
    return currentLiveState;
  }

  /**
   * Stops live location tracking.
   */
  static async stopTracking(
    client?: FieldTrackMobileApiClient,
    reason?: string
  ): Promise<void> {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(
        FIELDTRACK_LIVE_TRACKING_TASK
      );
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(FIELDTRACK_LIVE_TRACKING_TASK);
      }
    } catch {
      // Non-blocking
    }

    if (currentLiveState.activeTripId && client) {
      try {
        await client.stopTrackingSession({
          tripId: currentLiveState.activeTripId,
          reason: reason ?? "Trip ended or user stopped tracking",
        });
      } catch {
        // Non-blocking backend session cleanup
      }
    }

    currentLiveState = {
      isTracking: false,
      activeTripId: null,
      sessionId: null,
      lastUpdateAt: null,
      lastLatitude: null,
      lastLongitude: null,
      accuracyMeters: null,
      syncStatus: "offline",
    };
    notifyListeners();
  }
}
