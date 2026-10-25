import { z } from "zod";

const flag = z.enum(["true", "false"]).default("true");

/** Hosted Supabase API domains. A project ref must be the entire first label of one of these. */
const SUPABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.in"] as const;

/**
 * Returns the `role` claim of a JWT-shaped value without verifying it, or null if the value is
 * not a decodable JWT. Used only to detect privileged keys pasted into public variables.
 */
function jwtRoleClaim(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = (parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    if (payload && typeof payload === "object" && "role" in payload) {
      const role = (payload as { role: unknown }).role;
      return typeof role === "string" ? role : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** True for Supabase secret keys and service-role JWTs, which must never be public. */
function isPrivilegedSupabaseKey(value: string): boolean {
  return value.startsWith("sb_secret_") || jwtRoleClaim(value) === "service_role";
}

const startupSchema = z
  .object({
    APP_ENV: z.enum(["development", "staging", "production"]),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    EXPECTED_SUPABASE_PROJECT_REF: z
      .string()
      .regex(/^[a-z0-9]{10,40}$/)
      .optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_REPORT_MODEL: z.string().min(1).optional(),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    AI_REPORTS_ENABLED: flag,
    UPLOADS_ENABLED: flag,
  })
  .superRefine((env, ctx) => {
    // NEXT_PUBLIC_* values are inlined into browser bundles. A privileged key here is a leak,
    // in every environment including development.
    if (isPrivilegedSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        message:
          "must be the public anon/publishable key; a service-role or secret key must never be exposed via NEXT_PUBLIC_*",
      });
    }
    if (env.APP_ENV !== "development") {
      if (!env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXT_PUBLIC_APP_URL"],
          message: "must use https outside development",
        });
      }
      if (!env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXT_PUBLIC_SUPABASE_URL"],
          message: "must use https outside development",
        });
      }
      if (!env.EXPECTED_SUPABASE_PROJECT_REF) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EXPECTED_SUPABASE_PROJECT_REF"],
          message:
            "is required in staging/production to prevent cross-environment credentials",
        });
      } else {
        const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.toLowerCase();
        const expectedRef = env.EXPECTED_SUPABASE_PROJECT_REF;
        const matchesProject = SUPABASE_HOST_SUFFIXES.some(
          (suffix) => host === `${expectedRef}${suffix}`
        );
        if (!matchesProject) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["NEXT_PUBLIC_SUPABASE_URL"],
            message:
              "does not belong to EXPECTED_SUPABASE_PROJECT_REF for this environment",
          });
        }
      }
    }
    if (env.APP_ENV === "production" && env.VERCEL_ENV === "preview") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_ENV"],
        message: "production configuration must never run in a preview deployment",
      });
    }
    if (env.OPENAI_API_KEY && !env.OPENAI_REPORT_MODEL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_REPORT_MODEL"],
        message: "is required when OPENAI_API_KEY is set",
      });
    }
  });

export interface StartupEnvResult {
  ok: boolean;
  /** Variable names and failure reasons only. Values are NEVER included. */
  problems: string[];
}

export function validateStartupEnv(
  envSource: Record<string, string | undefined> = process.env
): StartupEnvResult {
  const pick = (key: string): string | undefined => envSource[key] || undefined;
  const parsed = startupSchema.safeParse({
    APP_ENV: pick("APP_ENV"),
    NEXT_PUBLIC_SUPABASE_URL: pick("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_APP_URL: pick("NEXT_PUBLIC_APP_URL"),
    EXPECTED_SUPABASE_PROJECT_REF: pick("EXPECTED_SUPABASE_PROJECT_REF"),
    OPENAI_API_KEY: pick("OPENAI_API_KEY"),
    OPENAI_REPORT_MODEL: pick("OPENAI_REPORT_MODEL"),
    VERCEL_ENV: pick("VERCEL_ENV"),
    AI_REPORTS_ENABLED: pick("AI_REPORTS_ENABLED"),
    UPLOADS_ENABLED: pick("UPLOADS_ENABLED"),
  });

  if (parsed.success) return { ok: true, problems: [] };

  return {
    ok: false,
    problems: parsed.error.issues.map(
      (issue) =>
        `${issue.path.join(".") || "(env)"}: ${issue.code === "custom" ? issue.message : `invalid or missing (${issue.code})`}`
    ),
  };
}

/** Throws with variable names only (never values) when required configuration is invalid. */
export function assertStartupEnv(
  envSource: Record<string, string | undefined> = process.env
): void {
  const result = validateStartupEnv(envSource);
  if (!result.ok) {
    throw new Error(
      `Invalid environment configuration:\n - ${result.problems.join("\n - ")}`
    );
  }
}

/** Incident kill switches. Changing them requires a redeploy/env update. */
export function isAiReportsEnabled(
  envSource: Record<string, string | undefined> = process.env
): boolean {
  return envSource.AI_REPORTS_ENABLED !== "false";
}

export function isUploadsEnabled(
  envSource: Record<string, string | undefined> = process.env
): boolean {
  return envSource.UPLOADS_ENABLED !== "false";
}
