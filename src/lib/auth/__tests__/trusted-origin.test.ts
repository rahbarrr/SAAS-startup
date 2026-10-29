import { describe, expect, it } from "vitest";
import { resolveAuthAppOrigin, resolveTrustedAppOrigin } from "@/lib/auth/trusted-origin";

describe("trusted application origin resolution", () => {
  it("uses the exact Vercel deployment hostname for Preview", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toEqual({
      origin: "https://fieldtrack-git-fix-example.vercel.app",
      error: null,
    });
  });

  it("uses the exact Vercel deployment hostname as the Preview fallback", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
      })
    ).toEqual({
      origin: "https://fieldtrack-git-fix-example.vercel.app",
      error: null,
    });
  });

  it("keeps Preview authentication callbacks on the explicitly configured app host", () => {
    expect(
      resolveAuthAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://fieldtrack-preview.example.com",
      })
    ).toEqual({ origin: "https://fieldtrack-preview.example.com", error: null });
  });

  it("uses the deployment hostname for Preview authentication when no app URL is set", () => {
    expect(
      resolveAuthAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
      })
    ).toEqual({
      origin: "https://fieldtrack-git-fix-example.vercel.app",
      error: null,
    });
  });

  it("fails closed for a malformed explicit Preview authentication host", () => {
    expect(
      resolveAuthAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://fieldtrack-preview.example.com/path",
      }).origin
    ).toBeNull();
  });

  it("uses the configured canonical origin for Production", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "production",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toEqual({ origin: "https://saas-startup1.vercel.app", error: null });
  });

  it("checks Production callback origin against Vercel's project production domain", () => {
    expect(
      resolveAuthAppOrigin({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "saas-startup1.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toEqual({ origin: "https://saas-startup1.vercel.app", error: null });
    expect(
      resolveAuthAppOrigin({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "saas-startup1.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://other-project.vercel.app",
      }).origin
    ).toBeNull();
  });

  it("rejects a forged or malformed deployment origin", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "attacker.example.com",
      }).origin
    ).toBeNull();

    expect(
      resolveTrustedAppOrigin({
        NEXT_PUBLIC_APP_URL: "https://user:password@example.com/path",
      }).origin
    ).toBeNull();
  });
});
