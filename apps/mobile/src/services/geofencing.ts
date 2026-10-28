import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import type { GeofenceRegion, MobileTrip, MobileTripStop } from "../types";
import { FieldTrackMobileApiClient } from "./api";
import { MobileAuthService } from "./auth";
import { ConsentManager } from "./consent";
import { EventQueueManager } from "./eventQueue";

export const FIELDTRACK_GEOFENCE_TASK = "FIELDTRACK_BACKGROUND_GEOFENCE_TASK";
export const DEFAULT_GEOFENCE_RADIUS_METERS = 120;
export const MIN_GEOFENCE_RADIUS_METERS = 50;
export const MAX_GEOFENCE_RADIUS_METERS = 500;
export const MAX_CONCURRENT_REGIONS = 20;

const ENTRY_TIMESTAMPS_STORAGE_KEY = "fieldtrack_geofence_entries_v1";

export interface GeofenceServiceConfig {
  radiusMeters?: number;
  minDwellSeconds?: number;
  onEventProcessed?: (event: {
    eventType: "geofence_entry" | "geofence_exit";
    tripStopId: string;
    storeId: string;
    dwellTimeSeconds: number | null;
  }) => Promise<void> | void;
}

// Memory cache for active trip stops, entry dwell tracking, and oscillation protection
let activeMonitoredTrip: MobileTrip | null = null;
let lastEventTimestamps: Record<string, number> = {};
let stopEntryTimestamps: Record<string, number> = {};
let config: GeofenceServiceConfig = {
  radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  minDwellSeconds: 30,
};

/**
 * Calculates Haversine distance in meters between two WGS84 coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

/**
 * Parses region identifier format: `${tripId}:${tripStopId}:${storeId}`
 */
export function parseRegionIdentifier(identifier: string): {
  tripId: string;
  tripStopId: string;
  storeId: string;
} | null {
  const parts = identifier.split(":");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }
  return {
    tripId: parts[0],
    tripStopId: parts[1],
    storeId: parts[2],
  };
}

/**
 * Builds standard region identifier format.
 */
export function buildRegionIdentifier(
  tripId: string,
  tripStopId: string,
  storeId: string
): string {
  return `${tripId}:${tripStopId}:${storeId}`;
}

async function loadEntryTimestamps(): Promise<Record<string, number>> {
  if (Object.keys(stopEntryTimestamps).length > 0) {
    return stopEntryTimestamps;
  }
  try {
    const raw = await SecureStore.getItemAsync(ENTRY_TIMESTAMPS_STORAGE_KEY);
    if (raw) {
      stopEntryTimestamps = JSON.parse(raw) as Record<string, number>;
    }
  } catch {
    // Non-blocking
  }
  return stopEntryTimestamps;
}

async function persistEntryTimestamps(): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      ENTRY_TIMESTAMPS_STORAGE_KEY,
      JSON.stringify(stopEntryTimestamps)
    );
  } catch {
    // Non-blocking
  }
}

