import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address")
  .max(254, "Email address is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long");

export const signInInputSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Password is required").max(128),
  })
  .strict();

export type SignInInput = z.infer<typeof signInInputSchema>;

/**
 * Public signup schema.
 * Uses `.strict()` so any attempt by a client to supply `organizationId`, `orgId`,
 * `role`, or `status` during public signup is rejected at the boundary.
 */
export const publicSignUpInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(120, "Full name must be at most 120 characters"),
  })
  .strict();

export type PublicSignUpInput = z.infer<typeof publicSignUpInputSchema>;

export const passwordRecoveryInputSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type PasswordRecoveryInput = z.infer<typeof passwordRecoveryInputSchema>;

export const passwordUpdateInputSchema = z
  .object({
    password: passwordSchema,
  })
  .strict();

export type PasswordUpdateInput = z.infer<typeof passwordUpdateInputSchema>;

/**
 * Prevents open-redirect vulnerabilities by allowing only internal relative paths.
 */
export function sanitizeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/"
): string {
  if (!candidate) {
    return fallback;
  }
  const trimmed = candidate.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\n") ||
    trimmed.includes("\r")
  ) {
    return fallback;
  }
  return trimmed;
}
