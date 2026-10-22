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

  it("rejects staging credentials in production and never prints values", () => {
    const secret = "super-secret-anon-key-xyz";
    const result = validateStartupEnv({
      ...base,
      NEXT_PUBLIC_SUPABASE_URL: "https://stagingprojectref.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("stagingprojectref");
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
});
