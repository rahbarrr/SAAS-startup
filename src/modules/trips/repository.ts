import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
  sanitizePostgrestSearchTerm,
  throwIfBillingEntitlementError,
} from "@/lib/http/envelope";
import type { DbTripAuditEventRow, DbTripRow, DbTripStopRow } from "@/types/database";
import type {
  Trip,
  TripAuditEvent,
  TripAuditEventType,
  TripDetail,
  TripStatus,
  TripStop,
} from "./domain";
import {
  allowlistedTripAuditMetadataSchema,
  type ListTripsQuery,
  type TripStopInput,
  type UpsertTripDraftInput,
} from "./schemas";

export interface ListTripsRepositoryFilter extends ListTripsQuery {
  excludeOwnerUserId?: string;
}

export interface PaginatedTripsResult {
  items: Trip[];
  pagination: CursorPaginationMeta;
}

export interface CreateAuditEventInput {
  orgId: string;
  tripId: string;
  actorUserId: string;
  eventType: TripAuditEventType;
  oldStatus: TripStatus | null;
  newStatus: TripStatus;
  note: string | null;
  metadata?: Record<string, unknown>;
}

export interface TripsRepository {
  listTrips(
    orgId: string,
    query: ListTripsRepositoryFilter
  ): Promise<PaginatedTripsResult>;
  getTripDetail(orgId: string, tripId: string): Promise<TripDetail | null>;
  createTripDraftWithStops(params: {
    orgId: string;
    ownerUserId: string;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail>;
  updateTripDraftWithStops(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    previousStatus: TripStatus;
    previousDecidedBy: string | null;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail>;
  transitionTripStatusWithAudit(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    oldStatus: TripStatus;
    newStatus: TripStatus;
    eventType: TripAuditEventType;
    submittedAt?: string | null;
    expectedSubmittedAt?: string | null;
    decidedBy?: string | null;
    decidedAt?: string | null;
    decisionNote?: string | null;
    auditNote: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TripDetail>;
}

function mapTripRow(row: DbTripRow): Trip {
  return {
    id: row.id,
    orgId: row.organization_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    purpose: row.purpose,
    status: row.status,
    submittedAt: row.submitted_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTripStopRow(row: DbTripStopRow): TripStop {
  return {
    id: row.id,
    orgId: row.organization_id,
    tripId: row.trip_id,
    storeId: row.store_id,
    sequenceNumber: row.sequence_number,
    plannedAt: row.planned_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTripAuditRow(row: DbTripAuditEventRow): TripAuditEvent {
  return {
    id: row.id,
    orgId: row.organization_id,
    tripId: row.trip_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export class SupabaseTripsRepository implements TripsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listTrips(
    orgId: string,
    query: ListTripsRepositoryFilter
  ): Promise<PaginatedTripsResult> {
    const pageSize = query.limit;
    let builder = this.supabase
      .from("trips")
      .select(
        "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (query.status) {
      builder = builder.eq("status", query.status);
    }
    if (query.ownerUserId) {
      builder = builder.eq("owner_user_id", query.ownerUserId);
    }
    if (query.excludeOwnerUserId) {
      builder = builder.neq("owner_user_id", query.excludeOwnerUserId);
    }
    if (query.startDateFrom) {
      builder = builder.gte("start_date", query.startDateFrom);
    }
    if (query.startDateTo) {
      builder = builder.lte("start_date", query.startDateTo);
    }
    if (query.search) {
      const escaped = sanitizePostgrestSearchTerm(query.search);
      if (escaped.length > 0) {
        builder = builder.or(`title.ilike.%${escaped}%,purpose.ilike.%${escaped}%`);
      }
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      builder = builder.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
      );
    }

    const { data, error } = await builder.returns<DbTripRow[]>();
    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list trips", 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapTripRow);
    const lastItem = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: pageSize,
        nextCursor:
          hasMore && lastItem
            ? encodeCursor({ createdAt: lastItem.createdAt, id: lastItem.id })
            : null,
      },
    };
  }

  async getTripDetail(orgId: string, tripId: string): Promise<TripDetail | null> {
    const { data: tripData, error: tripError } = await this.supabase
      .from("trips")
      .select(
        "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("id", tripId)
      .maybeSingle<DbTripRow>();

    if (tripError) {
      throw new AppError("INTERNAL_ERROR", "Failed to load trip", 500);
    }
    if (!tripData) {
      return null;
    }

    const [
      { data: stopsData, error: stopsError },
      { data: auditData, error: auditError },
    ] = await Promise.all([
      this.supabase
        .from("trip_stops")
        .select(
          "id, organization_id, trip_id, store_id, sequence_number, planned_at, status, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .eq("trip_id", tripId)
        .order("sequence_number", { ascending: true })
        .returns<DbTripStopRow[]>(),
      this.supabase
        .from("trip_audit_events")
        .select(
          "id, organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at"
        )
        .eq("organization_id", orgId)
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true })
        .returns<DbTripAuditEventRow[]>(),
    ]);

    if (stopsError || auditError) {
      throw new AppError("INTERNAL_ERROR", "Failed to load trip details", 500);
    }

    return {
      trip: mapTripRow(tripData),
      stops: (stopsData ?? []).map(mapTripStopRow),
      auditEvents: (auditData ?? []).map(mapTripAuditRow),
    };
  }

  private async replaceTripStops(
    orgId: string,
    tripId: string,
    stops: readonly TripStopInput[]
  ): Promise<TripStop[]> {
    const { error: deleteError } = await this.supabase
      .from("trip_stops")
      .delete()
      .eq("organization_id", orgId)
      .eq("trip_id", tripId);

    if (deleteError) {
      throw new AppError("INTERNAL_ERROR", "Failed to update trip stops", 500);
    }

    if (stops.length === 0) {
      return [];
    }

    const rowsToInsert = stops.map((stop) => ({
      organization_id: orgId,
      trip_id: tripId,
      store_id: stop.storeId,
      sequence_number: stop.sequenceNumber,
      planned_at: stop.plannedAt ?? null,
      status: "planned" as const,
    }));

    const { data, error } = await this.supabase
      .from("trip_stops")
      .insert(rowsToInsert)
      .select(
        "id, organization_id, trip_id, store_id, sequence_number, planned_at, status, created_at, updated_at"
      )
      .order("sequence_number", { ascending: true })
      .returns<DbTripStopRow[]>();

    if (error) {
      throwIfBillingEntitlementError(error);
      throw new AppError("INTERNAL_ERROR", "Failed to save trip stops", 500);
    }

    return (data ?? []).map(mapTripStopRow);
  }

  private async insertAuditEvent(input: CreateAuditEventInput): Promise<TripAuditEvent> {
    const validatedMetadata = allowlistedTripAuditMetadataSchema.parse(
      input.metadata ?? {}
    );

    const { data, error } = await this.supabase
      .from("trip_audit_events")
      .insert({
        organization_id: input.orgId,
        trip_id: input.tripId,
        actor_user_id: input.actorUserId,
        event_type: input.eventType,
        old_status: input.oldStatus,
        new_status: input.newStatus,
        note: input.note,
        metadata: validatedMetadata,
      })
      .select(
        "id, organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at"
      )
      .single<DbTripAuditEventRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to record trip audit event", 500);
    }

    return mapTripAuditRow(data);
  }

  async createTripDraftWithStops(params: {
    orgId: string;
    ownerUserId: string;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail> {
    const { data: tripRow, error: tripError } = await this.supabase
      .from("trips")
      .insert({
        organization_id: params.orgId,
        owner_user_id: params.ownerUserId,
        title: params.input.title,
        purpose: params.input.purpose,
        start_date: params.input.startDate,
        end_date: params.input.endDate,
        status: "draft",
      })
      .select(
        "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
      )
      .single<DbTripRow>();

    if (tripError) {
      throwIfBillingEntitlementError(tripError);
      throw new AppError("INTERNAL_ERROR", "Failed to create trip draft", 500);
    }

    const stops = await this.replaceTripStops(
      params.orgId,
      tripRow.id,
      params.input.stops
    );
    const auditEvent = await this.insertAuditEvent({
      orgId: params.orgId,
      tripId: tripRow.id,
      actorUserId: params.ownerUserId,
      eventType: "trip_created",
      oldStatus: null,
      newStatus: "draft",
      note: "Created trip draft",
      metadata: { stop_count: stops.length },
    });

    return {
      trip: mapTripRow(tripRow),
      stops,
      auditEvents: [auditEvent],
    };
  }

  async updateTripDraftWithStops(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    previousStatus: TripStatus;
    previousDecidedBy: string | null;
    input: UpsertTripDraftInput;
  }): Promise<TripDetail> {
    const nextStatus: TripStatus =
      params.previousStatus === "approved" ? "draft" : params.previousStatus;

    const patch: Record<string, unknown> = {
      title: params.input.title,
      purpose: params.input.purpose,
      start_date: params.input.startDate,
      end_date: params.input.endDate,
      status: nextStatus,
    };

    if (params.previousStatus === "approved") {
      patch.submitted_at = null;
      patch.decided_by = null;
      patch.decided_at = null;
      patch.decision_note = null;
    }

    const { data: _tripRow, error: tripError } = await this.supabase
      .from("trips")
      .update(patch)
      .eq("organization_id", params.orgId)
      .eq("id", params.tripId)
      .select(
        "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
      )
      .single<DbTripRow>();

    if (tripError) {
      throwIfBillingEntitlementError(tripError);
      throw new AppError("INTERNAL_ERROR", "Failed to update trip", 500);
    }

    await this.replaceTripStops(params.orgId, params.tripId, params.input.stops);

    if (params.previousStatus === "approved") {
      await this.insertAuditEvent({
        orgId: params.orgId,
        tripId: params.tripId,
        actorUserId: params.actorUserId,
        eventType: "trip_reopened_for_edit",
        oldStatus: "approved",
        newStatus: "draft",
        note: "Approved trip edited by owner; reset to draft for re-approval",
        metadata: {
          stop_count: params.input.stops.length,
          ...(params.previousDecidedBy
            ? { previous_decided_by: params.previousDecidedBy }
            : {}),
        },
      });
    } else {
      await this.insertAuditEvent({
        orgId: params.orgId,
        tripId: params.tripId,
        actorUserId: params.actorUserId,
        eventType: "trip_updated",
        oldStatus: params.previousStatus,
        newStatus: nextStatus,
        note: "Updated trip plan details and stops",
        metadata: {
          stop_count: params.input.stops.length,
        },
      });
    }

    const detail = await this.getTripDetail(params.orgId, params.tripId);
    if (!detail) {
      throw new AppError("NOT_FOUND", "Trip not found after update", 404);
    }
    return detail;
  }

  async transitionTripStatusWithAudit(params: {
    orgId: string;
    tripId: string;
    actorUserId: string;
    oldStatus: TripStatus;
    newStatus: TripStatus;
    eventType: TripAuditEventType;
    submittedAt?: string | null;
    expectedSubmittedAt?: string | null;
    decidedBy?: string | null;
    decidedAt?: string | null;
    decisionNote?: string | null;
    auditNote: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TripDetail> {
    const validatedMetadata = allowlistedTripAuditMetadataSchema.parse(
      params.metadata ?? {}
    );

    const isManagerDecision =
      params.newStatus === "approved" ||
      params.newStatus === "changes_requested" ||
      params.newStatus === "rejected";

    if (isManagerDecision && typeof this.supabase.rpc === "function") {
      const { error: rpcError } = await this.supabase.rpc("decide_submitted_trip", {
        p_org_id: params.orgId,
        p_trip_id: params.tripId,
        p_decision: params.newStatus,
        p_note: params.decisionNote ?? params.auditNote,
        p_metadata: validatedMetadata,
      });

      if (rpcError) {
        throwIfBillingEntitlementError(rpcError);
        if (rpcError.code === "42501") {
          throw new AppError(
            "FORBIDDEN_INSUFFICIENT_ROLE",
            "You are not permitted to decide this trip",
            403
          );
        }
        if (rpcError.code === "P0002") {
          throw new AppError(
            "NOT_FOUND",
            "The requested trip was not found in your active organization",
            404
          );
        }
        throw new AppError(
          "CONFLICT",
          "Trip status has already changed or was decided by another reviewer.",
          409
        );
      }

      const detail = await this.getTripDetail(params.orgId, params.tripId);
      if (!detail) {
        throw new AppError("NOT_FOUND", "Trip not found after decision", 404);
      }
      return detail;
    }

    const patch: Record<string, unknown> = {
      status: params.newStatus,
    };
    if (params.submittedAt !== undefined) patch.submitted_at = params.submittedAt;
    if (params.decidedBy !== undefined) patch.decided_by = params.decidedBy;
    if (params.decidedAt !== undefined) patch.decided_at = params.decidedAt;
    if (params.decisionNote !== undefined) patch.decision_note = params.decisionNote;

    let updateBuilder = this.supabase
      .from("trips")
      .update(patch)
      .eq("organization_id", params.orgId)
      .eq("id", params.tripId)
      .eq("status", params.oldStatus);

    if (params.expectedSubmittedAt) {
      updateBuilder = updateBuilder.eq("submitted_at", params.expectedSubmittedAt);
    }
    if (params.decidedBy) {
      updateBuilder = updateBuilder.neq("owner_user_id", params.decidedBy);
    }

    const { data: updatedRow, error: updateError } = await updateBuilder
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateError || !updatedRow) {
      throwIfBillingEntitlementError(updateError);
      throw new AppError(
        "CONFLICT",
        "Trip status could not be updated because it was already modified by another request.",
        409
      );
    }

    await this.insertAuditEvent({
      orgId: params.orgId,
      tripId: params.tripId,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      note: params.auditNote,
      metadata: validatedMetadata,
    });

    const detail = await this.getTripDetail(params.orgId, params.tripId);
    if (!detail) {
      throw new AppError("NOT_FOUND", "Trip not found after transition", 404);
    }
    return detail;
  }
}
