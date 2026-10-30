import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type {
  DbGeofenceEventRow,
  DbLatestEmployeeLocationRow,
  DbLocationEventRow,
  DbStoreGeofenceRow,
  DbTripLocationBreadcrumbRow,
  DbTripTrackingSessionRow,
} from "@/types/database";
import type {
  GeofenceEventRecord,
  LatestEmployeeLocation,
  LocationEvent,
  LocationTrackingSession,
  RecordBreadcrumbInput,
  StoreGeofence,
  TripLocationBreadcrumb,
} from "./domain";

export interface LocationRepository {
  recordBreadcrumb(
    userId: string,
    input: RecordBreadcrumbInput
  ): Promise<TripLocationBreadcrumb>;
  listBreadcrumbsForTrip(
    orgId: string,
    tripId: string,
    limit?: number
  ): Promise<TripLocationBreadcrumb[]>;
  purgeExpiredBreadcrumbs(orgId: string, retentionDays: number): Promise<number>;

  // Session & Live Tracking
  startTrackingSession(params: {
    orgId: string;
    tripId: string;
    employeeId: string;
    consentRecordedAt?: string;
  }): Promise<LocationTrackingSession>;
  getActiveTrackingSession(
    orgId: string,
    tripId: string,
    employeeId: string
  ): Promise<LocationTrackingSession | null>;
  stopTrackingSession(
    orgId: string,
    sessionId: string,
    endedAt?: string
  ): Promise<LocationTrackingSession>;

  // Location Events & Latest
  recordLocationEvent(params: {
    orgId: string;
    tripId: string;
    employeeId: string;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    heading?: number | null;
    recordedAt: string;
    source?:
      "mobile_foreground" | "mobile_background" | "manual_refresh" | "geofence_trigger";
  }): Promise<LocationEvent>;
  listLatestEmployeeLocations(orgId: string): Promise<LatestEmployeeLocation[]>;
  getLatestEmployeeLocation(
    orgId: string,
    employeeId: string
  ): Promise<LatestEmployeeLocation | null>;
  listLocationEventsForTrip(
    orgId: string,
    tripId: string,
    limit?: number
  ): Promise<LocationEvent[]>;

  // Geofences
  upsertStoreGeofence(params: {
    orgId: string;
    storeId: string;
    latitude: number;
    longitude: number;
    radiusM: number;
    enabled?: boolean;
  }): Promise<StoreGeofence>;
  getStoreGeofence(orgId: string, storeId: string): Promise<StoreGeofence | null>;
  listStoreGeofencesForOrg(orgId: string): Promise<StoreGeofence[]>;

  // Geofence Events
  recordGeofenceEvent(params: {
    orgId: string;
    tripId: string;
    visitId?: string | null;
    storeId: string;
    employeeId: string;
    eventType: "enter" | "exit";
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    recordedAt?: string;
  }): Promise<GeofenceEventRecord>;
  listGeofenceEventsForTrip(
    orgId: string,
    tripId: string,
    limit?: number
  ): Promise<GeofenceEventRecord[]>;
}

