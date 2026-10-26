import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, decodeCursor, encodeCursor } from "@/lib/http/envelope";
import type { DbOrganizationAuditEventRow } from "@/types/database";
import type {
  AuditExportFilter,
  AuditLogFilter,
  InsertAuditEventInput,
  OrganizationAuditEvent,
  PaginatedAuditEventsResult,
} from "./domain";

export interface AuditRepository {
  insertAuditEvent(input: InsertAuditEventInput): Promise<OrganizationAuditEvent>;
  listAuditEvents(
    orgId: string,
    filter: AuditLogFilter
  ): Promise<PaginatedAuditEventsResult>;
  streamAuditEventsForExport(
    orgId: string,
    filter: AuditExportFilter
  ): Promise<OrganizationAuditEvent[]>;
}

export function mapAuditEventRow(
  row: DbOrganizationAuditEventRow
): OrganizationAuditEvent {
  return {
    id: row.id,
    orgId: row.organization_id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    correlationId: row.correlation_id,
    reason: row.reason,
    changes: (row.changes ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertAuditEvent(input: InsertAuditEventInput): Promise<OrganizationAuditEvent> {
    const { data, error } = await this.supabase
      .from("organization_audit_events")
      .insert({
        organization_id: input.orgId,
        actor_user_id: input.actorUserId ?? null,
        actor_role: input.actorRole ?? null,
        action_type: input.actionType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        correlation_id: input.correlationId ?? null,
        reason: input.reason ?? null,
        changes: input.changes ?? {},
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single<DbOrganizationAuditEventRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to record audit event: ${error?.message ?? "unknown error"}`,
        500
      );
    }

    return mapAuditEventRow(data);
  }

  async listAuditEvents(
    orgId: string,
    filter: AuditLogFilter
  ): Promise<PaginatedAuditEventsResult> {
    const pageSize = Math.min(Math.max(filter.limit ?? 25, 1), 100);

    let query = this.supabase
      .from("organization_audit_events")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (filter.actionType) {
      query = query.eq("action_type", filter.actionType);
    }
    if (filter.entityType) {
      query = query.eq("entity_type", filter.entityType);
    }
    if (filter.entityId) {
      query = query.eq("entity_id", filter.entityId);
    }
    if (filter.actorUserId) {
      query = query.eq("actor_user_id", filter.actorUserId);
    }
    if (filter.startDateFrom) {
      query = query.gte("created_at", filter.startDateFrom);
    }
    if (filter.startDateTo) {
      query = query.lte("created_at", filter.startDateTo);
    }
    if (filter.cursor) {
      const decoded = decodeCursor(filter.cursor);
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
      );
    }

    const { data, error } = await query.returns<DbOrganizationAuditEventRow[]>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to retrieve audit log", 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapAuditEventRow);
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

  async streamAuditEventsForExport(
    orgId: string,
    filter: AuditExportFilter
  ): Promise<OrganizationAuditEvent[]> {
    const maxLimit = Math.min(Math.max(filter.limit ?? 1000, 1), 5000);

    let query = this.supabase
      .from("organization_audit_events")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maxLimit);

    if (filter.actionType) {
      query = query.eq("action_type", filter.actionType);
    }
    if (filter.entityType) {
      query = query.eq("entity_type", filter.entityType);
    }
    if (filter.actorUserId) {
      query = query.eq("actor_user_id", filter.actorUserId);
    }
    if (filter.startDateFrom) {
      query = query.gte("created_at", filter.startDateFrom);
    }
    if (filter.startDateTo) {
      query = query.lte("created_at", filter.startDateTo);
    }

    const { data, error } = await query.returns<DbOrganizationAuditEventRow[]>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to export audit events", 500);
    }

    return (data ?? []).map(mapAuditEventRow);
  }
}
