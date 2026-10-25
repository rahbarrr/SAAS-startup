import "server-only";
import { AppError } from "@/lib/http/envelope";
import { logger } from "@/lib/observability/logger";
import {
  requireAnyOrgRole,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import { serializeAuditEventsToCsv } from "./csv-export";
import type {
  AuditExportFilter,
  InsertAuditEventInput,
  OrganizationAuditEvent,
  PaginatedAuditEventsResult,
} from "./domain";
import type { AuditRepository } from "./repository";
import {
  exportAuditLogsQuerySchema,
  insertAuditEventSchema,
  listAuditLogsQuerySchema,
} from "./schemas";

export async function recordAuditEventForOrg(params: {
  user?: AuthenticatedUser | null;
  candidateOrgId?: unknown;
  input: InsertAuditEventInput;
  tenancyRepository?: TenancyRepository;
  auditRepository: AuditRepository;
}): Promise<OrganizationAuditEvent> {
  const inputToValidate = { ...params.input };

  if (params.user && params.candidateOrgId && params.tenancyRepository) {
    const context = await resolveTenantContext({
      user: params.user,
      candidateOrgId: params.candidateOrgId,
      repository: params.tenancyRepository,
    });
    if (inputToValidate.orgId !== context.orgId) {
      throw new AppError(
        "FORBIDDEN_RESOURCE_ACCESS",
        "Audit event orgId does not match authenticated tenant scope.",
        403
      );
    }
    if (!inputToValidate.actorUserId) {
      inputToValidate.actorUserId = params.user.id;
    }
    if (!inputToValidate.actorRole) {
      inputToValidate.actorRole = context.role;
    }
  }

  const validated = insertAuditEventSchema.parse(inputToValidate);

  const event = await params.auditRepository.insertAuditEvent({
    orgId: validated.orgId,
    actorUserId: validated.actorUserId ?? null,
    actorRole: validated.actorRole ?? null,
    actionType: validated.actionType,
    entityType: validated.entityType,
    entityId: validated.entityId,
    correlationId: validated.correlationId ?? null,
    reason: validated.reason ?? null,
    changes: validated.changes,
    metadata: validated.metadata,
  });

  logger.info("organization_audit_event_recorded", {
    orgId: validated.orgId,
    actorUserId: validated.actorUserId ?? "SYSTEM",
    actionType: validated.actionType,
    entityType: validated.entityType,
    entityId: validated.entityId,
    correlationId: validated.correlationId ?? null,
  });

  return event;
}

export async function listAuditEventsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  auditRepository: AuditRepository;
}): Promise<PaginatedAuditEventsResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  // Managers and Admins can view audit logs
  requireOrgPermission(context, "members:read");

  const query = listAuditLogsQuerySchema.parse(params.rawQuery ?? {});

  return params.auditRepository.listAuditEvents(context.orgId, query);
}

export interface ExportAuditEventsResult {
  format: "csv" | "json";
  fileName: string;
  contentType: string;
  content: string;
  recordCount: number;
}

export async function exportAuditEventsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  correlationId?: string | null;
  tenancyRepository: TenancyRepository;
  auditRepository: AuditRepository;
}): Promise<ExportAuditEventsResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  // Export is strictly restricted to organization administrators
  requireAnyOrgRole(context, ["admin"]);

  const query = exportAuditLogsQuerySchema.parse(params.rawQuery ?? {});

  const filter: AuditExportFilter = {
    actionType: query.actionType,
    entityType: query.entityType,
    actorUserId: query.actorUserId,
    startDateFrom: query.startDateFrom,
    startDateTo: query.startDateTo,
    limit: query.limit,
  };

  const events = await params.auditRepository.streamAuditEventsForExport(
    context.orgId,
    filter
  );

  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `fieldtrack-audit-${context.orgId.slice(0, 8)}-${timestampStr}.${query.format}`;

  let content: string;
  let contentType: string;

  if (query.format === "json") {
    contentType = "application/json; charset=utf-8";
    content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        orgId: context.orgId,
        actorUserId: context.user.id,
        recordCount: events.length,
        filter,
        events,
      },
      null,
      2
    );
  } else {
    contentType = "text/csv; charset=utf-8";
    content = serializeAuditEventsToCsv(events);
  }

  // Audit the export action itself!
  try {
    await params.auditRepository.insertAuditEvent({
      orgId: context.orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "audit.exported",
      entityType: "audit_export",
      entityId: fileName,
      correlationId: params.correlationId ?? null,
      reason: "Administrator requested audit log export",
      metadata: {
        format: query.format,
        recordCount: events.length,
        startDateFrom: query.startDateFrom ?? null,
        startDateTo: query.startDateTo ?? null,
      },
    });
  } catch (err) {
    logger.warn("audit_export_self_audit_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    format: query.format,
    fileName,
    contentType,
    content,
    recordCount: events.length,
  };
}
