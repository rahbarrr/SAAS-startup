import { describe, expect, it } from "vitest";
import { resolveAuthenticatedDestination } from "../authenticated-destination";

describe("post-auth destination", () => {
  it("routes login to the workspace dashboard", () => {
    const destination = resolveAuthenticatedDestination("/login", new URLSearchParams());
    expect(destination).toBe("/dashboard");
  });

  it("routes new signups to onboarding", () => {
    const destination = resolveAuthenticatedDestination("/signup", new URLSearchParams());
    expect(destination).toBe("/onboarding");
  });

  it("preserves invitation tokens", () => {
    const params = new URLSearchParams("invite_token=sample_invitation_token_123");
    const destination = resolveAuthenticatedDestination("/signup", params);
    expect(destination).toBe("/onboarding?token=sample_invitation_token_123");
  });

  it("preserves safe next paths", () => {
    const params = new URLSearchParams("next=%2Ftrips");
    const destination = resolveAuthenticatedDestination("/login", params);
    expect(destination).toBe("/trips");
  });
});
