import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type { Trip, TripAuditEvent } from "@/modules/trips/domain";
import type {
  DbInAppNotificationReadRow,
  DbTripAuditEventRow,
  DbTripRow,
} from "@/types/database";
import { NOTIFICATION_EVENT_TYPES, type NotificationReadReceipt } from "./domain";

export interface OrgCommittedNotificationDataset {
  trips: Trip[];
  auditEvents: TripAuditEvent[];
  readReceipts: NotificationReadReceipt[];
}

export interface NotificationsRepository {
  loadOrgCommittedNotificationDataset(params: {
    orgId: string;
    userId: string;
  }): Promise<OrgCommittedNotificationDataset>;
  markNotificationReadIdempotent(params: {
    orgId: string;
    userId: string;
    auditEventId: string;
  }): Promise<NotificationReadReceipt>;
  markAllNotificationsReadForOrg(params: {
    orgId: string;
    userId: string;
    auditEventIds: string[];
  }): Promise<NotificationReadReceipt[]>;
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

function mapAuditRow(row: DbTripAuditEventRow): TripAuditEvent {
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

function mapReceiptRow(row: DbInAppNotificationReadRow): NotificationReadReceipt {
  return {
    orgId: row.organization_id,
    auditEventId: row.audit_event_id,
    userId: row.user_id,
    readAt: row.read_at,
  };
}

export class SupabaseNotificationsRepository implements NotificationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadOrgCommittedNotificationDataset(params: {
    orgId: string;
    userId: string;
  }): Promise<OrgCommittedNotificationDataset> {
    const [tripsRes, auditsRes, readsRes] = await Promise.all([
      this.client
        .from("trips")
        .select("*")
        .eq("organization_id", params.orgId)
        .returns<DbTripRow[]>(),
      this.client
        .from("trip_audit_events")
        .select("*")
        .eq("organization_id", params.orgId)
        .in("event_type", [...NOTIFICATION_EVENT_TYPES])
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<DbTripAuditEventRow[]>(),
      this.client
        .from("in_app_notification_reads")
        .select("*")
        .eq("organization_id", params.orgId)
        .eq("user_id", params.userId)
        .returns<DbInAppNotificationReadRow[]>(),
    ]);

    if (tripsRes.error || auditsRes.error || readsRes.error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load committed notification events",
        500
      );
    }

    return {
      trips: (tripsRes.data ?? []).map(mapTripRow),
      auditEvents: (auditsRes.data ?? []).map(mapAuditRow),
      readReceipts: (readsRes.data ?? []).map(mapReceiptRow),
    };
  }

  async markNotificationReadIdempotent(params: {
    orgId: string;
    userId: string;
    auditEventId: string;
  }): Promise<NotificationReadReceipt> {
    const { data, error } = await this.client
      .rpc("mark_in_app_notification_read", {
        p_org_id: params.orgId,
        p_audit_event_id: params.auditEventId,
      })
      .single<DbInAppNotificationReadRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to record notification read state",
        500
      );
    }

    return mapReceiptRow(data);
  }

  async markAllNotificationsReadForOrg(params: {
    orgId: string;
    userId: string;
    auditEventIds: string[];
  }): Promise<NotificationReadReceipt[]> {
    if (params.auditEventIds.length === 0) return [];
    const rows = params.auditEventIds.map((auditEventId) => ({
      organization_id: params.orgId,
      audit_event_id: auditEventId,
      user_id: params.userId,
      read_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from("in_app_notification_reads")
      .upsert(rows, {
        onConflict: "organization_id,audit_event_id,user_id",
        ignoreDuplicates: true,
      })
      .select("*")
      .returns<DbInAppNotificationReadRow[]>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to record bulk notification read receipts",
        500
      );
    }

    return (data ?? []).map(mapReceiptRow);
  }
}