export interface GeofenceTaskPayload {
  data?: {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  error?: TaskManager.TaskManagerError | null;
}

/**
 * Core handler invoked by Expo TaskManager when the OS reports a geofence transition.
 * Exported for deterministic unit/integration testing of background task execution.
 */
export async function handleGeofenceTaskEvent({
  data,
  error,
}: GeofenceTaskPayload): Promise<void> {
  if (error) {
    console.warn("[FieldTrack Geofence Task] TaskManager error:", error.message);
    return;
  }

  if (!data?.region?.identifier || data.eventType === undefined) {
    return;
  }

  const parsed = parseRegionIdentifier(data.region.identifier);
  if (!parsed) {
    return;
  }

  // Verify employee consent and permissions are still valid
  const isAuthorized = await ConsentManager.isGeofencingAuthorized();
  if (!isAuthorized) {
    console.warn(
      "[FieldTrack Geofence Task] Event ignored: consent not granted or revoked."
    );
    await GeofenceManager.stopGeofencing();
    return;
  }

  const isEntry = data.eventType === Location.GeofencingEventType.Enter;
  const isExit = data.eventType === Location.GeofencingEventType.Exit;

  if (!isEntry && !isExit) {
    return;
  }

  const eventType = isEntry ? "geofence_entry" : "geofence_exit";
  const cacheKey = `${parsed.tripStopId}:${eventType}`;
  const now = Date.now();

  // Hysteresis & anti-oscillation: ignore rapid duplicate events within 15 seconds
  const lastTimestamp = lastEventTimestamps[cacheKey] ?? 0;
  if (now - lastTimestamp < 15_000) {
    return;
  }
  lastEventTimestamps[cacheKey] = now;

  // Track entry timestamp and compute dwell time on exit
  await loadEntryTimestamps();
  let dwellTimeSeconds: number | null = null;
  if (isEntry) {
    stopEntryTimestamps[parsed.tripStopId] = now;
    await persistEntryTimestamps();
  } else {
    const entryMs = stopEntryTimestamps[parsed.tripStopId];
    if (entryMs !== undefined && now >= entryMs) {
      dwellTimeSeconds = Math.round((now - entryMs) / 1000);
      delete stopEntryTimestamps[parsed.tripStopId];
      await persistEntryTimestamps();
    }
  }

  // Capture device coordinates at the time of the event
  let currentLat = data.region.latitude ?? 0;
  let currentLng = data.region.longitude ?? 0;
  let currentAccuracy: number | null = null;

  try {
    const position = await Location.getLastKnownPositionAsync();
    if (position?.coords) {
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      currentAccuracy = position.coords.accuracy ?? null;
    }
  } catch {
    // Fall back to region center
  }

  const recordedIso = new Date(now).toISOString();

  // Enqueue event for offline resilience and chronological sync
  await EventQueueManager.enqueueEvent({
    eventType,
    tripId: parsed.tripId,
    tripStopId: parsed.tripStopId,
    storeId: parsed.storeId,
    latitude: currentLat,
    longitude: currentLng,
    accuracyMeters: currentAccuracy,
    geofenceRadiusMeters:
      data.region.radius ?? config.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
    dwellTimeSeconds,
    deviceRecordedAt: recordedIso,
  });

  if (config.onEventProcessed) {
    await config.onEventProcessed({
      eventType,
      tripStopId: parsed.tripStopId,
      storeId: parsed.storeId,
      dwellTimeSeconds,
    });
  } else {
    try {
      const savedSession = await MobileAuthService.getSavedSession();
      if (savedSession?.activeOrgId) {
        const client = new FieldTrackMobileApiClient({
          baseUrl: savedSession.baseUrl,
          authToken: savedSession.accessToken,
          orgId: savedSession.activeOrgId,
        });
        await EventQueueManager.syncPendingEvents((evt) =>
          client.sendGeofenceEvent(evt)
        );
      }
    } catch {
      // Non-blocking: event remains persisted in SecureStore for subsequent sync
    }
  }
}

/**
 * Top-level background task registration required by Expo TaskManager.
 * Must be called at module evaluation time outside any React component.
 */
TaskManager.defineTask(FIELDTRACK_GEOFENCE_TASK, handleGeofenceTaskEvent);

// Automatically stop OS geofencing whenever employee consent is revoked
ConsentManager.onConsentRevoked(async () => {
  await GeofenceManager.stopGeofencing();
});

export class GeofenceManager {
  /**
   * Configures geofence parameters.
   */
  static configure(newConfig: Partial<GeofenceServiceConfig>): void {
    config = { ...config, ...newConfig };
    if (config.radiusMeters) {
      config.radiusMeters = Math.max(
        MIN_GEOFENCE_RADIUS_METERS,
        Math.min(MAX_GEOFENCE_RADIUS_METERS, config.radiusMeters)
      );
    }
  }

