/**
 * FieldTrack Phase 5 — Multi-Stop Route Optimizer.
 *
 * Implements a practical Traveling Salesperson Problem (TSP) heuristic:
 * 1. Nearest-Neighbor Tour Construction: greedily builds an initial feasible route
 *    from starting point / first stop, honoring priority and time window constraints.
 * 2. 2-Opt Local Search: iteratively tests and reverses sub-paths to untangle route
 *    crossings and minimize total transit distance.
 *
 * Fails safely when stops lack coordinates or when external providers are unconfigured.
 */

import {
  type DistanceMeasurementType,
  HAVERSINE_DISCLAIMER,
  type LatLng,
  type RouteLeg,
  type RouteOptimizationProposal,
  type RouteStopCandidate,
} from "./domain";
import {
  calculateHaversineMeters,
  HaversineDistanceProvider,
  type RouteDistanceProvider,
} from "./provider";

export interface OptimizeRouteOptions {
  stops: RouteStopCandidate[];
  startLocation?: LatLng | null;
  preserveFirstStop?: boolean;
  distanceProvider?: RouteDistanceProvider;
  tripId?: string;
}

/**
 * Calculates total route distance and produces detailed leg summaries for a sequence of stops.
 */
async function computeRouteLegs(
  stops: RouteStopCandidate[],
  provider: RouteDistanceProvider
): Promise<{
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  legs: RouteLeg[];
  distanceType: DistanceMeasurementType;
  providerName: string;
  disclaimer: string;
}> {
  if (stops.length <= 1) {
    return {
      totalDistanceMeters: 0,
      totalDurationMinutes: 0,
      legs: [],
      distanceType: "straight_line_haversine",
      providerName: provider.providerName,
      disclaimer: HAVERSINE_DISCLAIMER,
    };
  }

  let totalDistanceMeters = 0;
  let totalDurationMinutes = 0;
  const legs: RouteLeg[] = [];
  let distanceType: DistanceMeasurementType = "straight_line_haversine";
  let disclaimer = HAVERSINE_DISCLAIMER;

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];

    if (!from || !to) continue;

    if (from.coordinates && to.coordinates) {
      const legResult = await provider.calculateDistance(
        from.coordinates,
        to.coordinates
      );
      totalDistanceMeters += legResult.distanceMeters;
      totalDurationMinutes += legResult.durationMinutes;
      distanceType = legResult.distanceType;
      disclaimer = legResult.disclaimer;

      legs.push({
        fromStopId: from.id,
        toStopId: to.id,
        fromStoreName: from.storeName,
        toStoreName: to.storeName,
        distanceMeters: legResult.distanceMeters,
        durationMinutes: legResult.durationMinutes,
      });
    } else {
      legs.push({
        fromStopId: from.id,
        toStopId: to.id,
        fromStoreName: from.storeName,
        toStoreName: to.storeName,
        distanceMeters: 0,
        durationMinutes: 0,
      });
    }
  }

  return {
    totalDistanceMeters,
    totalDurationMinutes,
    legs,
    distanceType,
    providerName: provider.providerName,
    disclaimer,
  };
}

/**
 * Evaluates route distance synchronously using direct haversine distance for rapid 2-opt iterations.
 */
function evaluateTourDistance(stops: RouteStopCandidate[]): number {
  let dist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i]?.coordinates;
    const to = stops[i + 1]?.coordinates;
    if (from && to) {
      dist += calculateHaversineMeters(from, to);
    }
  }
  return dist;
}

/**
 * Checks if a tour respects time-window and priority constraints.
 * Stops with higher priority (lower priority number) or earlier time windows
 * should generally appear before lower priority ones where feasible.
 */
