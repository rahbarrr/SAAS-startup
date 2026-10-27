"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { MapsUnavailableNotice } from "./MapsUnavailableNotice";
import { useGoogleMaps } from "./useGoogleMaps";

export interface LocationPickerMapProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number } | null) => void;
  height?: string;
  zoom?: number;
}

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }; // Center of US
const DEFAULT_ZOOM = 4;
const PINNED_ZOOM = 15;

/**
 * Interactive map component for selecting and fine-tuning store coordinates.
 * Supports map clicks and marker dragging. Gracefully degrades when unconfigured.
 */
export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  height = "260px",
  zoom = DEFAULT_ZOOM,
}: LocationPickerMapProps): ReactNode {
  const { status, error, google } = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);

  const hasCoords = latitude !== null && longitude !== null;

  // Initialize or update map instance
  useEffect(() => {
    if (status !== "ready" || !google || !mapContainerRef.current) return;

    const initialCenter = hasCoords ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;
    const initialZoom = hasCoords ? PINNED_ZOOM : zoom;

    if (!mapInstanceRef.current) {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Map click moves pin
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = Number(e.latLng.lat().toFixed(6));
        const lng = Number(e.latLng.lng().toFixed(6));
        onChange({ latitude: lat, longitude: lng });
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Manage Marker
    if (hasCoords) {
      const pos = { lat: latitude, lng: longitude };
      if (!markerInstanceRef.current) {
        const marker = new google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          title: "Store Location (Drag to adjust)",
        });

        marker.addListener("dragend", () => {
          const markerPos = marker.getPosition();
          if (markerPos) {
            const lat = Number(markerPos.lat().toFixed(6));
            const lng = Number(markerPos.lng().toFixed(6));
            onChange({ latitude: lat, longitude: lng });
          }
        });

        markerInstanceRef.current = marker;
      } else {
        markerInstanceRef.current.setPosition(pos);
        markerInstanceRef.current.setMap(map);
      }
      map.panTo(pos);
    } else {
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setMap(null);
        markerInstanceRef.current = null;
      }
    }
  }, [status, google, hasCoords, latitude, longitude, onChange, zoom]);

  if (status !== "ready") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <MapsUnavailableNotice
          status={status}
          errorMessage={error}
          featureName="Interactive location picker map"
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
        ref={mapContainerRef}
        style={{
          width: "100%",
          height,
          backgroundColor: "#e5e7eb",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 0.75rem",
          backgroundColor: "var(--bg-subtle, #f8fafc)",
          borderTop: "1px solid var(--border-subtle, #e2e8f0)",
          fontSize: "0.8125rem",
        }}
      >
        <div>
          {hasCoords ? (
            <span style={{ color: "var(--color-success-text, #166534)" }}>
              📍 <strong>Selected Coordinates:</strong> {latitude.toFixed(6)},{" "}
              {longitude.toFixed(6)}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted, #64748b)" }}>
              📍 <em>Click map or search place above to set pin location</em>
            </span>
          )}
        </div>
        {hasCoords ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
          >
            Clear Pin
          </button>
        ) : null}
      </div>
    </div>
  );
}
