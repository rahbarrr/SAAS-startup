import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type { Store } from "@/modules/stores/domain";
import type { Trip, TripAuditEvent, TripStop } from "@/modules/trips/domain";
import {
  type AllowedEvidenceMimeType,
  buildUnverifiedDeviceLocation,
  type Visit,
  type VisitChecklistItem,
  type VisitEvidence,
} from "@/modules/visits/domain";
import type {
  DbStoreRow,
  DbTripAuditEventRow,
  DbTripRow,
  DbTripStopRow,
  DbVisitChecklistItemRow,
  DbVisitEvidenceRow,
  DbVisitRow,
} from "@/types/database";

export interface OrgOperationalDataset {
  stores: Store[];
  trips: Trip[];
  tripStops: TripStop[];
  visits: Visit[];
  checklistItems: VisitChecklistItem[];
  evidence: VisitEvidence[];
  auditEvents: TripAuditEvent[];
}

export interface ReportingRepository {
  loadOrgOperationalDataset(orgId: string): Promise<OrgOperationalDataset>;
}

function mapStore(row: DbStoreRow): Store {
  return {
    id: row.id,
    orgId: row.organization_id,
    name: row.name,
    region: row.region,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateProvince: row.state_province,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrip(row: DbTripRow): Trip {
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

function mapTripStop(row: DbTripStopRow): TripStop {
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

function mapVisit(row: DbVisitRow): Visit {
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

function mapChecklistItem(row: DbVisitChecklistItemRow): VisitChecklistItem {
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

function mapEvidence(row: DbVisitEvidenceRow): VisitEvidence {
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

function mapAuditEvent(row: DbTripAuditEventRow): TripAuditEvent {
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

export class SupabaseReportingRepository implements ReportingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async loadOrgOperationalDataset(orgId: string): Promise<OrgOperationalDataset> {
    const [
      storesRes,
      tripsRes,
      stopsRes,
      visitsRes,
      checklistRes,
      evidenceRes,
      auditRes,
    ] = await Promise.all([
      this.supabase
        .from("stores")
        .select(
          "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .returns<DbStoreRow[]>(),
      this.supabase
        .from("trips")
        .select(
          "id, organization_id, owner_user_id, title, start_date, end_date, purpose, status, submitted_at, decided_by, decided_at, decision_note, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .returns<DbTripRow[]>(),
      this.supabase
        .from("trip_stops")
        .select(
          "id, organization_id, trip_id, store_id, sequence_number, planned_at, status, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .order("sequence_number", { ascending: true })
        .returns<DbTripStopRow[]>(),
      this.supabase
        .from("visits")
        .select(
          "id, organization_id, trip_stop_id, employee_user_id, checked_in_at, checked_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_location_status, check_out_lat, check_out_lng, check_out_accuracy_m, check_out_location_status, check_in_idempotency_key, check_out_idempotency_key, notes, status, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .returns<DbVisitRow[]>(),
      this.supabase
        .from("visit_checklist_items")
        .select(
          "id, organization_id, visit_id, question_key, label, answer_type, answer_value, answer_text, flagged, required, completed_at, completed_by, created_at, updated_at"
        )
        .eq("organization_id", orgId)
        .returns<DbVisitChecklistItemRow[]>(),
      this.supabase
        .from("visit_evidence")
        .select(
          "id, organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key, created_at"
        )
        .eq("organization_id", orgId)
        .returns<DbVisitEvidenceRow[]>(),
      this.supabase
        .from("trip_audit_events")
        .select(
          "id, organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
        .returns<DbTripAuditEventRow[]>(),
    ]);

    if (
      storesRes.error ||
      tripsRes.error ||
      stopsRes.error ||
      visitsRes.error ||
      checklistRes.error ||
      evidenceRes.error ||
      auditRes.error
    ) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load organization operational reporting dataset",
        500
      );
    }

    return {
      stores: (storesRes.data ?? []).map(mapStore),
      trips: (tripsRes.data ?? []).map(mapTrip),
      tripStops: (stopsRes.data ?? []).map(mapTripStop),
      visits: (visitsRes.data ?? []).map(mapVisit),
      checklistItems: (checklistRes.data ?? []).map(mapChecklistItem),
      evidence: (evidenceRes.data ?? []).map(mapEvidence),
      auditEvents: (auditRes.data ?? []).map(mapAuditEvent),
    };
  }
}
