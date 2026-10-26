import "server-only";
import { z } from "zod";
import { getPublicEnv } from "./public";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must be a non-empty string")
    .optional(),
  CRON_SECRET: z.string().min(1, "CRON_SECRET must be a non-empty string").optional(),
  OPENAI_API_KEY: z
    .string()
    .min(1, "OPENAI_API_KEY must be a non-empty string")
    .optional(),
  OPENAI_REPORT_MODEL: z
    .string()
    .trim()
    .min(1, "OPENAI_REPORT_MODEL must be a non-empty model identifier")
    .max(120)
    .optional(),
  OPENAI_API_BASE_URL: z
    .string()
    .url("OPENAI_API_BASE_URL must be a valid URL")
    .default("https://api.openai.com/v1"),
  OPENAI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(4096).default(1200),
});

export type ServerEnv = ReturnType<typeof getPublicEnv> & z.infer<typeof serverEnvSchema>;

export interface OpenAiReportRuntimeConfig {
  configured: boolean;
  apiKey: string | null;
  model: string | null;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

/**
 * Validates and returns server-only environment variables.
 * Protected by `import "server-only"` so bundling into browser code is a build error.
 */
export function getServerEnv(
  envSource: Record<string, string | undefined> = process.env
): ServerEnv {
  const publicEnv = getPublicEnv(envSource);
  const serverOnly = serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: envSource.SUPABASE_SERVICE_ROLE_KEY || undefined,
    CRON_SECRET: envSource.CRON_SECRET || undefined,
    OPENAI_API_KEY: envSource.OPENAI_API_KEY || undefined,
    OPENAI_REPORT_MODEL: envSource.OPENAI_REPORT_MODEL || undefined,
    OPENAI_API_BASE_URL: envSource.OPENAI_API_BASE_URL || undefined,
    OPENAI_REQUEST_TIMEOUT_MS: envSource.OPENAI_REQUEST_TIMEOUT_MS || undefined,
    OPENAI_MAX_OUTPUT_TOKENS: envSource.OPENAI_MAX_OUTPUT_TOKENS || undefined,
  });

  return {
    ...publicEnv,
    ...serverOnly,
  };
}

/**
 * Resolves the optional server-only OpenAI report-draft configuration without
 * hard-coding a model name or assuming the feature is enabled when unconfigured.
 */
export function getOpenAiReportRuntimeConfig(
  envSource: Record<string, string | undefined> = process.env
): OpenAiReportRuntimeConfig {
  const parsed = serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: envSource.SUPABASE_SERVICE_ROLE_KEY || undefined,
    OPENAI_API_KEY: envSource.OPENAI_API_KEY || undefined,
    OPENAI_REPORT_MODEL: envSource.OPENAI_REPORT_MODEL || undefined,
    OPENAI_API_BASE_URL: envSource.OPENAI_API_BASE_URL || undefined,
    OPENAI_REQUEST_TIMEOUT_MS: envSource.OPENAI_REQUEST_TIMEOUT_MS || undefined,
    OPENAI_MAX_OUTPUT_TOKENS: envSource.OPENAI_MAX_OUTPUT_TOKENS || undefined,
  });

  const apiKey = parsed.OPENAI_API_KEY ?? null;
  const model = parsed.OPENAI_REPORT_MODEL ?? null;

  return {
    configured: Boolean(apiKey && model),
    apiKey,
    model,
    baseUrl: parsed.OPENAI_API_BASE_URL,
    timeoutMs: parsed.OPENAI_REQUEST_TIMEOUT_MS,
    maxOutputTokens: parsed.OPENAI_MAX_OUTPUT_TOKENS,
  };
}
