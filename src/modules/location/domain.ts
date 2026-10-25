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

export interface LocationTrackingState {
  isActive: boolean;
  activeTripId: string | null;
  lastRecordedAt: string | null;
  lastCoordinates: { latitude: number; longitude: number } | null;
  permissionStatus: "granted" | "denied" | "prompt" | "unavailable";
  errorMessage: string | null;
}
