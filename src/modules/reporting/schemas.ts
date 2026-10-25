import { z } from "zod";
import { cursorPaginationQuerySchema } from "@/lib/http/envelope";
import { TRIP_STATUSES } from "@/modules/trips/domain";
import { isoDateStringSchema } from "@/modules/trips/schemas";
import { VISIT_STATUSES } from "@/modules/visits/domain";

export const managerDashboardFilterSchema = cursorPaginationQuerySchema
  .extend({
    startDateFrom: isoDateStringSchema.optional(),
    startDateTo: isoDateStringSchema.optional(),
    employeeUserId: z.string().uuid("employeeUserId must be a valid UUID").optional(),
    tripStatus: z.enum(TRIP_STATUSES).optional(),
    visitStatus: z.enum(["not_started", ...VISIT_STATUSES] as const).optional(),
    storeId: z.string().uuid("storeId must be a valid UUID").optional(),
    onlyExceptions: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") return false;
      if (val === true || val === "true" || val === "1") return true;
      if (val === false || val === "false" || val === "0") return false;
      return val;
    }, z.boolean().default(false)),
  })
  .superRefine((data, ctx) => {
    if (data.startDateFrom && data.startDateTo && data.startDateTo < data.startDateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDateTo must be on or after startDateFrom",
        path: ["startDateTo"],
      });
    }
  });

export type ManagerDashboardFilter = z.infer<typeof managerDashboardFilterSchema>;

export const operationsReportFilterSchema = z
  .object({
    range: z.enum(["7d", "30d", "quarter", "ytd", "custom"]).optional().default("30d"),
    startDateFrom: isoDateStringSchema.optional(),
    startDateTo: isoDateStringSchema.optional(),
    territory: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDateFrom && data.startDateTo && data.startDateTo < data.startDateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDateTo must be on or after startDateFrom",
        path: ["startDateTo"],
      });
    }
  });

export type OperationsReportFilter = z.infer<typeof operationsReportFilterSchema>;
