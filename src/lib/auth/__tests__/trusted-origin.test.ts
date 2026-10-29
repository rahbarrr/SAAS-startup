import { describe, expect, it } from "vitest";
import { resolveTrustedAppOrigin } from "@/lib/auth/trusted-origin";

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

  it("uses the configured canonical origin for Production", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "production",
        VERCEL_URL: "fieldtrack-git-fix-example.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toEqual({ origin: "https://saas-startup1.vercel.app", error: null });
  });

  it("rejects a forged or malformed deployment origin", () => {
    expect(
      resolveTrustedAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "attacker.example.com",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      }).origin
    ).toBeNull();

    expect(
      resolveTrustedAppOrigin({
        NEXT_PUBLIC_APP_URL: "https://user:password@example.com/path",
      }).origin
    ).toBeNull();
  });
});
