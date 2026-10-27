import { describe, expect, it } from "vitest";
import { createStoreInputSchema, updateStoreInputSchema } from "../schemas";

describe("Phase 10: Store Location Coordinates and Validation", () => {
  const baseStore = {
    name: "Flagship Retailer #402",
    region: "Pacific Northwest",
    addressLine1: "123 Market Street",
    city: "Seattle",
    stateProvince: "WA",
    postalCode: "98101",
    countryCode: "US",
  };

  it("validates store with valid latitude and longitude coordinates", () => {
    const valid = createStoreInputSchema.safeParse({
      ...baseStore,
      latitude: 47.6062,
      longitude: -122.3321,
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.latitude).toBe(47.6062);
      expect(valid.data.longitude).toBe(-122.3321);
      expect(valid.data.countryCode).toBe("US");
    }
  });

  it("allows omitting both latitude and longitude (unresolved coordinates)", () => {
    const valid = createStoreInputSchema.safeParse({
      ...baseStore,
      latitude: null,
      longitude: null,
    });

    expect(valid.success).toBe(true);
  });

  it("rejects when latitude is provided but longitude is omitted", () => {
    const invalid = createStoreInputSchema.safeParse({
      ...baseStore,
      latitude: 47.6062,
      longitude: null,
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain(
        "Latitude and longitude must both be provided together"
      );
    }
  });

  it("rejects coordinates outside valid geographic ranges", () => {
    const invalidLat = createStoreInputSchema.safeParse({
      ...baseStore,
      latitude: 95.0, // > 90
      longitude: -122.3321,
    });
    expect(invalidLat.success).toBe(false);

    const invalidLng = createStoreInputSchema.safeParse({
      ...baseStore,
      latitude: 47.6062,
      longitude: 185.0, // > 180
    });
    expect(invalidLng.success).toBe(false);
  });

  it("supports international country codes dynamically rather than hardcoding US", () => {
    const canadaStore = createStoreInputSchema.safeParse({
      ...baseStore,
      countryCode: "CA",
      city: "Vancouver",
      stateProvince: "BC",
      postalCode: "V6B 1A1",
      latitude: 49.2827,
      longitude: -123.1207,
    });

    expect(canadaStore.success).toBe(true);
    if (canadaStore.success) {
      expect(canadaStore.data.countryCode).toBe("CA");
    }

    const ukStore = updateStoreInputSchema.safeParse({
      countryCode: "GB",
    });
    expect(ukStore.success).toBe(true);
    if (ukStore.success) {
      expect(ukStore.data.countryCode).toBe("GB");
    }
  });

  it("rejects invalid country codes that are not 2-letter ISO codes", () => {
    const invalidCountry = createStoreInputSchema.safeParse({
      ...baseStore,
      countryCode: "USA", // 3 letters
    });

    expect(invalidCountry.success).toBe(false);
  });
});
