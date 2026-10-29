import { describe, expect, it } from "vitest";
import { createAuthCallbackUrl } from "@/modules/auth/callback-url";

describe("OAuth callback URL", () => {
  it("rejects switching hosts after the sign-in page has created the OAuth flow", () => {
    expect(() =>
      createAuthCallbackUrl(
        "https://fieldtrack-preview.example.com",
        "https://fieldtrack-git-feature.vercel.app",
        "/onboarding?token=invite-token"
      )
    ).toThrow("does not match this page");
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

  it("uses the Vercel Production project domain and rejects a deployment-specific host", () => {
    expect(() =>
      createAuthCallbackUrl(
        "https://saas-startup1.vercel.app",
        "https://saas-startup1-git-fix.vercel.app",
        "/dashboard",
        {
          vercelEnvironment: "production",
          vercelProjectProductionUrl: "saas-startup1.vercel.app",
        }
      )
    ).toThrow("public Production URL");
  });

  it("uses the canonical Production domain and sanitizes the next path", () => {
    const callbackUrl = createAuthCallbackUrl(
      "https://saas-startup1.vercel.app",
      "https://saas-startup1.vercel.app",
      "//evil.example/path",
      {
        vercelEnvironment: "production",
        vercelProjectProductionUrl: "saas-startup1.vercel.app",
      }
    );
    expect(callbackUrl.origin).toBe("https://saas-startup1.vercel.app");
    expect(callbackUrl.searchParams.get("next")).toBe("/onboarding");
  });

  it("prefers the configured public Production URL when Vercel reports another production alias", () => {
    const callbackUrl = createAuthCallbackUrl(
      "https://saas-startup1.vercel.app",
      "https://saas-startup1.vercel.app",
      "/login",
      {
        vercelEnvironment: "production",
        vercelProjectProductionUrl: "saas-startup1-rahbar1.vercel.app",
      }
    );

    expect(callbackUrl.origin).toBe("https://saas-startup1.vercel.app");
    expect(callbackUrl.pathname).toBe("/auth/callback");
  });
});