function satisfiesConstraints(tour: RouteStopCandidate[]): boolean {
  for (let i = 0; i < tour.length - 1; i++) {
    const a = tour[i];
    const b = tour[i + 1];
    if (!a || !b) continue;

    // Hard violation: if stop 'b' has an earlier strict end window than 'a' start window
    if (a.plannedWindow?.start && b.plannedWindow?.end) {
      if (a.plannedWindow.start > b.plannedWindow.end) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 2-Opt local improvement: systematically tests 2-edge swaps and reverses the segment
 * if it reduces total tour distance without violating hard constraints.
 */
function runTwoOptOptimization(
  initialTour: RouteStopCandidate[],
  fixedStartIndex: number
): RouteStopCandidate[] {
  let bestTour = [...initialTour];
  let bestDistance = evaluateTourDistance(bestTour);
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = fixedStartIndex; i < bestTour.length - 1; i++) {
      for (let k = i + 1; k < bestTour.length; k++) {
        // Reverse subsegment from i to k
        const candidateTour = [
          ...bestTour.slice(0, i),
          ...bestTour.slice(i, k + 1).reverse(),
          ...bestTour.slice(k + 1),
        ];

        if (!satisfiesConstraints(candidateTour)) {
          continue;
        }

        const candidateDistance = evaluateTourDistance(candidateTour);
        if (candidateDistance < bestDistance) {
          bestTour = candidateTour;
          bestDistance = candidateDistance;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestTour;
}

/**
 * Proposes an optimized order for multiple stops using Nearest-Neighbor + 2-Opt heuristics.
 */
export async function optimizeTripRoute(
  options: OptimizeRouteOptions
): Promise<RouteOptimizationProposal> {
  const provider = options.distanceProvider ?? new HaversineDistanceProvider();
  const originalStops = [...options.stops].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber
  );

  const stopsMissingCoords = originalStops
    .filter((s) => !s.coordinates)
    .map((s) => s.storeName);

  // If 2 or fewer stops have coordinates, optimization is trivial
  const validStops = originalStops.filter((s) => s.coordinates !== null);

  const baseline = await computeRouteLegs(originalStops, provider);

  if (validStops.length <= 2) {
    return {
      tripId: options.tripId,
      originalOrder: originalStops,
      proposedOrder: originalStops,
      originalDistanceMeters: baseline.totalDistanceMeters,
      proposedDistanceMeters: baseline.totalDistanceMeters,
      distanceSavingsMeters: 0,
      percentageSavings: 0,
      distanceType: baseline.distanceType,
      providerName: baseline.providerName,
      distanceDisclaimer: baseline.disclaimer,
      estimatedTotalTransitMinutes: baseline.totalDurationMinutes,
      legs: baseline.legs,
      explanation:
        originalStops.length <= 1
          ? "Route contains 1 or fewer stops; current order is already optimal."
          : "Route contains 2 stops; order is direct between points.",
      stopsMissingCoordinates: stopsMissingCoords,
    };
  }

  // 1. Nearest Neighbor Construction
  const unvisited = [...validStops];
  const tour: RouteStopCandidate[] = [];

  let currentStop = unvisited.shift();
  if (!currentStop) {
    return {
      tripId: options.tripId,
      originalOrder: originalStops,
      proposedOrder: originalStops,
      originalDistanceMeters: baseline.totalDistanceMeters,
      proposedDistanceMeters: baseline.totalDistanceMeters,
      distanceSavingsMeters: 0,
      percentageSavings: 0,
      distanceType: baseline.distanceType,
      providerName: baseline.providerName,
      distanceDisclaimer: baseline.disclaimer,
      estimatedTotalTransitMinutes: baseline.totalDurationMinutes,
      legs: baseline.legs,
      explanation: "No stops with valid coordinates to optimize.",
      stopsMissingCoordinates: stopsMissingCoords,
    };
  }

  const startLoc = options.startLocation;
  if (!options.preserveFirstStop && startLoc && unvisited.length > 0) {
    unvisited.unshift(currentStop);
    unvisited.sort((a, b) => {
      const coordA = a.coordinates;
      const coordB = b.coordinates;
      if (!coordA || !coordB) return 0;
      return (
        calculateHaversineMeters(startLoc, coordA) -
        calculateHaversineMeters(startLoc, coordB)
      );
    });
    const firstClosest = unvisited.shift();
    if (firstClosest) {
      currentStop = firstClosest;
    }
  }

  tour.push(currentStop);

  while (unvisited.length > 0) {
    const currCoords = currentStop.coordinates;
    if (!currCoords) {
      const next = unvisited.shift();
      if (next) tour.push(next);
      continue;
    }

    // Find closest valid stop, giving priority to higher priority stops (priority: 1)
    unvisited.sort((a, b) => {
      const coordA = a.coordinates;
      const coordB = b.coordinates;
      if (!coordA || !coordB) return 0;
      const distA = calculateHaversineMeters(currCoords, coordA);
      const distB = calculateHaversineMeters(currCoords, coordB);
      const prioA = a.priority ?? 2;
      const prioB = b.priority ?? 2;

      if (prioA !== prioB && Math.abs(distA - distB) < 5000) {
        // If distances are within 5 km, prefer higher priority
        return prioA - prioB;
      }
      return distA - distB;
    });

    const next = unvisited.shift();
    if (next) {
      currentStop = next;
      tour.push(currentStop);
    }
  }

  // 2. 2-Opt Local Search Refinement
  const fixedStart = options.preserveFirstStop ? 1 : 0;
  const optimizedValidTour = runTwoOptOptimization(tour, fixedStart);

  // Append any stops that lacked coordinates at the end, preserving their relative order
  const invalidStops = originalStops.filter((s) => !s.coordinates);
  const finalProposedTour: RouteStopCandidate[] = [
    ...optimizedValidTour,
    ...invalidStops,
  ].map((stop, idx) => ({
    ...stop,
    sequenceNumber: idx + 1,
  }));

  const proposedLegs = await computeRouteLegs(finalProposedTour, provider);

  const originalDist = baseline.totalDistanceMeters;
  const proposedDist = proposedLegs.totalDistanceMeters;
  const savingsMeters = Math.max(0, originalDist - proposedDist);
  const percentageSavings =
    originalDist > 0 ? Math.round((savingsMeters / originalDist) * 100) : 0;

  let explanation: string;
  if (savingsMeters > 500) {
    const kmSaved = (savingsMeters / 1000).toFixed(1);
    explanation = `Optimized stop order reduces estimated transit distance by ~${kmSaved} km (${percentageSavings}% savings) using Nearest-Neighbor and 2-Opt path uncrossing.`;
  } else {
    explanation =
      "Current stop sequence is already near optimal; proposed order maintains logical progression.";
  }

  if (stopsMissingCoords.length > 0) {
    explanation += ` Note: ${stopsMissingCoords.length} store(s) have unconfigured coordinates and were placed at the end: ${stopsMissingCoords.join(", ")}.`;
  }

  return {
    tripId: options.tripId,
    originalOrder: originalStops,
    proposedOrder: finalProposedTour,
    originalDistanceMeters: originalDist,
    proposedDistanceMeters: proposedDist,
    distanceSavingsMeters: savingsMeters,
    percentageSavings,
    distanceType: proposedLegs.distanceType,
    providerName: proposedLegs.providerName,
    distanceDisclaimer: proposedLegs.disclaimer,
    estimatedTotalTransitMinutes: proposedLegs.totalDurationMinutes,
    legs: proposedLegs.legs,
    explanation,
    stopsMissingCoordinates: stopsMissingCoords,
  };
}
