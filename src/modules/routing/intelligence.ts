import { calculateHaversineMeters } from "./provider";
import type { LatLng } from "./domain";

export interface PlannedStopEvaluation {
  tripStopId: string;
  storeId: string;
  storeName: string;
  sequenceNumber: number;
  plannedCoordinates: LatLng | null;
  actualVisitedAt: string | null;
  actualArrivalCoordinates: LatLng | null;
  arrivalAccuracyM: number | null;
  status: "visited" | "missed" | "pending" | "delayed";
  distanceFromStoreMeters: number | null;
}

export interface RouteDeviationAlert {
  type:
    | "missed_store"
    | "delayed_arrival"
    | "out_of_boundary_checkin"
    | "extended_inactivity"
    | "trip_overdue"
    | "uncompleted_checkout";
  severity: "critical" | "warning" | "info";
  message: string;
  tripId: string;
  employeeUserId: string;
  metadata?: Record<string, unknown>;
}

export interface RouteIntelligenceAnalysis {
  tripId: string;
  employeeUserId: string;
  plannedStopCount: number;
  visitedStopCount: number;
  missedStopCount: number;
  stops: PlannedStopEvaluation[];
  alerts: RouteDeviationAlert[];
}

export function evaluateTripRouteActivity(params: {
  trip: {
    id: string;
    ownerUserId: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  stops: Array<{
    id: string;
    storeId: string;
    sequenceNumber: number;
    status: "planned" | "visited" | "skipped";
    store?: {
      name: string;
      latitude: number | null;
      longitude: number | null;
    } | null;
  }>;
  visits: Array<{
    id: string;
    tripStopId: string;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    status: string;
    checkInLocation: {
      latitude: number | null;
      longitude: number | null;
      accuracyMeters: number | null;
      status: string;
    };
  }>;
  latestLocation?: {
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    recordedAt: string;
  } | null;
  now?: Date;
}): RouteIntelligenceAnalysis {
  const now = params.now ?? new Date();
  const alerts: RouteDeviationAlert[] = [];
  const evaluatedStops: PlannedStopEvaluation[] = [];

  const visitsByStop = new Map(params.visits.map((v) => [v.tripStopId, v]));

  let visitedCount = 0;
  let missedCount = 0;

  params.stops.forEach((stop) => {
    const visit = visitsByStop.get(stop.id);
    const storeLat = stop.store?.latitude ?? null;
    const storeLng = stop.store?.longitude ?? null;
    const storeCoords =
      storeLat !== null && storeLng !== null
        ? { latitude: storeLat, longitude: storeLng }
        : null;

    let distFromStore: number | null = null;
    if (
      storeCoords &&
      visit?.checkInLocation.latitude &&
      visit?.checkInLocation.longitude
    ) {
      distFromStore = calculateHaversineMeters(
        {
          latitude: visit.checkInLocation.latitude,
          longitude: visit.checkInLocation.longitude,
        },
        storeCoords
      );
    }

    let status: "visited" | "missed" | "pending" | "delayed" = "pending";
    if (stop.status === "visited" || visit?.checkedInAt) {
      status = "visited";
      visitedCount += 1;

      // Check boundary alert: if checked in outside 150m boundary with good GPS
      if (
        distFromStore !== null &&
        distFromStore > 150 &&
        (visit?.checkInLocation.accuracyMeters ?? 0) <= 50
      ) {
        alerts.push({
          type: "out_of_boundary_checkin",
          severity: "warning",
          message: `Employee checked in ${distFromStore}m away from ${stop.store?.name ?? "store"} (exceeds 150m geofence radius).`,
          tripId: params.trip.id,
          employeeUserId: params.trip.ownerUserId,
          metadata: { tripStopId: stop.id, distanceMeters: distFromStore },
        });
      }

      // Check uncompleted checkout
      if (visit && !visit.checkedOutAt && params.trip.status === "completed") {
        alerts.push({
          type: "uncompleted_checkout",
          severity: "warning",
          message: `Visit to ${stop.store?.name ?? "store"} remained open after trip completion.`,
          tripId: params.trip.id,
          employeeUserId: params.trip.ownerUserId,
          metadata: { visitId: visit.id, tripStopId: stop.id },
        });
      }
    } else if (
      stop.status === "skipped" ||
      (params.trip.status === "completed" && !visit)
    ) {
      status = "missed";
      missedCount += 1;
      alerts.push({
        type: "missed_store",
        severity: "warning",
        message: `Planned stop #${stop.sequenceNumber} (${stop.store?.name ?? "store"}) was not visited.`,
        tripId: params.trip.id,
        employeeUserId: params.trip.ownerUserId,
        metadata: { tripStopId: stop.id, sequenceNumber: stop.sequenceNumber },
      });
    }

    evaluatedStops.push({
      tripStopId: stop.id,
      storeId: stop.storeId,
      storeName: stop.store?.name ?? `Store #${stop.sequenceNumber}`,
      sequenceNumber: stop.sequenceNumber,
      plannedCoordinates: storeCoords,
      actualVisitedAt: visit?.checkedInAt ?? null,
      actualArrivalCoordinates:
        visit &&
        visit.checkInLocation.latitude !== null &&
        visit.checkInLocation.longitude !== null
          ? {
              latitude: visit.checkInLocation.latitude as number,
              longitude: visit.checkInLocation.longitude as number,
            }
          : null,
      arrivalAccuracyM: visit?.checkInLocation.accuracyMeters ?? null,
      status,
      distanceFromStoreMeters: distFromStore,
    });
  });

  // Check extended inactivity (> 60 minutes without update during in_progress trip)
  if (params.trip.status === "in_progress") {
    if (params.latestLocation?.recordedAt) {
      const lastUpdate = new Date(params.latestLocation.recordedAt).getTime();
      const diffMinutes = Math.floor((now.getTime() - lastUpdate) / 60_000);
      if (diffMinutes > 60) {
        alerts.push({
          type: "extended_inactivity",
          severity: "critical",
          message: `No GPS location updates received for ${diffMinutes} minutes during active trip.`,
          tripId: params.trip.id,
          employeeUserId: params.trip.ownerUserId,
          metadata: { minutesInactive: diffMinutes },
        });
      }
    }

    // Check overdue trip
    const endDateTime = new Date(`${params.trip.endDate}T23:59:59Z`).getTime();
    if (now.getTime() > endDateTime) {
      alerts.push({
        type: "trip_overdue",
        severity: "critical",
        message: `Trip exceeded planned end date (${params.trip.endDate}) but remains in progress.`,
        tripId: params.trip.id,
        employeeUserId: params.trip.ownerUserId,
        metadata: { endDate: params.trip.endDate },
      });
    }
  }

  return {
    tripId: params.trip.id,
    employeeUserId: params.trip.ownerUserId,
    plannedStopCount: params.stops.length,
    visitedStopCount: visitedCount,
    missedStopCount: missedCount,
    stops: evaluatedStops,
    alerts,
  };
}
