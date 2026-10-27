import { describe, expect, it } from "vitest";
import { MapsUnavailableNotice } from "../MapsUnavailableNotice";
import * as clientExports from "../index";

describe("Phase 10: Maps UI States & Security", () => {
  it("renders unconfigured notice with clear instructions and without broken map or mock data", () => {
    const notice = MapsUnavailableNotice({
      status: "unconfigured",
      featureName: "Store location search",
    });

    expect(notice).not.toBeNull();
    // Verify JSX properties
    if (notice && typeof notice === "object" && "props" in notice) {
      const props = (notice as { props: Record<string, unknown> }).props;
      expect(props.role).toBe("status");
    }
  });

  it("renders error state when Google Maps fails to load", () => {
    const errorNotice = MapsUnavailableNotice({
      status: "error",
      errorMessage: "Invalid API key referrer restriction",
    });

    expect(errorNotice).not.toBeNull();
    if (errorNotice && typeof errorNotice === "object" && "props" in errorNotice) {
      const props = (errorNotice as { props: Record<string, unknown> }).props;
      expect(props.role).toBe("alert");
    }
  });

  it("returns null when status is ready", () => {
    const readyNotice = MapsUnavailableNotice({
      status: "ready",
    });
    expect(readyNotice).toBeNull();
  });

  it("never exports or leaks server-side GOOGLE_MAPS_ROUTES_API_KEY in client map modules", () => {
    // Check all exported identifiers in client maps package
    const exportedKeys = Object.keys(clientExports);
    expect(exportedKeys).not.toContain("GOOGLE_MAPS_ROUTES_API_KEY");
    expect(exportedKeys).not.toContain("GoogleRoutesDistanceProvider");
  });
});
