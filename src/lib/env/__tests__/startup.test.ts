import { describe, expect, it } from "vitest";
import {
  assertStartupEnv,
  isAiReportsEnabled,
  isUploadsEnabled,
  validateStartupEnv,
} from "../startup";

const base = {
  APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  EXPECTED_SUPABASE_PROJECT_REF: "abcdefghijklmnop",
};

describe("startup environment validation", () => {
  it("accepts a consistent production configuration", () => {
    expect(validateStartupEnv(base).ok).toBe(true);
  });

  it("rejects a mismatched Supabase project in production and never prints values", () => {
    const secret = "super-secret-anon-key-xyz";
    const result = validateStartupEnv({
      ...base,
      NEXT_PUBLIC_SUPABASE_URL: "https://otherprojectref.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("otherprojectref");
    expect(() =>
      assertStartupEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://x.example" })
    ).toThrow(/Invalid environment configuration/);
  });

  it("requires https, an expected project ref, and a model when an OpenAI key is set", () => {
    const { EXPECTED_SUPABASE_PROJECT_REF: _omit, ...noRef } = base;
    void _omit;
    expect(validateStartupEnv(noRef).problems.join(" ")).toContain(
      "EXPECTED_SUPABASE_PROJECT_REF"
    );
    expect(
      validateStartupEnv({ ...base, NEXT_PUBLIC_APP_URL: "http://app.example.com" }).ok
    ).toBe(false);
    expect(
      validateStartupEnv({ ...base, OPENAI_API_KEY: "sk-test" }).problems.join(" ")
    ).toContain("OPENAI_REPORT_MODEL");
  });

  it("refuses production configuration inside a preview deployment", () => {
    const result = validateStartupEnv({ ...base, VERCEL_ENV: "preview" });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("preview");
  });

  it("allows relaxed local development and requires APP_ENV", () => {
    expect(
      validateStartupEnv({
        APP_ENV: "development",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }).ok
    ).toBe(true);
    expect(validateStartupEnv({ ...base, APP_ENV: undefined }).ok).toBe(false);
  });

  it("kill switches default on and turn off only with explicit 'false'", () => {
    expect(isAiReportsEnabled({})).toBe(true);
    expect(isAiReportsEnabled({ AI_REPORTS_ENABLED: "false" })).toBe(false);
    expect(isUploadsEnabled({})).toBe(true);
    expect(isUploadsEnabled({ UPLOADS_ENABLED: "false" })).toBe(false);
  });

  it("validates exact production settings for rahbar1/saas-startup1 and lrolhonkrjhuwgnmcdsj", () => {
    const liveProd = {
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://lrolhonkrjhuwgnmcdsj.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhYmMxMjMiOiJ0ZXN0In0.eyJyb2xlIjoiYW5vbiJ9.signature",
      NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      EXPECTED_SUPABASE_PROJECT_REF: "lrolhonkrjhuwgnmcdsj",
      VERCEL_ENV: "production",
    };
    expect(validateStartupEnv(liveProd).ok).toBe(true);
  });

  it("safely trims accidental leading/trailing whitespace on environment variables", () => {
    const withWhitespace = {
      APP_ENV: "  production  ",
      NEXT_PUBLIC_SUPABASE_URL: "  https://lrolhonkrjhuwgnmcdsj.supabase.co\n",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "  anon-key-value  ",
      NEXT_PUBLIC_APP_URL: " https://saas-startup1.vercel.app \t",
      EXPECTED_SUPABASE_PROJECT_REF: " lrolhonkrjhuwgnmcdsj ",
    };
    expect(validateStartupEnv(withWhitespace).ok).toBe(true);
  });

  it("strictly fails when NEXT_PUBLIC_APP_URL is missing or empty in production", () => {
    const missingAppUrl = {
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://lrolhonkrjhuwgnmcdsj.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
      EXPECTED_SUPABASE_PROJECT_REF: "lrolhonkrjhuwgnmcdsj",
    };
    const result = validateStartupEnv(missingAppUrl);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_APP_URL");
    expect(() => assertStartupEnv(missingAppUrl)).toThrow(
      /Invalid environment configuration:\s+- NEXT_PUBLIC_APP_URL: invalid or missing/
    );
  });

  it("rejects malformed NEXT_PUBLIC_APP_URL without https protocol", () => {
    const malformed = {
      ...base,
      NEXT_PUBLIC_APP_URL: "saas-startup1.vercel.app", // missing https://
    };
    const result = validateStartupEnv(malformed);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("handles Vercel Preview deployments and rejects production config in preview", () => {
    // Preview builds use their generated HTTPS URL and must validate the configured Supabase project.
    const previewConfig = {
      APP_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://previewprojectref.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
      EXPECTED_SUPABASE_PROJECT_REF: "previewprojectref",
      VERCEL_ENV: "preview",
      VERCEL_URL: "saas-startup1-git-feat-rahbar1.vercel.app",
    };
    expect(validateStartupEnv(previewConfig).ok).toBe(true);

    // Production config must never run in a Vercel Preview deployment.
    const previewProd = {
      ...previewConfig,
      APP_ENV: "production",
    };
    const result = validateStartupEnv(previewProd);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain(
      "production configuration must never run in a preview deployment"
    );

    // In Production, VERCEL_URL cannot substitute for missing NEXT_PUBLIC_APP_URL.
    const prodMissingAppUrlWithVercelUrl = {
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://lrolhonkrjhuwgnmcdsj.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
      EXPECTED_SUPABASE_PROJECT_REF: "lrolhonkrjhuwgnmcdsj",
      VERCEL_ENV: "production",
      VERCEL_URL: "saas-startup1.vercel.app",
    };
    expect(validateStartupEnv(prodMissingAppUrlWithVercelUrl).ok).toBe(false);

    // Hosted Preview deployments must also fail closed when no project reference is supplied.
    const previewMissingRef = {
      ...previewConfig,
      EXPECTED_SUPABASE_PROJECT_REF: undefined,
    };
    expect(validateStartupEnv(previewMissingRef).ok).toBe(false);
  });

  it("ensures sensitive keys and credentials are never leaked in error messages", () => {
    const sensitiveKey = "sensitive-super-secret-key-12345";
    const sensitiveRef = "topsecretprojectref999";
    const result = validateStartupEnv({
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: `https://${sensitiveRef}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: sensitiveKey,
      NEXT_PUBLIC_APP_URL: "http://insecure-app.com",
      EXPECTED_SUPABASE_PROJECT_REF: "differentprojectref",
    });
    expect(result.ok).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(sensitiveKey);
    expect(serialized).not.toContain(sensitiveRef);
  });
});
