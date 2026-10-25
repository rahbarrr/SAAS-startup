import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeErrorMessage } from "@/lib/http/envelope";
import { validateStartupEnv } from "@/lib/env/startup";
import { buildLogLine, redactString } from "@/lib/observability/logger";
import { updateSessionAndEnforceAuth } from "@/lib/supabase/middleware";
import { sanitizeRedirectPath } from "@/modules/auth/schemas";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function fakeJwt(payload: Record<string, unknown>): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`;
}

const production = {
  APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ role: "anon", iss: "supabase" }),
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  EXPECTED_SUPABASE_PROJECT_REF: "abcdefghijklmnop",
};

describe("Phase 1: public/server secret separation in startup validation", () => {
  it("control: a real anon-role JWT and a publishable key are accepted", () => {
    expect(validateStartupEnv(production).ok).toBe(true);
    expect(
      validateStartupEnv({
        ...production,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_AbCdEf0123456789",
      }).ok
    ).toBe(true);
  });

  it.each(["development", "staging", "production"])(
    "rejects a service_role JWT placed in the public anon-key variable (%s) without echoing it",
    (appEnv) => {
      const leaked = fakeJwt({ role: "service_role", iss: "supabase" });
      const result = validateStartupEnv({
        ...production,
        APP_ENV: appEnv,
        NEXT_PUBLIC_APP_URL:
          appEnv === "development" ? "http://localhost:3000" : "https://app.example.com",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: leaked,
      });
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(JSON.stringify(result)).not.toContain(leaked);
    }
  );

  it("rejects a Supabase secret key (sb_secret_...) in the public variable", () => {
    const leaked = "sb_secret_AbCdEf0123456789ZyXw";
    const result = validateStartupEnv({
      ...production,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: leaked,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(leaked);
  });
});

describe("Phase 1: Supabase URL must really belong to EXPECTED_SUPABASE_PROJECT_REF", () => {
  it("rejects a lookalike host that merely starts with the project ref", () => {
    const result = validateStartupEnv({
      ...production,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.attacker.example",
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects a non-https Supabase URL outside development", () => {
    expect(
      validateStartupEnv({
        ...production,
        APP_ENV: "staging",
        NEXT_PUBLIC_SUPABASE_URL: "http://abcdefghijklmnop.supabase.co",
      }).ok
    ).toBe(false);
  });

  it("still allows a local http Supabase stack in development", () => {
    expect(
      validateStartupEnv({
        APP_ENV: "development",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }).ok
    ).toBe(true);
  });
});

describe("Phase 1: redirect sanitizer contract", () => {
  it.each([
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\u0000/evil.example",
    "/ok\\..\\evil",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/a\r\nSet-Cookie: x=1",
  ])("falls back for unsafe candidate %j", (candidate) => {
    expect(sanitizeRedirectPath(candidate, "/")).toBe("/");
  });

  it("preserves safe internal paths including query strings", () => {
    expect(sanitizeRedirectPath("/trips", "/")).toBe("/trips");
    expect(sanitizeRedirectPath("/trips/abc?tab=stops", "/")).toBe(
      "/trips/abc?tab=stops"
    );
    expect(sanitizeRedirectPath("/reset-password", "/")).toBe("/reset-password");
  });
});

describe("Phase 1: secret redaction in logs and user-facing errors", () => {
  const samples = {
    supabaseSecretKey: "sb_secret_AbCdEf0123456789ZyXwVuTs",
    bearer: "Bearer abcdef0123456789.ghijkl-mnop_qrst",
    dbPassword: "hunter2-very-secret",
  };

  it("redacts Supabase secret keys, bearer tokens and DB URLs from free text", () => {
    const text = `failed with ${samples.supabaseSecretKey}; header Authorization: ${samples.bearer}; url postgresql://postgres:${samples.dbPassword}@db.abc.supabase.co:5432/postgres`;
    const out = redactString(text);
    expect(out).not.toContain("AbCdEf0123456789");
    expect(out).not.toContain("abcdef0123456789.ghijkl");
    expect(out).not.toContain(samples.dbPassword);
    const line = buildLogLine({ level: "error", event: "x", fields: { detail: text } });
    expect(line).not.toContain(samples.dbPassword);
    expect(line).not.toContain("AbCdEf0123456789");
  });

  it.each([
    ["Supabase secret key", `bad ${samples.supabaseSecretKey}`],
    ["OpenAI key", "provider said sk-abcdefghijklmnopqrstuvwxyz0123"],
    ["bearer token", `rejected ${samples.bearer}`],
    ["DB URL", `connect postgres://u:${samples.dbPassword}@h/db failed`],
  ])("never returns a message containing a %s to the user", (_label, message) => {
    const out = sanitizeErrorMessage(message);
    expect(out).not.toContain("sb_secret_");
    expect(out).not.toContain("sk-abc");
    expect(out).not.toContain("Bearer");
    expect(out).not.toContain(samples.dbPassword);
  });
});

