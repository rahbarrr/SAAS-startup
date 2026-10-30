"use client";

import React, { useEffect, useRef } from "react";
import { MapsUnavailableNotice } from "./MapsUnavailableNotice";
import { useGoogleMaps } from "./useGoogleMaps";

export interface LiveEmployeeMarkerData {
  employeeId: string;
  orgId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
  receivedAt: string;
  trackingStatus: "active" | "stationary" | "delayed" | "stale" | "offline" | "stopped";
  employeeName?: string;
  employeeEmail?: string;
  tripTitle?: string;
  freshness: {
    status: "fresh" | "delayed" | "stale" | "unavailable";
    ageSeconds: number | null;
    isAccurate: boolean;
    warningNote: string | null;
  };
}

export interface StoreMapData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM?: number;
  addressLine1?: string;
  city?: string;
}

export interface LiveManagerMapProps {
  employees: LiveEmployeeMarkerData[];
  stores: StoreMapData[];
  selectedEmployeeId?: string | null;
  onSelectEmployee?: (employee: LiveEmployeeMarkerData | null) => void;
  height?: string;
}

export function LiveManagerMap({
  employees,
  stores,
  selectedEmployeeId,
  onSelectEmployee,
  height = "560px",
}: LiveManagerMapProps): React.JSX.Element {
  const { status, error, google } = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const employeeMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const storeMarkersRef = useRef<google.maps.Marker[]>([]);
  const geofenceCirclesRef = useRef<google.maps.Circle[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Initialize Map
  useEffect(() => {
    if (status !== "ready" || !google || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    }
  }, [status, google]);

  // Update Stores and Geofences
  useEffect(() => {
    if (status !== "ready" || !google || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    for (const m of storeMarkersRef.current) m.setMap(null);
    storeMarkersRef.current = [];
    for (const c of geofenceCirclesRef.current) c.setMap(null);
    geofenceCirclesRef.current = [];

    stores.forEach((store) => {
      const pos = { lat: store.latitude, lng: store.longitude };

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `Store: ${store.name}`,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: "#0284c7",
          fillOpacity: 0.9,
          strokeColor: "#0369a1",
          strokeWeight: 1.5,
          scale: 1.2,
          anchor: new google.maps.Point(12, 22),
        },
      });

      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="font-family: system-ui, sans-serif; font-size: 13px; color: #0f172a; padding: 4px;">
              <strong style="color: #0284c7;">🏪 ${store.name}</strong>
              <div style="color: #64748b; margin-top: 2px;">${store.addressLine1 || ""}${store.city ? `, ${store.city}` : ""}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Radius: ${store.radiusM ?? 150}m</div>
            </div>
          `);
          infoWindowRef.current.open(map, marker);
        }
      });

      storeMarkersRef.current.push(marker);

      const circle = new google.maps.Circle({
        map,
        center: pos,
        radius: store.radiusM ?? 150,
        fillColor: "#38bdf8",
        fillOpacity: 0.15,
        strokeColor: "#0284c7",
        strokeOpacity: 0.5,
        strokeWeight: 1,
      });
      geofenceCirclesRef.current.push(circle);
    });
  }, [status, google, stores]);

  // Update Employee Markers
  useEffect(() => {
    if (status !== "ready" || !google || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const currentMap = employeeMarkersRef.current;
    const activeIds = new Set<string>();

    employees.forEach((emp) => {
      activeIds.add(emp.employeeId);
      const pos = { lat: emp.latitude, lng: emp.longitude };
      const freshness = emp.freshness.status;
      const markerColor =
        freshness === "fresh"
          ? "#16a34a" // Green
          : freshness === "delayed"
          ? "#d97706" // Amber
          : freshness === "stale"
          ? "#dc2626" // Red
          : "#64748b"; // Grey

      let marker = currentMap.get(emp.employeeId);
      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          map,
          title: emp.employeeName ?? emp.employeeEmail ?? "Field Employee",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2.5,
            scale: 9,
          },
          label: {
            text: (emp.employeeName ?? "E").charAt(0).toUpperCase(),
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: "bold",
          },
        });

        marker.addListener("click", () => {
          onSelectEmployee?.(emp);
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="font-family: system-ui, sans-serif; font-size: 13px; color: #0f172a; padding: 4px; min-width: 180px;">
                <strong>👤 ${emp.employeeName ?? "Field Rep"}</strong>
                <div style="color: #64748b; font-size: 11px;">${emp.employeeEmail ?? ""}</div>
                <div style="margin-top: 6px; font-size: 12px;"><strong>Trip:</strong> ${emp.tripTitle ?? "Active Trip"}</div>
                <div style="font-size: 11px; color: ${markerColor}; font-weight: 600; margin-top: 2px;">
                  Status: ${freshness.toUpperCase()} ${emp.accuracyM ? `(±${Math.round(emp.accuracyM)}m)` : ""}
                </div>
                ${emp.freshness.warningNote ? `<div style="font-size: 10px; color: #d97706; margin-top: 2px;">⚠️ ${emp.freshness.warningNote}</div>` : ""}
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          }
        });

        currentMap.set(emp.employeeId, marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
          scale: 9,
        });
      }
    });

    // Remove deleted / inactive employee markers
    for (const [id, marker] of currentMap.entries()) {
      if (!activeIds.has(id)) {
        marker.setMap(null);
        currentMap.delete(id);
      }
    }

    // Auto fit bounds if any markers exist and none selected
    if (employees.length > 0 && !selectedEmployeeId) {
      const bounds = new google.maps.LatLngBounds();
      employees.forEach((e) => bounds.extend({ lat: e.latitude, lng: e.longitude }));
      stores.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [status, google, employees, stores, selectedEmployeeId, onSelectEmployee]);

  // Pan to selected employee
  useEffect(() => {
    if (status !== "ready" || !google || !mapInstanceRef.current || !selectedEmployeeId) return;
    const target = employees.find((e) => e.employeeId === selectedEmployeeId);
    if (target) {
      mapInstanceRef.current.panTo({ lat: target.latitude, lng: target.longitude });
      mapInstanceRef.current.setZoom(15);
    }
  }, [status, google, selectedEmployeeId, employees]);

  if (status !== "ready") {
    return (
      <MapsUnavailableNotice
        status={status}
        errorMessage={error}
        featureName="FieldTrack Live Manager Map"
      />
    );
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border-strong, #cbd5e1)",
        overflow: "hidden",
        backgroundColor: "#e2e8f0",
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
    </div>
  );
}
