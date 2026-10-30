export interface TripLocationBreadcrumb {
  id: string;
  orgId: string;
  tripId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
  createdAt: string;
}

export interface RecordBreadcrumbInput {
  orgId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  recordedAt?: string;
}

export interface LocationTrackingSession {
  id: string;
  orgId: string;
  tripId: string;
  employeeId: string;
  startedAt: string;
  endedAt: string | null;
  consentRecordedAt: string;
  status: "active" | "stopped" | "completed" | "expired";
  createdAt: string;
}

export interface LocationEvent {
  id: string;
  orgId: string;
  tripId: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  speedMps: number | null;
  heading: number | null;
  recordedAt: string;
  receivedAt: string;
  source: "mobile_foreground" | "mobile_background" | "manual_refresh" | "geofence_trigger";
  createdAt: string;
}

export interface LatestEmployeeLocation {
  employeeId: string;
  orgId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
  receivedAt: string;
  trackingStatus: "active" | "stationary" | "delayed" | "stale" | "offline" | "stopped";
  employeeName?: string;
  employeeEmail?: string;
  tripTitle?: string;
}

export interface StoreGeofence {
  id: string;
  orgId: string;
  storeId: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceEventRecord {
  id: string;
  orgId: string;
  tripId: string;
  visitId: string | null;
  storeId: string;
  employeeId: string;
  eventType: "enter" | "exit";
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
  createdAt: string;
}

export interface LocationFreshnessAssessment {
  status: "fresh" | "delayed" | "stale" | "unavailable";
  ageSeconds: number | null;
  isAccurate: boolean;
  warningNote: string | null;
}

export function assessLocationFreshness(
  recordedAt: string | null | undefined,
  accuracyM: number | null | undefined,
  now: Date = new Date()
): LocationFreshnessAssessment {
  if (!recordedAt) {
    return {
      status: "unavailable",
      ageSeconds: null,
      isAccurate: false,
      warningNote: "No location updates received yet",
    };
  }

  const recordedTime = new Date(recordedAt).getTime();
  const currentTime = now.getTime();
  const ageSeconds = Math.max(0, Math.floor((currentTime - recordedTime) / 1000));
  const isAccurate = accuracyM !== null && accuracyM !== undefined && accuracyM <= 50;

  if (ageSeconds <= 180) {
    // Under 3 minutes
    return {
      status: "fresh",
      ageSeconds,
      isAccurate,
      warningNote: !isAccurate ? `GPS accuracy is low (${Math.round(accuracyM ?? 0)}m)` : null,
    };
  }

  if (ageSeconds <= 600) {
    // 3 - 10 minutes
    return {
      status: "delayed",
      ageSeconds,
      isAccurate,
      warningNote: `Location update delayed by ${Math.round(ageSeconds / 60)} minutes`,
    };
  }

  return {
    status: "stale",
    ageSeconds,
    isAccurate,
    warningNote: `Location is stale (${Math.round(ageSeconds / 60)} minutes old)`,
  };
}

