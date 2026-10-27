"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { MapsUnavailableNotice } from "./MapsUnavailableNotice";
import { useGoogleMaps } from "./useGoogleMaps";

export interface TripMapStop {
  id?: string;
  sequenceNumber: number;
  storeName: string;
  city: string;
  region: string;
  addressLine1?: string;
  latitude: number | null;
  longitude: number | null;
}

export interface TripPlannerMapProps {
  stops: readonly TripMapStop[];
  height?: string;
  title?: string;
}

/**
 * Interactive Google Map displaying trip stops with numbered markers,
 * sequenced polyline connection, and automatic bounds fitting.
 */
export function TripPlannerMap({
  stops,
  height = "340px",
  title = "Trip Route Map",
}: TripPlannerMapProps): ReactNode {
  const { status, error, google } = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const stopsMissingCoords = stops.filter(
    (s) => s.latitude === null || s.longitude === null
  );
  const validStops = stops.filter(
    (s): s is TripMapStop & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null
  );

  // Initialize Map
  useEffect(() => {
    if (status !== "ready" || !google || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    }
  }, [status, google]);

  // Update Markers and Polyline whenever stops change
  useEffect(() => {
    if (status !== "ready" || !google || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear old markers
    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (validStops.length === 0) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    const pathCoords: google.maps.LatLngLiteral[] = [];

    validStops.forEach((stop) => {
      const pos = { lat: stop.latitude, lng: stop.longitude };
      pathCoords.push(pos);
      bounds.extend(pos);

      // SVG Pin with white number
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `Stop #${stop.sequenceNumber}: ${stop.storeName}`,
        label: {
          text: String(stop.sequenceNumber),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "13px",
        },
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#1d4ed8",
          strokeWeight: 1.5,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
          labelOrigin: new google.maps.Point(12, 9),
        },
      });

      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          const content = `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; color: #1e293b; max-width: 220px; padding: 4px;">
              <strong style="color: #2563eb;">Stop #${stop.sequenceNumber}</strong>
              <div style="font-weight: 600; font-size: 14px; margin-top: 2px;">${stop.storeName}</div>
              <div style="color: #64748b; margin-top: 2px;">${stop.addressLine1 || ""}${stop.addressLine1 ? ", " : ""}${stop.city}, ${stop.region}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">(${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)})</div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.push(marker);
    });

    // Draw sequenced polyline
    if (pathCoords.length >= 2) {
      const polyline = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
      polylineRef.current = polyline;
    }

    // Auto-fit bounds
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    if (validStops.length === 1) {
      google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        const currentZoom = map.getZoom();
        if (typeof currentZoom === "number" && currentZoom > 14) {
          map.setZoom(14);
        }
      });
    }
  }, [status, google, validStops]);

  if (status !== "ready") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <MapsUnavailableNotice
          status={status}
          errorMessage={error}
          featureName="Interactive trip route map"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-strong)",
        overflow: "hidden",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 0.75rem",
          backgroundColor: "var(--bg-subtle, #f8fafc)",
          borderBottom: "1px solid var(--border-subtle, #e2e8f0)",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          🗺️ {title} ({validStops.length} mapped / {stops.length} total)
        </span>
        <span className="card-meta" style={{ fontSize: "0.75rem" }}>
          Click markers for stop details
        </span>
      </div>

      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height,
          backgroundColor: "#e5e7eb",
        }}
      />

      {stopsMissingCoords.length > 0 ? (
        <div
          role="status"
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "var(--status-warning-bg, #fffbeb)",
            borderTop: "1px solid var(--status-warning-border, #fef3c7)",
            fontSize: "0.75rem",
            color: "var(--status-warning-text, #92400e)",
          }}
        >
          ⚠️ <strong>{stopsMissingCoords.length} stop(s) lack coordinates</strong> and
          cannot be rendered on the map:{" "}
          {stopsMissingCoords
            .map((s) => `Stop #${s.sequenceNumber} (${s.storeName})`)
            .join(", ")}
          .
        </div>
      ) : null}
    </div>
  );
}
