import { describe, expect, it } from "vitest";
import {
  createAuthCallbackFailureUrl,
  getAuthCallbackErrorMessage,
} from "@/modules/auth/callback-error";

describe("authentication callback errors", () => {
  it("returns no message when the callback has no error", () => {
    expect(getAuthCallbackErrorMessage(null)).toBeNull();
  });

  it("explains an expired or invalid verification link", () => {
    expect(getAuthCallbackErrorMessage("Unable to verify authentication link")).toContain(
      "may have expired"
    );
  });

  it("does not reflect arbitrary provider error text", () => {
    expect(getAuthCallbackErrorMessage("<script>alert(1)</script>")).toBe(
      "Sign-in could not be completed. Please try again or use email sign-in."
    );
  });

  it("preserves safe invitation destinations for a sign-in retry", () => {
    const url = createAuthCallbackFailureUrl(
      "https://saas-startup1.vercel.app",
      "/onboarding?token=sample-invite-token"
    );

    expect(url.origin).toBe("https://saas-startup1.vercel.app");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/onboarding?token=sample-invite-token");
  });

  it("sanitizes unsafe callback retry destinations", () => {
    const url = createAuthCallbackFailureUrl(
      "https://saas-startup1.vercel.app",
      "//attacker.example"
    );

    expect(url.searchParams.get("next")).toBe("/onboarding");
  });
});
