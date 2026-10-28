import "server-only";
import { z } from "zod";
import { getPublicEnv } from "./public";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must be a non-empty string")
    .optional(),
  CRON_SECRET: z.string().min(1, "CRON_SECRET must be a non-empty string").optional(),
  RESEND_API_KEY: z.string().trim().min(1, "RESEND_API_KEY must be non-empty").optional(),
  RESEND_FROM_EMAIL: z.string().trim().min(3, "RESEND_FROM_EMAIL must be non-empty").max(254).optional(),
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
  GOOGLE_MAPS_ROUTES_API_KEY: z
    .string()
    .min(1, "GOOGLE_MAPS_ROUTES_API_KEY must be a non-empty string")
    .optional(),
  ROUTING_PROVIDER: z.string().optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, "STRIPE_SECRET_KEY must be a non-empty string")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, "STRIPE_WEBHOOK_SECRET must be a non-empty string")
    .optional(),
  STRIPE_PRICE_ID_PRO_MONTHLY: z
    .string()
    .min(1, "STRIPE_PRICE_ID_PRO_MONTHLY must be a non-empty string")
    .optional(),
  STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: z
    .string()
    .min(1, "STRIPE_PRICE_ID_ENTERPRISE_MONTHLY must be a non-empty string")
    .optional(),
  STRIPE_API_BASE_URL: z
    .string()
    .url("STRIPE_API_BASE_URL must be a valid URL")
    .default("https://api.stripe.com/v1"),
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

export interface StripeRuntimeConfig {
  configured: boolean;
  webhookConfigured: boolean;
  secretKey: string | null;
  webhookSecret: string | null;
  priceIdProMonthly: string | null;
  priceIdEnterpriseMonthly: string | null;
  apiBaseUrl: string;
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
    RESEND_API_KEY: envSource.RESEND_API_KEY || undefined,
    RESEND_FROM_EMAIL: envSource.RESEND_FROM_EMAIL || undefined,
    OPENAI_API_KEY: envSource.OPENAI_API_KEY || undefined,
    OPENAI_REPORT_MODEL: envSource.OPENAI_REPORT_MODEL || undefined,
    OPENAI_API_BASE_URL: envSource.OPENAI_API_BASE_URL || undefined,
    OPENAI_REQUEST_TIMEOUT_MS: envSource.OPENAI_REQUEST_TIMEOUT_MS || undefined,
    OPENAI_MAX_OUTPUT_TOKENS: envSource.OPENAI_MAX_OUTPUT_TOKENS || undefined,
    GOOGLE_MAPS_ROUTES_API_KEY: envSource.GOOGLE_MAPS_ROUTES_API_KEY || undefined,
    ROUTING_PROVIDER: envSource.ROUTING_PROVIDER || undefined,
    STRIPE_SECRET_KEY: envSource.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: envSource.STRIPE_WEBHOOK_SECRET || undefined,
    STRIPE_PRICE_ID_PRO_MONTHLY: envSource.STRIPE_PRICE_ID_PRO_MONTHLY || undefined,
    STRIPE_PRICE_ID_ENTERPRISE_MONTHLY:
      envSource.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || undefined,
    STRIPE_API_BASE_URL: envSource.STRIPE_API_BASE_URL || undefined,
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

/**
 * Resolves the optional server-only Stripe billing configuration without
 * failing startup when billing credentials are not yet configured in the environment.
 */
export function getStripeRuntimeConfig(
  envSource: Record<string, string | undefined> = process.env
): StripeRuntimeConfig {
  const parsed = serverEnvSchema.parse({
    STRIPE_SECRET_KEY: envSource.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: envSource.STRIPE_WEBHOOK_SECRET || undefined,
    STRIPE_PRICE_ID_PRO_MONTHLY: envSource.STRIPE_PRICE_ID_PRO_MONTHLY || undefined,
    STRIPE_PRICE_ID_ENTERPRISE_MONTHLY:
      envSource.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || undefined,
    STRIPE_API_BASE_URL: envSource.STRIPE_API_BASE_URL || undefined,
  });

  const secretKey = parsed.STRIPE_SECRET_KEY ?? null;
  const webhookSecret = parsed.STRIPE_WEBHOOK_SECRET ?? null;
  const priceIdProMonthly = parsed.STRIPE_PRICE_ID_PRO_MONTHLY ?? null;
  const priceIdEnterpriseMonthly = parsed.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY ?? null;

  return {
    configured: Boolean(secretKey && (priceIdProMonthly || priceIdEnterpriseMonthly)),
    webhookConfigured: Boolean(secretKey && webhookSecret),
    secretKey,
    webhookSecret,
    priceIdProMonthly,
    priceIdEnterpriseMonthly,
    apiBaseUrl: parsed.STRIPE_API_BASE_URL,
  };
}
