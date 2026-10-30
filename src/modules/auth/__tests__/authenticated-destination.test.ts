import { describe, expect, it } from "vitest";
import { resolveAuthenticatedDestination } from "../authenticated-destination";

describe("authenticated destination", () => {
  it("defaults existing login sessions to the dashboard", () => {
    const destination = resolveAuthenticatedDestination(
      "/login",
      new URLSearchParams()
    );

    expect(destination).toBe("/dashboard");
  });

  it("defaults new signup sessions to onboarding", () => {
    const destination = resolveAuthenticatedDestination(
      "/signup",
      new URLSearchParams()
    );

    expect(destination).toBe("/onboarding");
  });

  it("preserves a safe requested destination", () => {
    const params = new URLSearchParams("next=%2Ftrips%3Fstatus%3Dapproved");
    const destination = resolveAuthenticatedDestination("/login", params);

    expect(destination).toBe("/trips?status=approved");
  });

  it("preserves a valid invitation when routing to onboarding", () => {
    const params = new URLSearchParams("invite_token=sample_invitation_token_123");
    const destination = resolveAuthenticatedDestination("/signup", params);

    expect(destination).toBe("/onboarding?token=sample_invitation_token_123");
  });

  it("does not route authenticated users back to the homepage or auth forms", () => {
    const homeDestination = resolveAuthenticatedDestination(
      "/login",
      new URLSearchParams("next=%2F")
    );
    const signupDestination = resolveAuthenticatedDestination(
      "/login",
      new URLSearchParams("next=%2Fsignup")
    );

    expect(homeDestination).toBe("/dashboard");
    expect(signupDestination).toBe("/dashboard");
  });

  it("ignores malformed invitation tokens", () => {
    const destination = resolveAuthenticatedDestination(
      "/signup",
      new URLSearchParams("invite_token=not-valid-token")
    );

    expect(destination).toBe("/onboarding");
  });
});
