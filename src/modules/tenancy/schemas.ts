import { z } from "zod";
import { cursorPaginationQuerySchema } from "@/lib/http/envelope";
import { MEMBERSHIP_STATUSES, ORG_ROLES } from "./domain";

export const orgIdParamSchema = z.object({
  orgId: z.string().uuid("orgId must be a valid UUID"),
});

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Organization slug must be at least 2 characters")
  .max(63, "Organization slug must be at most 63 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase alphanumeric characters and single hyphens"
  );

export const COMPANY_SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

export const createOrganizationInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(120, "Company name must be at most 120 characters"),
  slug: organizationSlugSchema,
  industry: z.string().trim().min(2, "Select or enter your industry").max(120),
  companySize: z.enum(COMPANY_SIZE_OPTIONS),
  country: z.string().trim().min(2, "Country is required").max(100),
  website: z
    .string()
    .trim()
    .max(2048)
    .url("Enter a valid company website URL")
    .or(z.literal(""))
    .default(""),
  phone: z.string().trim().max(40, "Phone number is too long").default(""),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

export const listOrgMembersQuerySchema = cursorPaginationQuerySchema.extend({
  role: z.enum(ORG_ROLES).optional(),
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
});

export type ListOrgMembersQuery = z.infer<typeof listOrgMembersQuerySchema>;

export const addOrgMemberInputSchema = z
  .object({
    userId: z.string().uuid("userId must be a valid UUID"),
    role: z.enum(ORG_ROLES),
    status: z.enum(MEMBERSHIP_STATUSES).default("active"),
    managerUserId: z
      .string()
      .uuid("managerUserId must be a valid UUID")
      .nullable()
      .optional(),
  })
  .refine((data) => !data.managerUserId || data.managerUserId !== data.userId, {
    message: "A member cannot be assigned as their own manager",
    path: ["managerUserId"],
  });

export type AddOrgMemberInput = z.infer<typeof addOrgMemberInputSchema>;

export const switchActiveOrgInputSchema = z.object({
  orgId: z.string().uuid("orgId must be a valid UUID"),
});

export type SwitchActiveOrgInput = z.infer<typeof switchActiveOrgInputSchema>;

export const createOrgInvitationInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email address is required")
    .max(254),
  role: z.enum(["manager", "field_employee"]),
  expiresInHours: z.coerce.number().int().min(1).max(168).default(72),
});

export type CreateOrgInvitationInput = z.infer<typeof createOrgInvitationInputSchema>;

/**
 * Strict schema for invitation acceptance.
 * Intentionally uses `.strict()` so any attempt to pass `role` or `orgId` from the client is rejected.
 */
export const acceptOrgInvitationInputSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(16, "Invitation token is invalid")
      .max(256, "Invitation token is invalid"),
  })
  .strict();

export type AcceptOrgInvitationInput = z.infer<typeof acceptOrgInvitationInputSchema>;