  /**
   * Registers geofences for an active authorized trip.
   */
  static async registerTripGeofences(
    trip: MobileTrip,
    options?: { currentUserId?: string }
  ): Promise<{
    registeredCount: number;
    regions: GeofenceRegion[];
    skippedUnconfiguredCount: number;
    overlappingRegionWarnings: string[];
  }> {
    const isAuthorized = await ConsentManager.isGeofencingAuthorized();
    if (!isAuthorized) {
      throw new Error(
        "Cannot start geofencing: employee consent and both foreground & background location permissions are required."
      );
    }

    if (options?.currentUserId && trip.ownerUserId !== options.currentUserId) {
      throw new Error(
        "Cannot start geofencing: only the assigned trip owner can register geofences for this trip."
      );
    }

    if (trip.status !== "approved" && trip.status !== "in_progress") {
      throw new Error(
        `Cannot start geofencing: trip status is '${trip.status}', but must be 'approved' or 'in_progress'.`
      );
    }

    const plannedStops = [...trip.stops]
      .filter((stop) => stop.status === "planned")
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Filter valid stops with finite WGS84 coordinates and cap at 20 regions
    const validStops = plannedStops
      .filter(
        (stop) =>
          stop.latitude !== null &&
          stop.longitude !== null &&
          typeof stop.latitude === "number" &&
          typeof stop.longitude === "number" &&
          Number.isFinite(stop.latitude) &&
          Number.isFinite(stop.longitude) &&
          stop.latitude >= -90 &&
          stop.latitude <= 90 &&
          stop.longitude >= -180 &&
          stop.longitude <= 180
      )
      .slice(0, MAX_CONCURRENT_REGIONS);

    const skippedUnconfiguredCount = plannedStops.length - validStops.length;

    if (validStops.length === 0) {
      await this.stopGeofencing();
      return {
        registeredCount: 0,
        regions: [],
        skippedUnconfiguredCount,
        overlappingRegionWarnings: [],
      };
    }

    const baseRadius = config.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
    const overlappingRegionWarnings: string[] = [];

    // Compute per-stop radius, shrinking if two stops have overlapping geofence boundaries
    const radii = validStops.map(() => baseRadius);
    for (let i = 0; i < validStops.length; i++) {
      for (let j = i + 1; j < validStops.length; j++) {
        const stopA = validStops[i];
        const stopB = validStops[j];
        if (!stopA || !stopB) continue;

        const dist = calculateDistanceMeters(
          stopA.latitude as number,
          stopA.longitude as number,
          stopB.latitude as number,
          stopB.longitude as number
        );

        const combinedRadius = (radii[i] ?? baseRadius) + (radii[j] ?? baseRadius);
        if (dist < combinedRadius) {
          const adjusted = Math.max(
            MIN_GEOFENCE_RADIUS_METERS,
            Math.floor(Math.max(0, dist - 10) / 2)
          );
          radii[i] = Math.min(radii[i] ?? baseRadius, adjusted);
          radii[j] = Math.min(radii[j] ?? baseRadius, adjusted);
          overlappingRegionWarnings.push(
            `Stops '${stopA.storeName}' and '${stopB.storeName}' are ${dist}m apart; adjusted geofence radius to ${adjusted}m to reduce overlap.`
          );
        }
      }
    }

    const regions: GeofenceRegion[] = validStops.map(
      (stop: MobileTripStop, idx: number) => ({
        identifier: buildRegionIdentifier(trip.id, stop.id, stop.storeId),
        latitude: stop.latitude as number,
        longitude: stop.longitude as number,
        radius: radii[idx] ?? baseRadius,
        notifyOnEnter: true,
        notifyOnExit: true,
      })
    );

    activeMonitoredTrip = trip;

    // Register with native OS geofencing provider via Expo Location
    await Location.startGeofencingAsync(FIELDTRACK_GEOFENCE_TASK, regions);

    return {
      registeredCount: regions.length,
      regions,
      skippedUnconfiguredCount,
      overlappingRegionWarnings,
    };
  }

  /**
   * Stops active geofencing and cleans up registered regions.
   * Called on trip completion, trip cancellation, or consent revocation.
   */
  static async stopGeofencing(): Promise<void> {
    try {
      const isRunning = await Location.hasStartedGeofencingAsync(
        FIELDTRACK_GEOFENCE_TASK
      );
      if (isRunning) {
        await Location.stopGeofencingAsync(FIELDTRACK_GEOFENCE_TASK);
      }
    } catch {
      // Non-blocking
    }

    activeMonitoredTrip = null;
    lastEventTimestamps = {};
    stopEntryTimestamps = {};
    try {
      await SecureStore.deleteItemAsync(ENTRY_TIMESTAMPS_STORAGE_KEY);
    } catch {
      // Non-blocking
    }
  }

  /**
   * Checks if geofencing is currently actively running on the device.
   */
  static async isRunning(): Promise<boolean> {
    try {
      return await Location.hasStartedGeofencingAsync(FIELDTRACK_GEOFENCE_TASK);
    } catch {
      return false;
    }
  }

  /**
   * Returns the currently monitored trip stops if active.
   */
  static getActiveTrip(): MobileTrip | null {
    return activeMonitoredTrip;
  }
}
