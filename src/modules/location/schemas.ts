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
  retentionDays: z.coerce.number().int().min(7, "Minimum retention is 7 days").max(365).default(30),
});

export type PurgeBreadcrumbsInput = z.infer<typeof purgeBreadcrumbsInputSchema>;
