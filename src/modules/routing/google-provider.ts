import "server-only";

import {
  type DistanceMeasurementType,
  type LatLng,
  ROAD_NETWORK_DISCLAIMER,
} from "./domain";
import type { DistanceCalculationResult, RouteDistanceProvider } from "./provider";

export interface GoogleRoutesProviderOptions {
  apiKey?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  fetchFn?: typeof fetch;
}

export const MAX_GOOGLE_ROUTE_STOPS = 25;

interface GoogleRoutesApiResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string; // e.g. "1500s"
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Server-only Google Routes API provider querying directions v2 computeRoutes.
 * Computes road-network driving distance and travel duration.
 * Implements in-memory caching and request timeouts to protect quotas.
 */
export class GoogleRoutesDistanceProvider implements RouteDistanceProvider {
  readonly providerName = "google";
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<
    string,
    { result: DistanceCalculationResult; timestamp: number }
  >();

  constructor(options?: GoogleRoutesProviderOptions) {
    const rawKey =
      options?.apiKey ||
      (typeof process !== "undefined"
        ? process.env.GOOGLE_MAPS_ROUTES_API_KEY
        : undefined);

    this.apiKey = rawKey?.trim() ?? "";
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.cacheTtlMs = options?.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour
    this.fetchFn =
      options?.fetchFn ??
      (typeof fetch !== "undefined"
        ? fetch.bind(globalThis)
        : (fetch as unknown as typeof fetch));
  }

  async calculateDistance(from: LatLng, to: LatLng): Promise<DistanceCalculationResult> {
    if (!this.apiKey) {
      throw new Error(
        "Google Routes API key is not configured (missing GOOGLE_MAPS_ROUTES_API_KEY)."
      );
    }

    const cacheKey = `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}->${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.result;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

      const response = await this.fetchFn(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: from.latitude,
                longitude: from.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: to.latitude,
                longitude: to.longitude,
              },
            },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Google Routes API quota exceeded (HTTP 429 Rate Limited)");
        }
        if (response.status === 403) {
          throw new Error(
            "Google Routes API forbidden: verify key restrictions and billing"
          );
        }
        let detail = response.statusText;
        try {
          const errData = (await response.json()) as GoogleRoutesApiResponse;
          if (errData.error?.message) {
            detail = errData.error.message;
          }
        } catch {
          // ignore json parse failure on error body
        }
        throw new Error(
          `Google Routes API failed with HTTP ${response.status}: ${detail}`
        );
      }

      const data = (await response.json()) as GoogleRoutesApiResponse;

      if (!data.routes || data.routes.length === 0 || !data.routes[0]) {
        throw new Error("Google Routes API returned no drivable route between stops");
      }

      const route = data.routes[0];
      const distanceMeters = Math.round(route.distanceMeters ?? 0);

      // Duration string is formatted like "1234s"
      let seconds = 0;
      if (route.duration) {
        const parsedSec = parseInt(route.duration.replace(/[^0-9]/g, ""), 10);
        if (!Number.isNaN(parsedSec)) {
          seconds = parsedSec;
        }
      }
      const durationMinutes = Math.max(1, Math.round(seconds / 60));

      const result: DistanceCalculationResult = {
        distanceMeters,
        durationMinutes,
        distanceType: "road_network_driving" as DistanceMeasurementType,
        providerName: "google",
        disclaimer: `${ROAD_NETWORK_DISCLAIMER} (Google Routes API: road-network driving)`,
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
