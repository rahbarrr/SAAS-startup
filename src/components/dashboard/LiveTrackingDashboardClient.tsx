"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LiveManagerMap, type LiveEmployeeMarkerData, type StoreMapData } from "@/components/maps";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export interface LiveTrackingDashboardClientProps {
  initialLocations: LiveEmployeeMarkerData[];
  stores: StoreMapData[];
  orgId: string;
}

type FilterStatus = "all" | "active" | "delayed" | "stale" | "offline";

export function LiveTrackingDashboardClient({
  initialLocations,
  stores,
  orgId,
}: LiveTrackingDashboardClientProps): React.JSX.Element {
  const [locations, setLocations] = useState<LiveEmployeeMarkerData[]>(initialLocations);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  const selectedEmployee = useMemo(
    () => locations.find((e) => e.employeeId === selectedEmployeeId) ?? null,
    [locations, selectedEmployeeId]
  );

  // Poll / Refresh latest locations
  const refreshLocations = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/location/latest`);
      if (res.ok) {
        const body = await res.json();
        if (body?.data) {
          setLocations(body.data);
          setLastRefreshed(new Date().toLocaleTimeString());
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setIsRefreshing(false);
    }
  };

  // Supabase Realtime Subscription for live position updates
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`live-locations-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "latest_employee_locations",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          refreshLocations();
        }
      )
      .subscribe();

    const interval = setInterval(refreshLocations, 30_000); // 30s fallback poll

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [orgId]);

  const filteredEmployees = useMemo(() => {
    if (filter === "all") return locations;
    return locations.filter((loc) => {
      if (filter === "active") return loc.freshness.status === "fresh";
      if (filter === "delayed") return loc.freshness.status === "delayed";
      if (filter === "stale") return loc.freshness.status === "stale";
      if (filter === "offline") return loc.trackingStatus === "offline" || loc.trackingStatus === "stopped";
      return true;
    });
  }, [locations, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Controls & Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "1rem",
          backgroundColor: "var(--bg-surface, #ffffff)",
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--border-subtle, #e2e8f0)",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
            Filter Status:
          </span>
          {(["all", "active", "delayed", "stale", "offline"] as FilterStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className="btn btn-sm"
              style={{
                fontSize: "0.75rem",
                textTransform: "capitalize",
                backgroundColor: filter === st ? "var(--brand-primary, #2563eb)" : "#f1f5f9",
                color: filter === st ? "#ffffff" : "#334155",
                border: "none",
                borderRadius: "6px",
                padding: "0.35rem 0.75rem",
                cursor: "pointer",
              }}
            >
              {st} ({st === "all" ? locations.length : locations.filter((l) => (st === "active" ? l.freshness.status === "fresh" : st === "delayed" ? l.freshness.status === "delayed" : st === "stale" ? l.freshness.status === "stale" : l.trackingStatus === "offline" || l.trackingStatus === "stopped")).length})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Last updated: {lastRefreshed}
          </span>
          <button
            onClick={refreshLocations}
            disabled={isRefreshing}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: "0.75rem", cursor: "pointer" }}
          >
            {isRefreshing ? "Refreshing..." : "🔄 Refresh Now"}
          </button>
        </div>
      </div>

      {/* Main Grid: Map & Detail Panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedEmployee ? "1fr 340px" : "1fr",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <div>
          <LiveManagerMap
            employees={filteredEmployees}
            stores={stores}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={(emp) => setSelectedEmployeeId(emp ? emp.employeeId : null)}
            height="580px"
          />
        </div>

        {/* Selected Employee Detail Sidebar */}
        {selectedEmployee && (
          <div
            style={{
              backgroundColor: "var(--bg-surface, #ffffff)",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                  {selectedEmployee.employeeName ?? "Field Employee"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  {selectedEmployee.employeeEmail}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployeeId(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                backgroundColor:
                  selectedEmployee.freshness.status === "fresh"
                    ? "#ecfdf5"
                    : selectedEmployee.freshness.status === "delayed"
                    ? "#fffbeb"
                    : "#fef2f2",
                border: `1px solid ${
                  selectedEmployee.freshness.status === "fresh"
                    ? "#a7f3d0"
                    : selectedEmployee.freshness.status === "delayed"
                    ? "#fde68a"
                    : "#fecaca"
                }`,
                borderRadius: "8px",
                padding: "0.75rem",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                Status: {selectedEmployee.freshness.status}
              </div>
              <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: "2px" }}>
                {selectedEmployee.freshness.warningNote ?? "Fresh GPS fix reported within SLA"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Active Trip:</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                  {selectedEmployee.tripTitle ?? "In Progress"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Last Update:</span>
                <span style={{ color: "#0f172a" }}>
                  {new Date(selectedEmployee.recordedAt).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Accuracy:</span>
                <span style={{ color: "#0f172a" }}>
                  {selectedEmployee.accuracyM ? `±${Math.round(selectedEmployee.accuracyM)}m` : "Unavailable"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Coordinates:</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#334155" }}>
                  {selectedEmployee.latitude.toFixed(4)}, {selectedEmployee.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <a
                href={`/trips/${selectedEmployee.tripId}`}
                className="btn btn-secondary"
                style={{ width: "100%", textAlign: "center", display: "block", fontSize: "0.8125rem" }}
              >
                Inspect Full Trip →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
