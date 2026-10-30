import { z } from "zod";
import { cursorPaginationQuerySchema } from "@/lib/http/envelope";
import {
  APPROVAL_INBOX_STATUS_FILTERS,
  TRIP_DECISION_STATUSES,
  TRIP_STATUSES,
} from "./domain";

export const allowlistedTripAuditMetadataSchema = z
  .object({
    source: z.enum(["web", "api", "mobile_web", "rpc"]).optional(),
    stop_count: z.number().int().min(0).max(500).optional(),
    reason_code: z.string().trim().min(1).max(80).optional(),
    client_version: z.string().trim().min(1).max(60).optional(),
    previous_decided_by: z.string().uuid().nullable().optional(),
    changed_fields: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type AllowlistedTripAuditMetadata = z.infer<
  typeof allowlistedTripAuditMetadataSchema
>;

export const tripIdParamSchema = z.object({
  tripId: z.string().uuid("tripId must be a valid UUID"),
});

export const isoDateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((val) => {
    const parsed = new Date(`${val}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(val);
  }, "Date must be a valid calendar date");

export const tripStopInputSchema = z
  .object({
    storeId: z.string().uuid("storeId must be a valid UUID"),
    sequenceNumber: z
      .number()
      .int("sequenceNumber must be an integer")
      .min(1, "sequenceNumber must start at 1"),
    plannedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type TripStopInput = z.infer<typeof tripStopInputSchema>;

function validateStopsSequenceAndUniqueness(
  stops: readonly TripStopInput[],
  ctx: z.RefinementCtx
): void {
  const seenStoreIds = new Set<string>();

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop) continue;

    if (seenStoreIds.has(stop.storeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate store stops are not allowed within the same trip",
        path: ["stops", i, "storeId"],
      });
    }
    seenStoreIds.add(stop.storeId);

    const expectedSequence = i + 1;
    if (stop.sequenceNumber !== expectedSequence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stop sequence numbers must be contiguous starting at 1 (expected ${expectedSequence} at index ${i}, got ${stop.sequenceNumber})`,
        path: ["stops", i, "sequenceNumber"],
      });
    }
  }
}

export const upsertTripDraftInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Trip title must be at least 2 characters")
      .max(160, "Trip title must be at most 160 characters"),
    purpose: z
      .string()
      .trim()
      .min(3, "Please describe the operational purpose")
      .max(1000, "Purpose must be at most 1000 characters"),
    startLocation: z.string().trim().min(2, "Starting location is required").max(200),
    destinationCity: z.string().trim().min(2, "Destination city is required").max(120),
    startDate: isoDateStringSchema,
    endDate: isoDateStringSchema,
    stops: z.array(tripStopInputSchema).max(50).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Trip endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
    validateStopsSequenceAndUniqueness(data.stops, ctx);
  });

export type UpsertTripDraftInput = z.infer<typeof upsertTripDraftInputSchema>;

export const listTripsQuerySchema = cursorPaginationQuerySchema.extend({
  status: z.enum(TRIP_STATUSES).optional(),
  ownerUserId: z.string().uuid().optional(),
  startDateFrom: isoDateStringSchema.optional(),
  startDateTo: isoDateStringSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;

export const listManagerApprovalInboxQuerySchema = cursorPaginationQuerySchema
  .extend({
    status: z.enum(APPROVAL_INBOX_STATUS_FILTERS).default("submitted"),
    ownerUserId: z.string().uuid().optional(),
    startDateFrom: isoDateStringSchema.optional(),
    startDateTo: isoDateStringSchema.optional(),
    search: z.string().trim().max(120).optional(),
    excludeOwnTrips: z.preprocess((val) => {
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

export type ListManagerApprovalInboxQuery = z.infer<
  typeof listManagerApprovalInboxQuerySchema
>;

export const submitTripInputSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
    metadata: allowlistedTripAuditMetadataSchema.optional(),
  })
  .strict();

export type SubmitTripInput = z.infer<typeof submitTripInputSchema>;

export const decideTripInputSchema = z
  .object({
    decision: z.enum(TRIP_DECISION_STATUSES),
    note: z.string().trim().max(1000).optional(),
    expectedSubmittedAt: z.string().datetime({ offset: true }).optional(),
    metadata: allowlistedTripAuditMetadataSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.decision === "changes_requested" || data.decision === "rejected") {
        return Boolean(data.note && data.note.trim().length >= 3);
      }
      return true;
    },
    {
      message:
        "A decision note of at least 3 characters is required when requesting changes or rejecting a trip",
      path: ["note"],
    }
  );

export type DecideTripInput = z.infer<typeof decideTripInputSchema>;
