import { z } from "zod";
import { cursorPaginationQuerySchema } from "@/lib/http/envelope";

export const storeIdParamSchema = z.object({
  storeId: z.string().uuid("storeId must be a valid UUID"),
});

export const listStoresQuerySchema = cursorPaginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  region: z.string().trim().max(100).optional(),
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;

const latitudeSchema = z
  .number({ invalid_type_error: "Latitude must be a number" })
  .finite()
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

const longitudeSchema = z
  .number({ invalid_type_error: "Longitude must be a number" })
  .finite()
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

export const createStoreInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Store name is required")
      .max(160, "Store name must be at most 160 characters"),
    region: z
      .string()
      .trim()
      .min(1, "Region is required")
      .max(100, "Region must be at most 100 characters"),
    addressLine1: z
      .string()
      .trim()
      .min(1, "Street address is required")
      .max(200, "Street address must be at most 200 characters"),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(120, "City must be at most 120 characters"),
    stateProvince: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(32).nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Country code must be a 2-letter ISO code")
      .default("US"),
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasLat = data.latitude !== undefined && data.latitude !== null;
      const hasLng = data.longitude !== undefined && data.longitude !== null;
      return hasLat === hasLng;
    },
    {
      message: "Latitude and longitude must both be provided together or both omitted",
      path: ["latitude"],
    }
  );

export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

export const updateStoreInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    region: z.string().trim().min(1).max(100).optional(),
    addressLine1: z.string().trim().min(1).max(200).optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().min(1).max(120).optional(),
    stateProvince: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(32).nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Country code must be a 2-letter ISO code")
      .optional(),
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const latProvided = data.latitude !== undefined;
      const lngProvided = data.longitude !== undefined;
      if (!latProvided && !lngProvided) {
        return true;
      }
      const hasLat = data.latitude !== undefined && data.latitude !== null;
      const hasLng = data.longitude !== undefined && data.longitude !== null;
      return hasLat === hasLng;
    },
    {
      message: "Latitude and longitude must both be provided together or both cleared",
      path: ["latitude"],
    }
  );

export type UpdateStoreInput = z.infer<typeof updateStoreInputSchema>;
