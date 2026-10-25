import { z } from "zod";
import { cursorPaginationQuerySchema } from "@/lib/http/envelope";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  CHECKLIST_ANSWER_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  VISIT_LOCATION_STATUSES,
  VISIT_STATUSES,
} from "./domain";

export const visitIdParamSchema = z.object({
  visitId: z.string().uuid("visitId must be a valid UUID"),
});

export const evidenceIdParamSchema = z.object({
  evidenceId: z.string().uuid("evidenceId must be a valid UUID"),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "idempotencyKey must be at least 8 characters")
  .max(128, "idempotencyKey must be at most 128 characters")
  .regex(
    /^[a-zA-Z0-9._:-]+$/,
    "idempotencyKey may only contain alphanumeric characters, dots, underscores, colons, and hyphens"
  );

export const deviceLocationInputSchema = z
  .object({
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .nullable()
      .optional(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .nullable()
      .optional(),
    accuracyMeters: z
      .number()
      .min(0, "Accuracy must be non-negative")
      .max(100000, "Accuracy exceeds maximum allowed threshold")
      .nullable()
      .optional(),
    status: z.enum(VISIT_LOCATION_STATUSES).default("unavailable"),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.latitude !== undefined && data.latitude !== null;
    const hasLng = data.longitude !== undefined && data.longitude !== null;

    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both latitude and longitude must be provided together",
        path: ["latitude"],
      });
    }

    if (data.status === "captured_unverified" && (!hasLat || !hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coordinates are required when location status is 'captured_unverified'",
        path: ["status"],
      });
    }
  });

export type DeviceLocationInput = z.infer<typeof deviceLocationInputSchema>;

export const checkInStopInputSchema = z
  .object({
    tripStopId: z.string().uuid("tripStopId must be a valid UUID"),
    idempotencyKey: idempotencyKeySchema.optional(),
    location: deviceLocationInputSchema.optional(),
  })
  .strict();

export type CheckInStopInput = z.infer<typeof checkInStopInputSchema>;

export const checklistAnswerItemInputSchema = z
  .object({
    questionKey: z
      .string()
      .trim()
      .min(1, "questionKey is required")
      .max(80, "questionKey must be at most 80 characters")
      .regex(/^[a-z0-9_]+$/, "questionKey must be snake_case alphanumeric"),
    label: z.string().trim().min(1).max(240).optional(),
    answerType: z.enum(CHECKLIST_ANSWER_TYPES).optional(),
    answerValue: z.union([z.boolean(), z.string().max(500), z.number(), z.null()]),
    answerText: z.string().trim().max(500).nullable().optional(),
    flagged: z.boolean().optional(),
    required: z.boolean().optional(),
    completed: z.boolean(),
  })
  .strict();

export type ChecklistAnswerItemInput = z.infer<typeof checklistAnswerItemInputSchema>;

export const updateVisitExecutionInputSchema = z
  .object({
    notes: z.string().trim().max(2000).optional(),
    checklistItems: z.array(checklistAnswerItemInputSchema).max(50).default([]),
  })
  .strict();

export type UpdateVisitExecutionInput = z.infer<typeof updateVisitExecutionInputSchema>;

const DISALLOWED_EXECUTABLE_EXTENSION_REGEX =
  /\.(exe|bat|cmd|sh|bash|zsh|js|mjs|cjs|ts|tsx|jsx|html|htm|svg|php|py|rb|pl|jar|dll|so|dylib|msi|apk|dmg|wasm)$/i;

export const requestEvidenceUploadTicketInputSchema = z
  .object({
    fileType: z.enum(ALLOWED_EVIDENCE_MIME_TYPES, {
      message:
        "Unsupported or unsafe file type. Only JPEG, PNG, WebP images and PDF documents are allowed.",
    }),
    fileSize: z
      .number()
      .int("fileSize must be an integer byte count")
      .min(1, "File cannot be empty")
      .max(
        MAX_EVIDENCE_FILE_SIZE_BYTES,
        "File size exceeds maximum limit of 25 MiB (26,214,400 bytes)"
      ),
    originalFileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (name) => !DISALLOWED_EXECUTABLE_EXTENSION_REGEX.test(name),
        "Executable, script, HTML, or SVG file extensions are forbidden"
      )
      .optional(),
  })
  .strict();

export type RequestEvidenceUploadTicketInput = z.infer<
  typeof requestEvidenceUploadTicketInputSchema
>;

export const confirmEvidenceUploadInputSchema = z
  .object({
    storagePath: z.string().trim().min(10).max(300),
    fileType: z.enum(ALLOWED_EVIDENCE_MIME_TYPES),
    fileSize: z.number().int().min(1).max(MAX_EVIDENCE_FILE_SIZE_BYTES),
    caption: z.string().trim().max(500).default(""),
    idempotencyKey: idempotencyKeySchema.optional(),
  })
  .strict();

export type ConfirmEvidenceUploadInput = z.infer<typeof confirmEvidenceUploadInputSchema>;

export const checkOutVisitInputSchema = z
  .object({
    notes: z.string().trim().max(2000).optional(),
    idempotencyKey: idempotencyKeySchema.optional(),
    location: deviceLocationInputSchema.optional(),
  })
  .strict();

export type CheckOutVisitInput = z.infer<typeof checkOutVisitInputSchema>;

export const listVisitsQuerySchema = cursorPaginationQuerySchema.extend({
  status: z.enum(VISIT_STATUSES).optional(),
  tripStopId: z.string().uuid().optional(),
  employeeUserId: z.string().uuid().optional(),
});

export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
