import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSameOriginMutation, sanitizePostgrestSearchTerm } from "@/lib/http/envelope";
import { isProtectedPath } from "@/lib/supabase/middleware";
import {
  isTrustedRedirectUrl,
  requestPasswordRecoveryForCaller,
} from "@/modules/auth/service";

describe("Security regressions (Phase 10)", () => {
  it("accepts only redirect URLs matching the trusted origin", () => {
    const trusted = "https://app.example.com";
    expect(isTrustedRedirectUrl("https://app.example.com/auth/callback", trusted)).toBe(
      true
    );
    expect(isTrustedRedirectUrl("https://attacker.example/auth/callback", trusted)).toBe(
      false
    );
    expect(
      isTrustedRedirectUrl("https://app.example.com.attacker.example/x", trusted)
    ).toBe(false);
    expect(isTrustedRedirectUrl("https://user:pw@app.example.com/x", trusted)).toBe(
      false
    );
    expect(isTrustedRedirectUrl("javascript:alert(1)", trusted)).toBe(false);
    expect(isTrustedRedirectUrl("not a url", trusted)).toBe(false);
  });

  it("rejects password recovery with an untrusted redirect before contacting the provider", async () => {
    let called = false;
    const authProvider = {
      sendPasswordRecoveryEmail: async () => {
        called = true;
      },
    } as never;

    await expect(
      requestPasswordRecoveryForCaller({
        rawInput: { email: "victim@example.com" },
        redirectToUrl: "https://attacker.example/auth/callback?next=/reset-password",
        trustedOrigin: "https://app.example.com",
        authProvider,
      })
    ).rejects.toThrow(/Untrusted/);
    expect(called).toBe(false);
  });

  it("protects notifications and reset-password routes in middleware", () => {
    expect(isProtectedPath("/notifications")).toBe(true);
    expect(isProtectedPath("/reset-password")).toBe(true);
  });

  it("sets defensive HTTP security headers in next.config.ts", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "next.config.ts"), "utf8");
    for (const header of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(source).toContain(header);
    }
  });

  it("strips PostgREST filter-injection characters from search terms", () => {
    const cleaned = sanitizePostgrestSearchTerm(
      "a%,owner_user_id.neq.x),(id.not.is.null"
    );
    expect(cleaned).not.toMatch(/[,()%_:*]/);
  });

  it("rejects cross-origin state-changing API requests but allows same-origin and reads", () => {
    const host = "app.example.com";
    expect(
      isSameOriginMutation({ method: "POST", originHeader: "https://evil.example", host })
    ).toBe(false);
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://app.example.com",
        host,
      })
    ).toBe(true);
    expect(isSameOriginMutation({ method: "POST", originHeader: "null", host })).toBe(
      false
    );
    expect(
      isSameOriginMutation({ method: "GET", originHeader: "https://evil.example", host })
    ).toBe(true);
  });
});
