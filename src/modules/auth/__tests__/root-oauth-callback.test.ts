import { describe, expect, it } from "vitest";
import { buildRootOAuthCallbackRedirect } from "../root-oauth-callback";

describe("root OAuth callback fallback", () => {
  it("forwards a root authorization code to the callback route", () => {
    expect(
      buildRootOAuthCallbackRedirect({
        code: "fcee4959-defb-4b38-adef-a18e4a2411f0",
      })
    ).toBe(
      "/auth/callback?code=fcee4959-defb-4b38-adef-a18e4a2411f0&next=%2Fdashboard"
    );
  });

  it("preserves a safe intended destination and invitation token", () => {
    expect(
      buildRootOAuthCallbackRedirect({
        code: "diagnostic-code-12345678",
        next: "/onboarding?token=valid_invitation_token_123",
      })
    ).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fonboarding%3Ftoken%3Dvalid_invitation_token_123"
    );
  });

  it("uses an invitation token if the Site URL callback lost the next parameter", () => {
    expect(
      buildRootOAuthCallbackRedirect({
        code: "diagnostic-code-12345678",
        invite_token: "valid_invitation_token_123",
      })
    ).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fonboarding%3Ftoken%3Dvalid_invitation_token_123"
    );
  });

  it("forwards provider errors to the standard callback error handler", () => {
    expect(
      buildRootOAuthCallbackRedirect({
        error: "access_denied",
        error_code: "provider_error",
        error_description: "ignored",
      })
    ).toBe(
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
    expect(buildRootOAuthCallbackRedirect({code:"invalid\ncode"})).toBeNull();
  });

  it("sanitizes external next destinations", () => {
    expect(
      buildRootOAuthCallbackRedirect({
        code: "diagnostic-code-12345678",
        next: "//attacker.example",
      })
    ).toBe(
      "/auth/callback?code=diagnostic-code-12345678&next=%2Fdashboard"
    );
  });
});
