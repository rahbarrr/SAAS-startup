export interface MobileTripStop {
  id: string;
  storeId: string;
  storeName: string;
  sequenceNumber: number;
  latitude: number | null;
  longitude: number | null;
  addressLine1: string;
  city: string;
  status: "planned" | "visited" | "skipped";
}

export interface MobileTrip {
  id: string;
  orgId: string;
  title: string;
  status: "approved" | "in_progress" | "completed";
  ownerUserId: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  stops: MobileTripStop[];
}

export type MobileTripLifecycleStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "changes_requested"
  | "rejected"
  | "in_progress"
  | "completed";

export interface MobileTripSummary {
  id: string;
  orgId: string;
  ownerUserId: string;
  title: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: MobileTripLifecycleStatus;
}

export interface MobileAuthenticatedUser {
  id: string;
  email: string;
}

export interface MobileOrganizationMembership {
  organization: {
    id: string;
    name: string;
    slug: string;
    status?: "active" | "suspended";
  };
  membership?: {
    id: string;
    orgId: string;
    userId: string;
    role: "admin" | "manager" | "field_employee";
    status: "active" | "invited" | "deactivated";
  };
  role: "admin" | "manager" | "field_employee";
  status: "active" | "invited" | "deactivated";
}

export interface MobileAuthSession {
  baseUrl: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user: MobileAuthenticatedUser;
  organizations: MobileOrganizationMembership[];
  activeOrgId: string | null;
  activeTripId?: string | null;
}

export interface GeofenceRegion {
  identifier: string; // `${tripId}:${tripStopId}:${storeId}`
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

export interface GeofenceConsentState {
  consented: boolean;
  consentedAt: string | null;
  revokedAt: string | null;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export type GeofenceEventType = "geofence_entry" | "geofence_exit";

export interface QueuedGeofenceEvent {
  clientEventId: string;
  eventType: GeofenceEventType;
  tripId: string;
  tripStopId: string;
  storeId: string;
  deviceRecordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  geofenceRadiusMeters: number;
  dwellTimeSeconds?: number | null;
  attempts: number;
  status: "queued" | "syncing" | "synced" | "failed";
  lastError?: string;
  lastAttemptAt?: string | null;
  nextRetryAt?: string | null;
}

export interface GeofenceEventSyncResponse {
  success: boolean;
  visitId?: string;
  status: "processed" | "pending_review" | "rejected" | "duplicate";
  serverReceivedAt: string;
  syncDelayMs: number;
  message?: string;
}

export interface QueuedCheckInEvent {
  clientEventId: string;
  tripStopId: string;
  storeName: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  deviceRecordedAt: string;
  status: "pending_verification" | "verified" | "failed";
  lastError?: string;
}

export interface LiveTrackingState {
  isTracking: boolean;
  activeTripId: string | null;
  sessionId: string | null;
  lastUpdateAt: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  accuracyMeters: number | null;
  syncStatus: "synced" | "pending" | "offline";
}