describe("Phase 1: proxy session and access enforcement", () => {
  const ENV_KEYS = [
    "APP_ENV",
    "NODE_ENV",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;

  beforeEach(() => {
    getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function stubSupabaseEnv(configured: boolean): void {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      configured ? "https://abcdefghijklmnop.supabase.co" : ""
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", configured ? "publishable-key" : "");
  }

  function req(
    path: string,
    init: { method?: string; headers?: Record<string, string> } = {}
  ): NextRequest {
    return new NextRequest(`https://app.example.com${path}`, {
      method: init.method ?? "GET",
      headers: { host: "app.example.com", ...(init.headers ?? {}) },
    });
  }

  it.each(["staging", "production"])(
    "fails CLOSED (503) when Supabase env is missing in %s, without leaking config",
    async (appEnv) => {
      stubSupabaseEnv(false);
      vi.stubEnv("APP_ENV", appEnv);
      for (const path of ["/trips", "/api/orgs", "/"]) {
        const res = await updateSessionAndEnforceAuth(req(path));
        expect(res.status).toBe(503);
        expect(res.headers.get("x-request-id")).toBeTruthy();
        const body = JSON.stringify(await res.json());
        expect(body).not.toMatch(/supabase|anon|key/i);
      }
    }
  );

  it("fails closed when NODE_ENV is production even if APP_ENV is unset", async () => {
    stubSupabaseEnv(false);
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await updateSessionAndEnforceAuth(req("/trips"));
    expect(res.status).toBe(503);
  });

  it("keeps local development usable without Supabase env (pass-through)", async () => {
    stubSupabaseEnv(false);
    vi.stubEnv("APP_ENV", "development");
    const res = await updateSessionAndEnforceAuth(req("/trips"));
    expect(res.status).toBe(200);
  });

  it("redirects unauthenticated users on protected pages to /login with a next param", async () => {
    stubSupabaseEnv(true);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    for (const path of [
      "/trips",
      "/stores",
      "/visits",
      "/approvals",
      "/team",
      "/notifications",
      "/onboarding",
      "/reset-password",
    ]) {
      const res = await updateSessionAndEnforceAuth(req(path));
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    }
  });

  it("sends signed-in users away from login/signup/forgot-password", async () => {
    stubSupabaseEnv(true);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      const res = await updateSessionAndEnforceAuth(req(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/");
    }
  });

  it("rejects cross-origin state-changing API requests before any handler runs", async () => {
    stubSupabaseEnv(true);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const res = await updateSessionAndEnforceAuth(
        req("/api/orgs", { method, headers: { origin: "https://evil.example" } })
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FORBIDDEN");
    }
    const ok = await updateSessionAndEnforceAuth(
      req("/api/orgs", { method: "POST", headers: { origin: "https://app.example.com" } })
    );
    expect(ok.status).toBe(200);
  });

  it("replaces malformed inbound request ids and echoes a safe one on every response", async () => {
    stubSupabaseEnv(true);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const bad = await updateSessionAndEnforceAuth(
      req("/trips", { headers: { "x-request-id": "short" } })
    );
    expect(bad.headers.get("x-request-id")).not.toBe("short");
    const good = await updateSessionAndEnforceAuth(
      req("/trips", { headers: { "x-request-id": "req-12345678" } })
    );
    expect(good.headers.get("x-request-id")).toBe("req-12345678");
  });

  it("references only expected env keys (guard against silent renames)", () => {
    expect(ENV_KEYS).toContain("APP_ENV");
  });
});