export function mapBreadcrumbRow(
  row: DbTripLocationBreadcrumbRow
): TripLocationBreadcrumb {
  return {
    id: row.id,
    orgId: row.organization_id,
    tripId: row.trip_id,
    userId: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export function mapTrackingSessionRow(
  row: DbTripTrackingSessionRow
): LocationTrackingSession {
  return {
    id: row.id,
    orgId: row.org_id,
    tripId: row.trip_id,
    employeeId: row.employee_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    consentRecordedAt: row.consent_recorded_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapLocationEventRow(row: DbLocationEventRow): LocationEvent {
  return {
    id: row.id,
    orgId: row.org_id,
    tripId: row.trip_id,
    employeeId: row.employee_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    speedMps: row.speed_mps,
    heading: row.heading,
    recordedAt: row.recorded_at,
    receivedAt: row.received_at,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function mapLatestLocationRow(
  row: DbLatestEmployeeLocationRow & {
    profiles?: { full_name: string | null; email: string } | null;
    trips?: { title: string } | null;
  }
): LatestEmployeeLocation {
  return {
    employeeId: row.employee_id,
    orgId: row.org_id,
    tripId: row.trip_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    recordedAt: row.recorded_at,
    receivedAt: row.received_at,
    trackingStatus: row.tracking_status,
    employeeName: row.profiles?.full_name ?? undefined,
    employeeEmail: row.profiles?.email ?? undefined,
    tripTitle: row.trips?.title ?? undefined,
  };
}

export function mapStoreGeofenceRow(row: DbStoreGeofenceRow): StoreGeofence {
  return {
    id: row.id,
    orgId: row.org_id,
    storeId: row.store_id,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusM: row.radius_m,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGeofenceEventRecordRow(row: DbGeofenceEventRow): GeofenceEventRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    tripId: row.trip_id,
    visitId: row.visit_id,
    storeId: row.store_id,
    employeeId: row.employee_id,
    eventType: row.event_type,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export class SupabaseLocationRepository implements LocationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async recordBreadcrumb(
    userId: string,
    input: RecordBreadcrumbInput
  ): Promise<TripLocationBreadcrumb> {
    const { data, error } = await this.supabase
      .from("trip_location_breadcrumbs")
      .insert({
        organization_id: input.orgId,
        trip_id: input.tripId,
        user_id: userId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_meters: input.accuracyMeters ?? null,
        recorded_at: input.recordedAt ?? new Date().toISOString(),
      })
      .select("*")
      .single<DbTripLocationBreadcrumbRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to record location breadcrumb: ${error?.message ?? "unknown error"}`,
        500
      );
    }

    return mapBreadcrumbRow(data);
  }

  async listBreadcrumbsForTrip(
    orgId: string,
    tripId: string,
    limit: number = 100
  ): Promise<TripLocationBreadcrumb[]> {
    const { data, error } = await this.supabase
      .from("trip_location_breadcrumbs")
      .select("*")
      .eq("organization_id", orgId)
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 500))
      .returns<DbTripLocationBreadcrumbRow[]>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load trip location breadcrumbs",
        500
      );
    }

    return (data ?? []).map(mapBreadcrumbRow);
  }

  async purgeExpiredBreadcrumbs(
    orgId: string,
    retentionDays: number = 30
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      "purge_expired_location_breadcrumbs",
      {
        p_org_id: orgId,
        p_retention_days: retentionDays,
      }
    );

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to purge expired location records: ${error.message}`,
        500
      );
    }

    return Number(data ?? 0);
  }

  // --------------------------------------------------------------------------
  // Sessions
  // --------------------------------------------------------------------------
  async startTrackingSession(params: {
    orgId: string;
    tripId: string;
    employeeId: string;
    consentRecordedAt?: string;
  }): Promise<LocationTrackingSession> {
    const { data, error } = await this.supabase
      .from("trip_tracking_sessions")
      .insert({
        org_id: params.orgId,
        trip_id: params.tripId,
        employee_id: params.employeeId,
        consent_recorded_at: params.consentRecordedAt ?? new Date().toISOString(),
        status: "active",
      })
      .select("*")
      .single<DbTripTrackingSessionRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to start trip tracking session: ${error?.message ?? "unknown error"}`,
        500
      );
    }
    return mapTrackingSessionRow(data);
  }

  async getActiveTrackingSession(
    orgId: string,
    tripId: string,
    employeeId: string
  ): Promise<LocationTrackingSession | null> {
    const { data, error } = await this.supabase
      .from("trip_tracking_sessions")
      .select("*")
      .eq("org_id", orgId)
      .eq("trip_id", tripId)
      .eq("employee_id", employeeId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .maybeSingle<DbTripTrackingSessionRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to query active tracking session: ${error.message}`,
        500
      );
    }
    return data ? mapTrackingSessionRow(data) : null;
  }

  async stopTrackingSession(
    orgId: string,
    sessionId: string,
    endedAt: string = new Date().toISOString()
  ): Promise<LocationTrackingSession> {
    const { data, error } = await this.supabase
      .from("trip_tracking_sessions")
      .update({
        status: "stopped",
        ended_at: endedAt,
      })
      .eq("org_id", orgId)
      .eq("id", sessionId)
      .select("*")
      .single<DbTripTrackingSessionRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to stop trip tracking session: ${error?.message ?? "unknown error"}`,
        500
      );
    }
    return mapTrackingSessionRow(data);
  }

  // --------------------------------------------------------------------------
  // Location Events
  // --------------------------------------------------------------------------
  async recordLocationEvent(params: {
    orgId: string;
    tripId: string;
    employeeId: string;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    heading?: number | null;
    recordedAt: string;
    source?:
      "mobile_foreground" | "mobile_background" | "manual_refresh" | "geofence_trigger";
  }): Promise<LocationEvent> {
    const { data, error } = await this.supabase
      .from("location_events")
      .insert({
        org_id: params.orgId,
        trip_id: params.tripId,
        employee_id: params.employeeId,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy_m: params.accuracyM ?? null,
        speed_mps: params.speedMps ?? null,
        heading: params.heading ?? null,
        recorded_at: params.recordedAt,
        source: params.source ?? "mobile_foreground",
      })
      .select("*")
      .single<DbLocationEventRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to record location event: ${error?.message ?? "unknown error"}`,
        500
      );
    }
    return mapLocationEventRow(data);
  }

  async listLatestEmployeeLocations(orgId: string): Promise<LatestEmployeeLocation[]> {
    const { data, error } = await this.supabase
      .from("latest_employee_locations")
      .select(
        `
        *,
        profiles:employee_id(full_name, email),
        trips:trip_id(title)
      `
      )
      .eq("org_id", orgId)
      .order("recorded_at", { ascending: false });

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to list latest employee locations: ${error.message}`,
        500
      );
    }
    return (data ?? []).map(mapLatestLocationRow);
  }

  async getLatestEmployeeLocation(
    orgId: string,
    employeeId: string
  ): Promise<LatestEmployeeLocation | null> {
    const { data, error } = await this.supabase
      .from("latest_employee_locations")
      .select(
        `
        *,
        profiles:employee_id(full_name, email),
        trips:trip_id(title)
      `
      )
      .eq("org_id", orgId)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to query latest employee location: ${error.message}`,
        500
      );
    }
    return data ? mapLatestLocationRow(data) : null;
  }

  async listLocationEventsForTrip(
    orgId: string,
    tripId: string,
    limit: number = 200
  ): Promise<LocationEvent[]> {
    const { data, error } = await this.supabase
      .from("location_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 1000))
      .returns<DbLocationEventRow[]>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to list location events: ${error.message}`,
        500
      );
    }
    return (data ?? []).map(mapLocationEventRow);
  }

  // --------------------------------------------------------------------------
  // Geofences
  // --------------------------------------------------------------------------
  async upsertStoreGeofence(params: {
    orgId: string;
    storeId: string;
    latitude: number;
    longitude: number;
    radiusM: number;
    enabled?: boolean;
  }): Promise<StoreGeofence> {
    const { data, error } = await this.supabase
      .from("store_geofences")
      .upsert(
        {
          org_id: params.orgId,
          store_id: params.storeId,
          latitude: params.latitude,
          longitude: params.longitude,
          radius_m: params.radiusM,
          enabled: params.enabled ?? true,
        },
        { onConflict: "org_id,store_id" }
      )
      .select("*")
      .single<DbStoreGeofenceRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to upsert store geofence: ${error?.message ?? "unknown error"}`,
        500
      );
    }
    return mapStoreGeofenceRow(data);
  }

  async getStoreGeofence(orgId: string, storeId: string): Promise<StoreGeofence | null> {
    const { data, error } = await this.supabase
      .from("store_geofences")
      .select("*")
      .eq("org_id", orgId)
      .eq("store_id", storeId)
      .maybeSingle<DbStoreGeofenceRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to fetch store geofence: ${error.message}`,
        500
      );
    }
    return data ? mapStoreGeofenceRow(data) : null;
  }

  async listStoreGeofencesForOrg(orgId: string): Promise<StoreGeofence[]> {
    const { data, error } = await this.supabase
      .from("store_geofences")
      .select("*")
      .eq("org_id", orgId)
      .returns<DbStoreGeofenceRow[]>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to list store geofences: ${error.message}`,
        500
      );
    }
    return (data ?? []).map(mapStoreGeofenceRow);
  }

  // --------------------------------------------------------------------------
  // Geofence Events
  // --------------------------------------------------------------------------
  async recordGeofenceEvent(params: {
    orgId: string;
    tripId: string;
    visitId?: string | null;
    storeId: string;
    employeeId: string;
    eventType: "enter" | "exit";
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    recordedAt?: string;
  }): Promise<GeofenceEventRecord> {
    const { data, error } = await this.supabase
      .from("geofence_events")
      .insert({
        org_id: params.orgId,
        trip_id: params.tripId,
        visit_id: params.visitId ?? null,
        store_id: params.storeId,
        employee_id: params.employeeId,
        event_type: params.eventType,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy_m: params.accuracyM ?? null,
        recorded_at: params.recordedAt ?? new Date().toISOString(),
      })
      .select("*")
      .single<DbGeofenceEventRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to record geofence event: ${error?.message ?? "unknown error"}`,
        500
      );
    }
    return mapGeofenceEventRecordRow(data);
  }

  async listGeofenceEventsForTrip(
    orgId: string,
    tripId: string,
    limit: number = 100
  ): Promise<GeofenceEventRecord[]> {
    const { data, error } = await this.supabase
      .from("geofence_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 500))
      .returns<DbGeofenceEventRow[]>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to list geofence events: ${error.message}`,
        500
      );
    }
    return (data ?? []).map(mapGeofenceEventRecordRow);
  }
}
