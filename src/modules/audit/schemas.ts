import { z } from "zod";
import { ORG_ROLES } from "@/modules/tenancy/domain";

export const listAuditLogsQuerySchema = z.object({
  actionType: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  entityId: z.string().trim().min(1).max(255).optional(),
  actorUserId: z.string().uuid("actorUserId must be a valid UUID").optional(),
  startDateFrom: z.string().datetime({ offset: true }).optional(),
  startDateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export const exportAuditLogsQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  actionType: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  actorUserId: z.string().uuid("actorUserId must be a valid UUID").optional(),
  startDateFrom: z.string().datetime({ offset: true }).optional(),
  startDateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export type ExportAuditLogsQuery = z.infer<typeof exportAuditLogsQuerySchema>;

export const insertAuditEventSchema = z.object({
  orgId: z.string().uuid("orgId must be a valid UUID"),
  actorUserId: z.string().uuid("actorUserId must be a valid UUID").nullable().optional(),
  actorRole: z.enum(ORG_ROLES).nullable().optional(),
  actionType: z.string().trim().min(2).max(100),
  entityType: z.string().trim().min(2).max(50),
  entityId: z.string().trim().min(1).max(255),
  correlationId: z.string().trim().max(128).nullable().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  changes: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type InsertAuditEventInput = z.infer<typeof insertAuditEventSchema>;
