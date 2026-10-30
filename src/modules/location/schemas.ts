import { z } from "zod";

export const recordBreadcrumbInputSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be >= -90")
    .max(90, "Latitude must be <= 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be >= -180")
    .max(180, "Longitude must be <= 180"),
  accuracyMeters: z
    .number()
    .min(0, "Accuracy must be non-negative")
    .max(50000, "Accuracy exceeds realistic threshold")
    .nullable()
    .optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
});

export type RecordBreadcrumbApiInput = z.infer<typeof recordBreadcrumbInputSchema>;

export const listBreadcrumbsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type ListBreadcrumbsQuery = z.infer<typeof listBreadcrumbsQuerySchema>;

export const purgeBreadcrumbsInputSchema = z.object({
  retentionDays: z.coerce
    .number()
    .int()
    .min(7, "Minimum retention is 7 days")
    .max(365)
    .default(30),
});

export type PurgeBreadcrumbsInput = z.infer<typeof purgeBreadcrumbsInputSchema>;

export const startTrackingSessionInputSchema = z.object({
  tripId: z.string().uuid("Invalid trip UUID"),
  consentRecordedAt: z.string().datetime({ offset: true }).optional(),
});
export type StartTrackingSessionInput = z.infer<typeof startTrackingSessionInputSchema>;

export const stopTrackingSessionInputSchema = z.object({
  tripId: z.string().uuid("Invalid trip UUID"),
  reason: z.string().max(200).optional(),
});
export type StopTrackingSessionInput = z.infer<typeof stopTrackingSessionInputSchema>;

export const submitLocationEventInputSchema = z.object({
  tripId: z.string().uuid("Invalid trip UUID"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(50000).nullable().optional(),
  speedMps: z.number().min(0).max(500).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  recordedAt: z.string().datetime({ offset: true }),
  source: z
    .enum([
      "mobile_foreground",
      "mobile_background",
      "manual_refresh",
      "geofence_trigger",
    ])
    .default("mobile_foreground"),
});
export type SubmitLocationEventInput = z.infer<typeof submitLocationEventInputSchema>;

export const upsertStoreGeofenceInputSchema = z.object({
  storeId: z.string().uuid("Invalid store UUID"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().min(10).max(2000).default(150),
  enabled: z.boolean().default(true),
});
export type UpsertStoreGeofenceInput = z.infer<typeof upsertStoreGeofenceInputSchema>;

export const submitGeofenceEventRecordInputSchema = z.object({
  tripId: z.string().uuid("Invalid trip UUID"),
  visitId: z.string().uuid("Invalid visit UUID").nullable().optional(),
  storeId: z.string().uuid("Invalid store UUID"),
  eventType: z.enum(["enter", "exit"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(50000).nullable().optional(),
  recordedAt: z.string().datetime({ offset: true }),
});
export type SubmitGeofenceEventRecordInput = z.infer<
  typeof submitGeofenceEventRecordInputSchema
>;
