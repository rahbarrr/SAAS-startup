import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  onlyUnread: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markNotificationReadInputSchema = z.object({
  auditEventId: z.string().uuid("Audit event ID must be a valid UUID"),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadInputSchema>;
