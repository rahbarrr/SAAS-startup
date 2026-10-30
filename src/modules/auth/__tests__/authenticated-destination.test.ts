import { describe, expect, it } from "vitest";
import { resolveAuthenticatedDestination } from "@/modules/auth/authenticated-destination";

describe("authenticated destination", () => {
  it("sends an authenticated login user to the workspace by default", () => {
    expect(resolveAuthenticatedDestination("/login", new URLSearchParams())).toBe(
      "/dashboard"
    );
  });

  it("sends a newly authenticated signup user to onboarding by default", () => {
    expect(resolveAuthenticatedDestination("/signup", new URLSearchParams())).toBe(
      "/onboarding"
    );
  });

  it("preserves a safe requested destination", () => {
    const params = new URLSearchParams("next=%2Ftrips%3Fstatus%3Dapproved");

    expect(resolveAuthenticatedDestination("/login", params)).toBe(
      "/trips?status=approved"
    );
  });

  it("sends invitation signups to onboarding and preserves the invitation token", () => {
    const params = new URLSearchParams("invite_token=sample_invitation_token_123");

    expect(resolveAuthenticatedDestination("/signup", params)).toBe(
      "/onboarding?token=sample_invitation_token_123"
    );
  });

  it("does not send an authenticated user back to the landing page or auth form", () => {
    expect(
      resolveAuthenticatedDestination(
        "/login",
        new URLSearchParams("next=%2F")
      )
    ).toBe("/dashboard");
    expect(
      resolveAuthenticatedDestination(
        "/login",
        new URLSearchParams("next=%2Fsignup")
      )
    ).toBe("/dashboard");
  });

  it("does not trust malformed invitation tokens", () => {
    expect(
      resolveAuthenticatedDestination(
        "/signup",
        new URLSearchParams("invite_token=not-valid-token")
      )
    ).toBe("/onboarding");
  });
});
