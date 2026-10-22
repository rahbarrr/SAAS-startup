import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
} from "@/lib/http/envelope";
import type { Trip, TripStop } from "@/modules/trips/domain";
import type {
  DbTripRow,
  DbTripStopRow,
  DbVisitChecklistItemRow,
  DbVisitEvidenceRow,
  DbVisitRow,
} from "@/types/database";
import {
  type AllowedEvidenceMimeType,
  buildUnverifiedDeviceLocation,
  EVIDENCE_STORAGE_BUCKET,
  generateSafeEvidenceObjectPath,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  type SignedEvidenceDownloadUrl,
  type SignedEvidenceUploadTicket,
  type UnverifiedDeviceLocation,
  type Visit,
  type VisitChecklistItem,
  type VisitDetail,
  type VisitEvidence,
} from "./domain";
import type { ChecklistAnswerItemInput, ListVisitsQuery } from "./schemas";

export interface PaginatedVisitsResult {
  items: Visit[];
  pagination: CursorPaginationMeta;
}

export interface TripStopExecutionContext {
  stop: TripStop;
  trip: Trip;
}

export interface VisitsRepository {
  listVisits(orgId: string, query: ListVisitsQuery): Promise<PaginatedVisitsResult>;
  getVisitDetail(orgId: string, visitId: string): Promise<VisitDetail | null>;
  getVisitByTripStopId(orgId: string, tripStopId: string): Promise<Visit | null>;
  getActiveVisitForEmployee(orgId: string, employeeUserId: string): Promise<Visit | null>;
  getTripStopExecutionContext(
    orgId: string,
    tripStopId: string
  ): Promise<TripStopExecutionContext | null>;
  checkInStopAtomic(params: {
    orgId: string;
    tripStopId: string;
    employeeUserId: string;
    checkedInAt: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail>;
  updateVisitExecution(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    notes?: string;
    checklistItems: readonly ChecklistAnswerItemInput[];
    nowIso: string;
  }): Promise<VisitDetail>;
  createSignedEvidenceUploadTicket(params: {
    orgId: string;
    visitId: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
  }): Promise<SignedEvidenceUploadTicket>;
  verifyStorageObjectUploaded(params: {
    orgId: string;
    visitId: string;
    storagePath: string;
  }): Promise<boolean>;
  recordConfirmedEvidence(params: {
    orgId: string;
    visitId: string;
    uploadedBy: string;
    storagePath: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
    caption: string;
    idempotencyKey: string | null;
  }): Promise<VisitEvidence>;
  createSignedEvidenceDownloadUrl(params: {
    orgId: string;
    visitId: string;
    evidenceId: string;
    expiresInSeconds?: number;
  }): Promise<SignedEvidenceDownloadUrl>;
  checkOutVisitAtomic(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    checkedOutAt: string;
    notes?: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail>;
}

function mapVisitRow(row: DbVisitRow): Visit {
  return {
    id: row.id,
    orgId: row.organization_id,
    tripStopId: row.trip_stop_id,
    employeeUserId: row.employee_user_id,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    checkInLocation: buildUnverifiedDeviceLocation({
      lat: row.check_in_lat,
      lng: row.check_in_lng,
      accuracyMeters: row.check_in_accuracy_m ?? null,
      status: row.check_in_location_status ?? "unavailable",
    }),
    checkOutLocation: buildUnverifiedDeviceLocation({
      lat: row.check_out_lat,
      lng: row.check_out_lng,
      accuracyMeters: row.check_out_accuracy_m ?? null,
      status: row.check_out_location_status ?? "unavailable",
    }),
    checkInIdempotencyKey: row.check_in_idempotency_key ?? null,
    checkOutIdempotencyKey: row.check_out_idempotency_key ?? null,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChecklistRow(row: DbVisitChecklistItemRow): VisitChecklistItem {
  return {
    id: row.id,
    orgId: row.organization_id,
    visitId: row.visit_id,
    questionKey: row.question_key,
    label: row.label,
    answerType: row.answer_type,
    answerValue: row.answer_value,
    answerText: row.answer_text,
    flagged: row.flagged,
    required: row.required,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvidenceRow(row: DbVisitEvidenceRow): VisitEvidence {
  return {
    id: row.id,
    orgId: row.organization_id,
    visitId: row.visit_id,
    storagePath: row.storage_path,
    fileType: row.file_type as AllowedEvidenceMimeType,
    fileSize: row.file_size,
    caption: row.caption,
    uploadedBy: row.uploaded_by,
    idempotencyKey: row.idempotency_key ?? null,
    createdAt: row.created_at,
  };
}

const VISIT_SELECT_COLUMNS =
  "id, organization_id, trip_stop_id, employee_user_id, checked_in_at, checked_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_location_status, check_out_lat, check_out_lng, check_out_accuracy_m, check_out_location_status, check_in_idempotency_key, check_out_idempotency_key, notes, status, created_at, updated_at";

export class SupabaseVisitsRepository implements VisitsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listVisits(
    orgId: string,
    query: ListVisitsQuery
  ): Promise<PaginatedVisitsResult> {
    const pageSize = query.limit;
    let builder = this.supabase
      .from("visits")
      .select(VISIT_SELECT_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (query.status) {
      builder = builder.eq("status", query.status);
    }
    if (query.tripStopId) {
      builder = builder.eq("trip_stop_id", query.tripStopId);
    }
    if (query.employeeUserId) {
      builder = builder.eq("employee_user_id", query.employeeUserId);
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      builder = builder.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
      );
    }

    const { data, error } = await builder.returns<DbVisitRow[]>();
    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list visits", 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapVisitRow);
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

  async getVisitDetail(orgId: string, visitId: string): Promise<VisitDetail | null> {
    const { data: visitRow, error: visitError } = await this.supabase
      .from("visits")
      .select(VISIT_SELECT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("id", visitId)
      .maybeSingle<DbVisitRow>();

    if (visitError) {
      throw new AppError("INTERNAL_ERROR", "Failed to load visit", 500);
    }
    if (!visitRow) {
      return null;
    }

    const [
      { data: checklistData, error: checklistError },
      { data: evidenceData, error: evidenceError },
    ] = await Promise.all([
      this.supabase
        .from("visit_checklist_items")
        .select(
          "id, organization_id, visit_id, question_key, label, answer_type, answer_value, answer_text, flagged, required, completed_at, completed_by, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: true })
        .returns<DbVisitChecklistItemRow[]>(),
      this.supabase
        .from("visit_evidence")
        .select(
          "id, organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key, created_at"
        )
        .eq("organization_id", orgId)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .returns<DbVisitEvidenceRow[]>(),
    ]);

    if (checklistError || evidenceError) {
      throw new AppError("INTERNAL_ERROR", "Failed to load visit details", 500);
    }

    return {
      visit: mapVisitRow(visitRow),
      checklistItems: (checklistData ?? []).map(mapChecklistRow),
      evidence: (evidenceData ?? []).map(mapEvidenceRow),
    };
  }

  async getVisitByTripStopId(orgId: string, tripStopId: string): Promise<Visit | null> {
    const { data, error } = await this.supabase
      .from("visits")
      .select(VISIT_SELECT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("trip_stop_id", tripStopId)
      .maybeSingle<DbVisitRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to look up visit for stop", 500);
    }
    return data ? mapVisitRow(data) : null;
  }

  async getActiveVisitForEmployee(
    orgId: string,
    employeeUserId: string
  ): Promise<Visit | null> {
    const { data, error } = await this.supabase
      .from("visits")
      .select(VISIT_SELECT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("employee_user_id", employeeUserId)
      .eq("status", "in_progress")
      .maybeSingle<DbVisitRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to check active visit", 500);
    }
    return data ? mapVisitRow(data) : null;
  }

  async getTripStopExecutionContext(
    orgId: string,
    tripStopId: string
  ): Promise<TripStopExecutionContext | null> {
    const { data: stopRow, error: stopError } = await this.supabase
      .from("trip_stops")
      .select(
        "id, organization_id, trip_id, store_id, sequence_number, planned_at, status, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("id", tripStopId)
      .maybeSingle<DbTripStopRow>();

    if (stopError) {
      throw new AppError("INTERNAL_ERROR", "Failed to load trip stop", 500);
    }
    if (!stopRow) {
      return null;
    }

    const { data: tripRow, error: tripError } = await this.supabase
      .from("trips")
      .select(
        "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("id", stopRow.trip_id)
      .maybeSingle<DbTripRow>();

    if (tripError || !tripRow) {
      return null;
    }

    return {
      stop: {
        id: stopRow.id,
        orgId: stopRow.organization_id,
        tripId: stopRow.trip_id,
        storeId: stopRow.store_id,
        sequenceNumber: stopRow.sequence_number,
        plannedAt: stopRow.planned_at,
        status: stopRow.status,
        createdAt: stopRow.created_at,
        updatedAt: stopRow.updated_at,
      },
      trip: {
        id: tripRow.id,
        orgId: tripRow.organization_id,
        ownerUserId: tripRow.owner_user_id,
        title: tripRow.title,
        startDate: tripRow.start_date,
        endDate: tripRow.end_date,
        purpose: tripRow.purpose,
        status: tripRow.status,
        submittedAt: tripRow.submitted_at,
        decidedBy: tripRow.decided_by,
        decidedAt: tripRow.decided_at,
        decisionNote: tripRow.decision_note,
        createdAt: tripRow.created_at,
        updatedAt: tripRow.updated_at,
      },
    };
  }

  async checkInStopAtomic(params: {
    orgId: string;
    tripStopId: string;
    employeeUserId: string;
    checkedInAt: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail> {
    const { data: visitRow, error: rpcError } = await this.supabase
      .rpc("check_in_trip_stop", {
        p_org_id: params.orgId,
        p_trip_stop_id: params.tripStopId,
        p_idempotency_key: params.idempotencyKey,
        p_lat: params.location.latitude,
        p_lng: params.location.longitude,
        p_accuracy_m: params.location.accuracyMeters,
        p_location_status: params.location.status,
      })
      .single<DbVisitRow>();

    if (rpcError || !visitRow) {
      if (rpcError?.code === "42501") {
        throw new AppError(
          "FORBIDDEN_INSUFFICIENT_ROLE",
          "You are not authorized to check in to this trip stop",
          403
        );
      }
      if (rpcError?.code === "P0002") {
        throw new AppError(
          "NOT_FOUND",
          "The requested trip stop was not found in your active organization",
          404
        );
      }
      throw new AppError(
        "CONFLICT",
        "Check-in conflict: a visit is already active or this stop cannot be checked into.",
        409
      );
    }

    const detail = await this.getVisitDetail(params.orgId, visitRow.id);
    if (!detail) {
      throw new AppError("NOT_FOUND", "Visit not found after check-in", 404);
    }
    return detail;
  }

  async updateVisitExecution(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    notes?: string;
    checklistItems: readonly ChecklistAnswerItemInput[];
    nowIso: string;
  }): Promise<VisitDetail> {
    if (params.notes !== undefined) {
      const { data: updatedVisit, error: visitUpdateError } = await this.supabase
        .from("visits")
        .update({ notes: params.notes })
        .eq("organization_id", params.orgId)
        .eq("id", params.visitId)
        .eq("employee_user_id", params.employeeUserId)
        .eq("status", "in_progress")
        .select("id")
        .maybeSingle<{ id: string }>();

      if (visitUpdateError || !updatedVisit) {
        throw new AppError(
          "CONFLICT",
          "Visit notes could not be updated because the visit is no longer in progress.",
          409
        );
      }
    }

    for (const item of params.checklistItems) {
      const { error: itemError } = await this.supabase
        .from("visit_checklist_items")
        .upsert(
          {
            organization_id: params.orgId,
            visit_id: params.visitId,
            question_key: item.questionKey,
            label: item.label ?? item.questionKey,
            answer_type: item.answerType ?? "boolean",
            answer_value: item.answerValue,
            answer_text: item.answerText ?? null,
            flagged: item.flagged ?? false,
            required: item.required ?? true,
            completed_at: item.completed ? params.nowIso : null,
            completed_by: item.completed ? params.employeeUserId : null,
          },
          { onConflict: "visit_id,question_key" }
        );

      if (itemError) {
        throw new AppError("CONFLICT", "Failed to update checklist item for visit", 409);
      }
    }

    const detail = await this.getVisitDetail(params.orgId, params.visitId);
    if (!detail) {
      throw new AppError("NOT_FOUND", "Visit not found after update", 404);
    }
    return detail;
  }

  async createSignedEvidenceUploadTicket(params: {
    orgId: string;
    visitId: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
  }): Promise<SignedEvidenceUploadTicket> {
    const storagePath = generateSafeEvidenceObjectPath({
      orgId: params.orgId,
      visitId: params.visitId,
      mimeType: params.fileType,
    });

    const { data, error } = await this.supabase.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to generate signed evidence upload URL",
        500
      );
    }

    return {
      bucket: EVIDENCE_STORAGE_BUCKET,
      storagePath,
      signedUploadUrl: data.signedUrl,
      token: data.token,
      expiresInSeconds: 300,
      maxBytes: MAX_EVIDENCE_FILE_SIZE_BYTES,
      allowedMimeType: params.fileType,
    };
  }

  async verifyStorageObjectUploaded(params: {
    orgId: string;
    visitId: string;
    storagePath: string;
  }): Promise<boolean> {
    const folder = `${params.orgId}/${params.visitId}`;
    const objectFileName = params.storagePath.slice(folder.length + 1);
    if (!objectFileName) return false;

    const { data, error } = await this.supabase.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .list(folder, {
        search: objectFileName,
        limit: 10,
      });

    if (error || !data) {
      return false;
    }

    return data.some((entry) => entry.name === objectFileName);
  }

  async recordConfirmedEvidence(params: {
    orgId: string;
    visitId: string;
    uploadedBy: string;
    storagePath: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
    caption: string;
    idempotencyKey: string | null;
  }): Promise<VisitEvidence> {
    if (params.idempotencyKey) {
      const { data: existingByIdem } = await this.supabase
        .from("visit_evidence")
        .select(
          "id, organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key, created_at"
        )
        .eq("organization_id", params.orgId)
        .eq("visit_id", params.visitId)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle<DbVisitEvidenceRow>();

      if (existingByIdem) {
        return mapEvidenceRow(existingByIdem);
      }
    }

    const { data, error } = await this.supabase
      .from("visit_evidence")
      .insert({
        organization_id: params.orgId,
        visit_id: params.visitId,
        storage_path: params.storagePath,
        file_type: params.fileType,
        file_size: params.fileSize,
        caption: params.caption,
        uploaded_by: params.uploadedBy,
        idempotency_key: params.idempotencyKey,
      })
      .select(
        "id, organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key, created_at"
      )
      .single<DbVisitEvidenceRow>();

    if (error || !data) {
      throw new AppError("CONFLICT", "Failed to record uploaded visit evidence", 409);
    }

    return mapEvidenceRow(data);
  }

  async createSignedEvidenceDownloadUrl(params: {
    orgId: string;
    visitId: string;
    evidenceId: string;
    expiresInSeconds?: number;
  }): Promise<SignedEvidenceDownloadUrl> {
    const expiresIn = params.expiresInSeconds ?? 120;

    const { data: evidenceRow, error: evidenceError } = await this.supabase
      .from("visit_evidence")
      .select(
        "id, organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key, created_at"
      )
      .eq("organization_id", params.orgId)
      .eq("visit_id", params.visitId)
      .eq("id", params.evidenceId)
      .maybeSingle<DbVisitEvidenceRow>();

    if (evidenceError || !evidenceRow) {
      throw new AppError(
        "NOT_FOUND",
        "Requested evidence item was not found in your active organization",
        404
      );
    }

    const { data: signed, error: signError } = await this.supabase.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .createSignedUrl(evidenceRow.storage_path, expiresIn);

    if (signError || !signed) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to generate signed download URL for evidence",
        500
      );
    }

    return {
      evidenceId: evidenceRow.id,
      storagePath: evidenceRow.storage_path,
      signedDownloadUrl: signed.signedUrl,
      expiresInSeconds: expiresIn,
    };
  }

  async checkOutVisitAtomic(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    checkedOutAt: string;
    notes?: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail> {
    const { data: visitRow, error: rpcError } = await this.supabase
      .rpc("check_out_visit", {
        p_org_id: params.orgId,
        p_visit_id: params.visitId,
        p_notes: params.notes ?? null,
        p_idempotency_key: params.idempotencyKey,
        p_lat: params.location.latitude,
        p_lng: params.location.longitude,
        p_accuracy_m: params.location.accuracyMeters,
        p_location_status: params.location.status,
      })
      .single<DbVisitRow>();

    if (rpcError || !visitRow) {
      if (rpcError?.code === "42501") {
        throw new AppError(
          "FORBIDDEN_INSUFFICIENT_ROLE",
          "You are not authorized to check out this visit",
          403
        );
      }
      if (rpcError?.code === "P0002") {
        throw new AppError(
          "NOT_FOUND",
          "The requested visit was not found in your active organization",
          404
        );
      }
      if (rpcError?.code === "22023") {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot check out while required checklist items remain incomplete",
          400
        );
      }
      throw new AppError(
        "CONFLICT",
        "Visit status has already changed and cannot be checked out again.",
        409
      );
    }

    const detail = await this.getVisitDetail(params.orgId, visitRow.id);
    if (!detail) {
      throw new AppError("NOT_FOUND", "Visit not found after check-out", 404);
    }
    return detail;
  }
}
