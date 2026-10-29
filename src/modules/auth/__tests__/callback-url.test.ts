import { describe, expect, it } from "vitest";
import { createAuthCallbackUrl } from "@/modules/auth/callback-url";

describe("OAuth callback URL", () => {
  it("uses the configured app host so callback cookies stay on the canonical origin", () => {
    const callbackUrl = createAuthCallbackUrl(
      "https://fieldtrack-preview.example.com",
      "https://fieldtrack-git-feature.vercel.app",
      "/onboarding?token=invite-token"
    );

    expect(callbackUrl.origin).toBe("https://fieldtrack-preview.example.com");
    expect(callbackUrl.pathname).toBe("/auth/callback");
    expect(callbackUrl.searchParams.get("next")).toBe("/onboarding?token=invite-token");
  });

  it("falls back to the current origin when no app URL is configured", () => {
    const callbackUrl = createAuthCallbackUrl(
      undefined,
      "https://fieldtrack-git-feature.vercel.app",
      "/dashboard"
    );

    expect(callbackUrl.origin).toBe("https://fieldtrack-git-feature.vercel.app");
    expect(callbackUrl.searchParams.get("next")).toBe("/dashboard");
  });
});
