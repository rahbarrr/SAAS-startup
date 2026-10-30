import { describe, expect, it } from "vitest";
import { getCanonicalProductionRedirectUrl } from "./callback-url";

describe("getCanonicalProductionRedirectUrl", () => {
  it("redirects Production auth entry URLs to the configured canonical origin", () => {
    const result = getCanonicalProductionRedirectUrl(
      "https://saas-startup1.vercel.app",
      "https://saas-startup1-rahbar1.vercel.app/login?next=%2Fdashboard#form",
      "production"
    );

    expect(result?.toString()).toBe(
      "https://saas-startup1.vercel.app/login?next=%2Fdashboard#form"
    );
  });

  it("does not redirect when already on the canonical Production origin", () => {
    const result = getCanonicalProductionRedirectUrl(
      "https://saas-startup1.vercel.app",
      "https://saas-startup1.vercel.app/login",
      "production"
    );

    expect(result).toBeNull();
  });

  it("does not rewrite Preview or local development origins", () => {
    expect(
      getCanonicalProductionRedirectUrl(
        "https://saas-startup1.vercel.app",
        "https://saas-startup1-git-feature-rahbar1.vercel.app/login",
        "preview"
      )
    ).toBeNull();

    expect(
      getCanonicalProductionRedirectUrl(
        "https://saas-startup1.vercel.app",
        "http://localhost:3000/login",
        "development"
      )
    ).toBeNull();
  });

  it("rejects an invalid configured Production origin", () => {
    expect(() =>
      getCanonicalProductionRedirectUrl(
        "javascript:alert(1)",
        "https://saas-startup1-rahbar1.vercel.app/login",
        "production"
      )
    ).toThrow("NEXT_PUBLIC_APP_URL must be a valid application origin. Check the deployment URL configuration.");
  });
});
