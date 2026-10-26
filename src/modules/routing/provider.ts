/**
 * FieldTrack Phase 5 — Route Distance Provider Abstraction.
 *
 * Implements geodesic haversine calculation as the transparent default,
 * with clear disclaimers that straight-line distance does not equate to
 * actual driving route distance. Allows external road-network providers
 * (e.g., OSRM, Mapbox, Google Routes) to be plugged in if configured.
 */

import {
  type DistanceMeasurementType,
  HAVERSINE_DISCLAIMER,
  type LatLng,
  ROAD_NETWORK_DISCLAIMER,
} from "./domain";

export interface DistanceCalculationResult {
  distanceMeters: number;
  durationMinutes: number;
  distanceType: DistanceMeasurementType;
  providerName: string;
  disclaimer: string;
}

export interface RouteDistanceProvider {
  readonly providerName: string;
  calculateDistance(from: LatLng, to: LatLng): Promise<DistanceCalculationResult>;
}

const EARTH_RADIUS_METERS = 6_371_000;
const ASSUMED_URBAN_SPEED_KMH = 35; // ~583 meters per minute average field travel

/**
 * Calculates the great-circle geodesic distance between two points on Earth using Haversine formula.
 */
export function calculateHaversineMeters(from: LatLng, to: LatLng): number {
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const lat1Rad = (from.latitude * Math.PI) / 180;
  const lat2Rad = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Default provider using geodesic Haversine mathematics.
 * Strictly labels its output as "straight_line_haversine".
 */
export class HaversineDistanceProvider implements RouteDistanceProvider {
  readonly providerName = "haversine";

  async calculateDistance(from: LatLng, to: LatLng): Promise<DistanceCalculationResult> {
    const distanceMeters = calculateHaversineMeters(from, to);
    // Rough heuristic estimate for duration in minutes: (meters / (speed in meters/minute))
    const metersPerMinute = (ASSUMED_URBAN_SPEED_KMH * 1000) / 60;
    const durationMinutes = Math.max(1, Math.round(distanceMeters / metersPerMinute));

    return {
      distanceMeters,
      durationMinutes,
      distanceType: "straight_line_haversine",
      providerName: "haversine",
      disclaimer: HAVERSINE_DISCLAIMER,
    };
  }
}

export interface OsrmRoadNetworkProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Real road-network provider querying OpenStreetMap routing service (OSRM).
 * Computes turn-by-turn driving distance and duration along actual road geometry.
 * Protects against API degradation with in-memory caching and request timeouts.
 */
export class OsrmRoadNetworkProvider implements RouteDistanceProvider {
  readonly providerName = "osrm";
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<
    string,
    { result: DistanceCalculationResult; timestamp: number }
  >();
  private readonly cacheTtlMs: number = 60 * 60 * 1000; // 1 hour

  constructor(options?: OsrmRoadNetworkProviderOptions) {
    const rawUrl =
      options?.baseUrl ||
      (typeof process !== "undefined" ? process.env.OSRM_BASE_URL : undefined) ||
      "https://router.project-osrm.org";
    this.baseUrl = rawUrl.replace(/\/+$/, "");
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.fetchFn =
      options?.fetchFn ??
      (typeof fetch !== "undefined"
        ? fetch.bind(globalThis)
        : (fetch as unknown as typeof fetch));
  }

  async calculateDistance(from: LatLng, to: LatLng): Promise<DistanceCalculationResult> {
    const cacheKey = `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}->${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.result;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // OSRM requires {longitude},{latitude};{longitude},{latitude}
      const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
      const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=false`;

      const response = await this.fetchFn(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `OSRM routing failed with HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number }>;
      };

      if (
        data.code !== "Ok" ||
        !data.routes ||
        data.routes.length === 0 ||
        !data.routes[0]
      ) {
        throw new Error(`OSRM routing returned invalid code '${data.code ?? "UNKNOWN"}'`);
      }

      const route = data.routes[0];
      const distanceMeters = Math.round(route.distance);
      const durationMinutes = Math.max(1, Math.round(route.duration / 60));

      const result: DistanceCalculationResult = {
        distanceMeters,
        durationMinutes,
        distanceType: "road_network_driving",
        providerName: "osrm",
        disclaimer: ROAD_NETWORK_DISCLAIMER,
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

/**
 * Resilient wrapper that attempts road-network routing first, falling back to straight-line
 * Haversine calculation if the network provider times out, fails, or is rate-limited.
 */
export class ResilientRoadRoutingProvider implements RouteDistanceProvider {
  readonly providerName: string;
  private readonly primary: RouteDistanceProvider;
  private readonly fallback: RouteDistanceProvider;

  constructor(primary: RouteDistanceProvider, fallback?: RouteDistanceProvider) {
    this.primary = primary;
    this.fallback = fallback ?? new HaversineDistanceProvider();
    this.providerName = primary.providerName;
  }

  async calculateDistance(from: LatLng, to: LatLng): Promise<DistanceCalculationResult> {
    try {
      return await this.primary.calculateDistance(from, to);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[RouteDistanceProvider] Primary router '${this.primary.providerName}' failed: ${errorMsg}. Falling back to straight-line Haversine.`
      );
      const fallbackResult = await this.fallback.calculateDistance(from, to);
      return {
        ...fallbackResult,
        disclaimer: `${HAVERSINE_DISCLAIMER} (Notice: Road router '${this.primary.providerName}' was temporarily unavailable: ${errorMsg}. Straight-line fallback used.)`,
      };
    }
  }
}

/**
 * Resolves the appropriate distance provider based on environment configuration.
 * Retains Haversine straight-line calculation if no provider is configured.
 */
export function resolveRouteDistanceProvider(): RouteDistanceProvider {
  const providerType =
    typeof process !== "undefined"
      ? process.env.ROUTING_PROVIDER?.toLowerCase()?.trim()
      : undefined;

  if (providerType === "osrm") {
    const osrm = new OsrmRoadNetworkProvider();
    return new ResilientRoadRoutingProvider(osrm);
  }

  return new HaversineDistanceProvider();
}
