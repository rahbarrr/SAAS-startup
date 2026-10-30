import type {
  GeofenceEventSyncResponse,
  MobileOrganizationMembership,
  MobileTrip,
  MobileTripStop,
  MobileTripSummary,
  QueuedGeofenceEvent,
} from "../types";
import { normalizeOrganizationMemberships } from "./auth";

export interface MobileApiConfig {
  baseUrl: string;
  authToken: string;
  orgId: string;
}

interface RawTripStopRecord {
  id: string;
  storeId: string;
  sequenceNumber: number;
  status: "planned" | "visited" | "skipped";
}

interface RawTripDetailResponse {
  trip: {
    id: string;
    orgId: string;
    ownerUserId: string;
    title: string;
    startDate: string;
    endDate: string;
    purpose: string;
    status: MobileTripSummary["status"];
  };
  stops: RawTripStopRecord[];
}

interface RawStoreRecord {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

export class FieldTrackMobileApiClient {
  constructor(private readonly config: MobileApiConfig) {}

  getOrgId(): string {
    return this.config.orgId;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.authToken}`,
    };
  }

  /**
   * Lists the authenticated user's active organizations.
   */
  async listOrganizations(): Promise<MobileOrganizationMembership[]> {
    const url = `${this.config.baseUrl}/api/orgs`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.error?.message ?? `Failed to load organizations (${response.status})`
      );
    }

    return normalizeOrganizationMemberships(body?.data);
  }

  /**
   * Creates a new organization workspace where the authenticated caller is the admin owner.
   */
  async createOrganization(params: {
    name: string;
    slug: string;
  }): Promise<{ id: string; name: string; slug: string }> {
    const url = `${this.config.baseUrl}/api/orgs`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name: params.name.trim(),
        slug: params.slug.trim().toLowerCase(),
      }),
    });

    const body = await response.json();
    if (!response.ok || !body?.data?.id) {
      throw new Error(
        body?.error?.message ??
          `Failed to create organization (${response.status})`
      );
    }

    return body.data as { id: string; name: string; slug: string };
  }

  /**
   * Accepts an organization invitation token for the authenticated caller.
   */
  async acceptInvitation(params: {
    token: string;
  }): Promise<{ orgId: string; role: string }> {
    const url = `${this.config.baseUrl}/api/invitations/accept`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        token: params.token.trim(),
      }),
    });

    const body = await response.json();
    if (!response.ok || !body?.data?.orgId) {
      throw new Error(
        body?.error?.message ??
          `Failed to accept invitation (${response.status})`
      );
    }

    return body.data as { orgId: string; role: string };
  }

  /**
   * Lists trips in the active organization.
   */
  async listTrips(params?: {
    status?: string;
    ownerUserId?: string;
    limit?: number;
  }): Promise<MobileTripSummary[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.ownerUserId) query.set("ownerUserId", params.ownerUserId);
    query.set("limit", String(params?.limit ?? 50));

    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/trips?${query.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.error?.message ?? `Failed to load field trips (${response.status})`
      );
    }

    return (body?.data ?? []) as MobileTripSummary[];
  }

  /**
   * Loads an approved or in-progress trip along with its ordered stops and store coordinates.
   */
  async getExecutableTrip(tripId: string): Promise<MobileTrip> {
    const tripUrl = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/trips/${tripId}`;
    const storesUrl = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/stores?limit=100`;

    const [tripRes, storesRes] = await Promise.all([
      fetch(tripUrl, {
        method: "GET",
        headers: this.getAuthHeaders(),
      }),
      fetch(storesUrl, {
        method: "GET",
        headers: this.getAuthHeaders(),
      }),
    ]);

    const tripBody = await tripRes.json();
    if (!tripRes.ok || !tripBody?.data?.trip) {
      throw new Error(
        tripBody?.error?.message ?? `Failed to load trip details (${tripRes.status})`
      );
    }

    const detail = tripBody.data as RawTripDetailResponse;
    if (
      detail.trip.status !== "approved" &&
      detail.trip.status !== "in_progress" &&
      detail.trip.status !== "completed"
    ) {
      throw new Error(
        `Trip '${detail.trip.title}' is in '${detail.trip.status}' status. Only approved or in-progress trips can be executed on mobile.`
      );
    }

    const storesMap = new Map<string, RawStoreRecord>();
    if (storesRes.ok) {
      try {
        const storesBody = await storesRes.json();
        const storesList = (storesBody?.data ?? []) as RawStoreRecord[];
        for (const store of storesList) {
          storesMap.set(store.id, store);
        }
      } catch {
        // Non-blocking if store list parse fails
      }
    }

    const stops: MobileTripStop[] = [...(detail.stops ?? [])]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((stop) => {
        const store = storesMap.get(stop.storeId);
        return {
          id: stop.id,
          storeId: stop.storeId,
          storeName: store?.name ?? `Store #${stop.sequenceNumber}`,
          sequenceNumber: stop.sequenceNumber,
          latitude: store?.latitude ?? null,
          longitude: store?.longitude ?? null,
          addressLine1: store?.addressLine1 ?? "Address unavailable",
          city: store?.city ?? "",
          status: stop.status,
        };
      });

    return {
      id: detail.trip.id,
      orgId: detail.trip.orgId,
      title: detail.trip.title,
      status: detail.trip.status,
      ownerUserId: detail.trip.ownerUserId,
      startDate: detail.trip.startDate,
      endDate: detail.trip.endDate,
      purpose: detail.trip.purpose,
      stops,
    };
  }

  /**
   * Dispatches a queued geofence event (arrival or departure) to the server.
   */
  async sendGeofenceEvent(
    event: QueuedGeofenceEvent
  ): Promise<GeofenceEventSyncResponse> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/visits/geofence-event`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        eventType: event.eventType,
        tripId: event.tripId,
        tripStopId: event.tripStopId,
        storeId: event.storeId,
        clientEventId: event.clientEventId,
        deviceRecordedAt: event.deviceRecordedAt,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracyMeters: event.accuracyMeters,
        geofenceRadiusMeters: event.geofenceRadiusMeters,
        dwellTimeSeconds: event.dwellTimeSeconds,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      return {
        success: false,
        status: "rejected",
        serverReceivedAt: new Date().toISOString(),
        syncDelayMs: 0,
        message: body?.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      visitId: body?.data?.visitId,
      status: body?.data?.status ?? "processed",
      serverReceivedAt: body?.data?.serverReceivedAt ?? new Date().toISOString(),
      syncDelayMs: body?.data?.syncDelayMs ?? 0,
      message: body?.data?.message,
    };
  }

  /**
   * Manual check-in fallback if geofencing is disabled or unavailable.
   */
  async manualCheckIn(params: {
    tripStopId: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    idempotencyKey?: string;
    deviceRecordedAt?: string;
    geofenceRadiusMeters?: number;
  }): Promise<{ visitId: string }> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/visits`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        tripStopId: params.tripStopId,
        idempotencyKey: params.idempotencyKey,
        deviceRecordedAt: params.deviceRecordedAt ?? new Date().toISOString(),
        geofenceRadiusMeters: params.geofenceRadiusMeters ?? 150,
        eventSource: "manual",
        location: {
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          accuracyMeters: params.accuracyMeters ?? null,
          status:
            params.latitude !== null && params.latitude !== undefined
              ? "captured_unverified"
              : "unavailable",
        },
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message ?? `Check-in failed (${response.status})`);
    }

    return { visitId: body?.data?.visit?.id };
  }

  /**
   * Manual check-out fallback.
   */
  async manualCheckOut(params: {
    visitId: string;
    notes?: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    idempotencyKey?: string;
    deviceRecordedAt?: string;
  }): Promise<void> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/visits/${params.visitId}/checkout`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        notes: params.notes,
        idempotencyKey: params.idempotencyKey,
        deviceRecordedAt: params.deviceRecordedAt ?? new Date().toISOString(),
        eventSource: "manual",
        location: {
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          accuracyMeters: params.accuracyMeters ?? null,
          status:
            params.latitude !== null && params.latitude !== undefined
              ? "captured_unverified"
              : "unavailable",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.error?.message ?? `Check-out failed (${response.status})`);
    }
  }

  /**
   * Starts an authorized live tracking session for an approved or in_progress trip.
   */
  async startTrackingSession(params: {
    tripId: string;
    consentRecordedAt?: string;
  }): Promise<{ id: string; status: string }> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/location/sessions`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        tripId: params.tripId,
        consentRecordedAt: params.consentRecordedAt ?? new Date().toISOString(),
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.error?.message ?? `Failed to start tracking session (${response.status})`
      );
    }
    return body.data;
  }

  /**
   * Stops an active live tracking session.
   */
  async stopTrackingSession(params: {
    tripId: string;
    reason?: string;
  }): Promise<void> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/location/sessions`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(
        body?.error?.message ?? `Failed to stop tracking session (${response.status})`
      );
    }
  }

  /**
   * Sends a live GPS location update to the backend.
   */
  async sendLocationEvent(params: {
    tripId: string;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    heading?: number | null;
    recordedAt?: string;
    source?: "mobile_foreground" | "mobile_background" | "manual_refresh" | "geofence_trigger";
  }): Promise<void> {
    const url = `${this.config.baseUrl}/api/orgs/${this.config.orgId}/location/events`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        tripId: params.tripId,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracyM: params.accuracyM ?? null,
        speedMps: params.speedMps ?? null,
        heading: params.heading ?? null,
        recordedAt: params.recordedAt ?? new Date().toISOString(),
        source: params.source ?? "mobile_foreground",
      }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(
        body?.error?.message ?? `Failed to send location update (${response.status})`
      );
    }
  }
}
