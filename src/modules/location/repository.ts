import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type { DbTripLocationBreadcrumbRow } from "@/types/database";
import type { RecordBreadcrumbInput, TripLocationBreadcrumb } from "./domain";

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
}
