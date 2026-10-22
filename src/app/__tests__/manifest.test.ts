import { describe, expect, it } from "vitest";
import manifest from "../manifest";

describe("Web App Manifest", () => {
  it("returns standard standalone PWA manifest configuration", () => {
    const config = manifest();
    expect(config.name).toBe("FieldTrack Field Operations");
    expect(config.short_name).toBe("FieldTrack");
    expect(config.display).toBe("standalone");
    expect(config.start_url).toBe("/");
    expect(config.theme_color).toBe("#2563eb");
    expect(config.icons).toBeDefined();
    expect(config.icons?.length).toBeGreaterThanOrEqual(2);

    const maskable = config.icons?.find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
  });
});
