/**
 * FieldTrack Phase 5 — Multi-Stop Route Optimization Domain Types.
 *
 * Defines candidate stop structures, routing legs, optimization proposals,
 * distance measurement models, and transparent disclaimer labels.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type DistanceMeasurementType = "straight_line_haversine" | "road_network_driving";

export const HAVERSINE_DISCLAIMER =
  "Distance and duration are calculated as a straight-line (geodesic haversine) estimate. Actual road geometry, one-way streets, terrain, and traffic conditions are not included.";

export const ROAD_NETWORK_DISCLAIMER =
  "Distance and duration are calculated using an external road-network routing provider.";

export interface RouteStopCandidate {
  id: string; // trip stop ID or sequence identifier
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  region: string;
  coordinates: LatLng | null;
  sequenceNumber: number;
  priority?: number; // 1 = high, 2 = standard, 3 = low
  plannedWindow?: {
    start?: string | null;
    end?: string | null;
  } | null;
  expectedDurationMinutes?: number;
  mandatory?: boolean;
}

export interface RouteLeg {
  fromStopId: string;
  toStopId: string;
  fromStoreName: string;
  toStoreName: string;
  distanceMeters: number;
  durationMinutes: number;
}

export interface RouteOptimizationProposal {
  tripId?: string;
  originalOrder: RouteStopCandidate[];
  proposedOrder: RouteStopCandidate[];
  originalDistanceMeters: number;
  proposedDistanceMeters: number;
  distanceSavingsMeters: number;
  percentageSavings: number;
  distanceType: DistanceMeasurementType;
  providerName: string;
  distanceDisclaimer: string;
  estimatedTotalTransitMinutes: number;
  legs: RouteLeg[];
  explanation: string;
  stopsMissingCoordinates: string[];
}
