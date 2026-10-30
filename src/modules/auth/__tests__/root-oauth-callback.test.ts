import { describe, expect, it } from "vitest";
import { buildRootOAuthCallbackRedirect } from "../root-oauth-callback";

describe("root OAuth callback fallback", () => {
  it("forwards a root authorization code to the callback route", () => {
    const redirectPath = buildRootOAuthCallbackRedirect({
      code: "fcee4959-defb-4b38-adef-a18e4a2411f0",
    });

    expect(redirectPath).toBe(
      "/auth/callback?code=fcee4959-defb-4b38-adef-a18e4a2411f0&next=%2Fdashboard"
    );
  });

  it("preserves a safe intended destination and invitation token", () => {
    const redirectPath = buildRootOAuthCallbackRedirect({
      code: "diagnostic-code-12345678",
      next: "/onboarding?token=valid_invitation_token_123",
    });

    expect(redirectPath).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fonboarding%3Ftoken%3Dvalid_invitation_token_123"
    );
  });

  it("uses an invitation token if the Site URL callback lost the next parameter", () => {
    const redirectPath = buildRootOAuthCallbackRedirect({
      code: "diagnostic-code-12345678",
      invite_token: "valid_invitation_token_123",
    });

    expect(redirectPath).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fonboarding%3Ftoken%3Dvalid_invitation_token_123"
    );
  });

  it("forwards provider errors to the standard callback error handler", () => {
    const redirectPath = buildRootOAuthCallbackRedirect({
      error: "access_denied",
      error_code: "provider_error",
      error_description: "ignored",
    });

    expect(redirectPath).toBe(
      "/auth/callback?error=access_denied&error_code=provider_error&next=%2Fdashboard"
    );
  });

  it("ignores ordinary homepage requests without OAuth parameters", () => {
    expect(buildRootOAuthCallbackRedirect({ utm_source: "pilot" })).toBeNull();
  });

  it("rejects oversized or control-character authorization codes", () => {
    expect(
      buildRootOAuthCallbackRedirect({ code: "a".repeat(4097) })
    ).toBeNull();
    expect(
      buildRootOAuthCallbackRedirect({ code: "invalid\\ncode" })
    ).toBeNull();
  });

  it("sanitizes external next destinations", () => {
    const redirectPath = buildRootOAuthCallbackRedirect({
      code: "diagnostic-code-12345678",
      next: "//attacker.example",
    });

    expect(redirectPath).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fdashboard"
    );
  });
});
