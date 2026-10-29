import { describe, expect, it } from "vitest";
import {
  createAuthCallbackUrl,
  getCanonicalProductionRedirectUrl,
} from "@/modules/auth/callback-url";

describe("OAuth callback URL", () => {
  it("redirects production deployment URLs to the canonical origin and preserves query state", () => {
    const redirectUrl = getCanonicalProductionRedirectUrl(
      "https://saas-startup1.vercel.app",
      "https://saas-startup1-random-rahbar1.vercel.app/signup?token=invite-token#form",
      "production"
    );

    expect(redirectUrl?.origin).toBe("https://saas-startup1.vercel.app");
    expect(redirectUrl?.pathname).toBe("/signup");
    expect(redirectUrl?.searchParams.get("token")).toBe("invite-token");
    expect(redirectUrl?.hash).toBe("#form");
  });

  it("does not redirect when already on the canonical production origin", () => {
    expect(
      getCanonicalProductionRedirectUrl(
        "https://saas-startup1.vercel.app",
        "https://saas-startup1.vercel.app/login",
        "production"
      )
    ).toBeNull();
  });

  it("does not canonicalize a Preview deployment", () => {
    expect(
      getCanonicalProductionRedirectUrl(
        "https://saas-startup1.vercel.app",
        "https://saas-startup1-git-feature-rahbar1.vercel.app/login",
        "preview"
      )
    ).toBeNull();
  });

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
