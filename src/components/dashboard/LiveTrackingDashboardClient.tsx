"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  LiveManagerMap,
  type LiveEmployeeMarkerData,
  type StoreMapData,
} from "@/components/maps";
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
  const [lastRefreshed, setLastRefreshed] = useState<string>(
    new Date().toLocaleTimeString()
  );

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
      if (filter === "offline")
        return loc.trackingStatus === "offline" || loc.trackingStatus === "stopped";
      return true;
    });
  }, [locations, filter]);

  const freshCount = locations.filter((l) => l.freshness.status === "fresh").length;
  const delayedCount = locations.filter((l) => l.freshness.status === "delayed").length;
  const freshPct =
    locations.length > 0 ? Math.round((freshCount / locations.length) * 100) : 100;

  return (
    <div
      className="mobile-page-stack"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* Reference-Inspired Dark Obsidian Telemetry Strip + Live Feed Summary */}
      <div className="dashboard-bento-hero-row">
        <article className="hero-obsidian-card" style={{ minHeight: "13.5rem" }}>
          <div className="hero-obsidian-top">
            <div className="hero-obsidian-avatars" aria-hidden="true">
              <span className="hero-avatar-circle hero-avatar-circle--primary">GP</span>
              <span className="hero-avatar-circle hero-avatar-circle--secondary">GF</span>
              <span className="hero-avatar-badge">●</span>
            </div>
            <div className="hero-obsidian-meta">
              <strong className="hero-obsidian-org">
                Live GPS &amp; Geofence Telemetry
              </strong>
              <span className="hero-obsidian-sub">
                {stores.length} geofenced retail stores (150m radius) • 60s GPS cadence
              </span>
            </div>
          </div>

          <div className="hero-obsidian-metric-block">
            <span className="hero-obsidian-eyebrow">Active Field Operators Tracked</span>
            <div className="hero-obsidian-number">{locations.length}</div>
            <p className="hero-obsidian-caption">
              {freshCount} fresh GPS fixes • {delayedCount} delayed • Last synced{" "}
              {lastRefreshed}
            </p>
          </div>

          <div className="hero-obsidian-bar-section">
            <div className="hero-obsidian-bar-track" aria-hidden="true">
              <div
                className="hero-obsidian-bar-primary"
                style={{ width: `${Math.max(15, freshPct)}%` }}
              />
              <div
                className="hero-obsidian-bar-secondary"
                style={{ width: `${Math.max(10, 100 - freshPct)}%` }}
              />
            </div>
            <div className="hero-obsidian-legend">
              <span className="hero-obsidian-legend-item">
                <span className="hero-legend-dot hero-legend-dot--blue" />
                Fresh Signal • {freshCount} <strong>{freshPct}%</strong>
              </span>
              <span className="hero-obsidian-legend-item">
                <span className="hero-legend-dot hero-legend-dot--periwinkle" />
                Geofence Stores • {stores.length} <strong>150m</strong>
              </span>
            </div>
          </div>
        </article>

        <aside className="activity-bento-card" aria-label="Tracked employee roster">
          <div className="activity-bento-header">
            <div>
              <h2 className="activity-bento-title">Field Operators</h2>
              <p className="activity-bento-subtitle">
                Tap an operator to inspect GPS fix
              </p>
            </div>
            <span className="activity-live-pill">
              <span className="activity-live-dot" aria-hidden="true" />
              Live 60s
            </span>
          </div>

          <div className="activity-bento-list">
            {filteredEmployees.length === 0 ? (
              <div
                style={{
                  padding: "1.25rem 0.5rem",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                No active trip GPS fixes match the current filter ({filter}).{" "}
                {stores.length} store geofences (150m) remain active on the map below.
              </div>
            ) : (
              filteredEmployees.slice(0, 4).map((emp, idx) => (
                <button
                  key={emp.employeeId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(emp.employeeId)}
                  className="activity-bento-item"
                  style={{
                    width: "100%",
                    border: "none",
                    background:
                      selectedEmployeeId === emp.employeeId
                        ? "var(--brand-royal-soft)"
                        : "transparent",
                    borderRadius: "12px",
                    padding: "0.375rem 0.5rem",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    className={`activity-bento-avatar activity-bento-avatar--${
                      idx % 2 === 0 ? "blue" : "periwinkle"
                    }`}
                  >
                    {(emp.employeeName ?? emp.employeeEmail ?? "FE")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="activity-bento-info">
                    <span className="activity-bento-item-title">
                      {emp.employeeName ?? emp.employeeEmail}
                    </span>
                    <span className="activity-bento-item-date">
                      {emp.tripTitle ?? "Active Itinerary"} •{" "}
                      {emp.accuracyM ? `±${Math.round(emp.accuracyM)}m` : "GPS"}
                    </span>
                  </div>
                  <span className="activity-bento-delta">
                    • {emp.freshness.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Controls & Pill Filter Bar */}
      <div className="filter-bar" style={{ justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginRight: "0.25rem",
            }}
          >
            Signal Status:
          </span>
          {(["all", "active", "delayed", "stale", "offline"] as FilterStatus[]).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`top-pill-link ${filter === st ? "active" : ""}`}
                style={{
                  border: "none",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  fontFamily: "inherit",
                }}
              >
                {st} (
                {st === "all"
                  ? locations.length
                  : locations.filter((l) =>
                      st === "active"
                        ? l.freshness.status === "fresh"
                        : st === "delayed"
                          ? l.freshness.status === "delayed"
                          : st === "stale"
                            ? l.freshness.status === "stale"
                            : l.trackingStatus === "offline" ||
                              l.trackingStatus === "stopped"
                    ).length}
                )
              </button>
            )
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Last updated: {lastRefreshed}
          </span>
          <button
            type="button"
            onClick={refreshLocations}
            disabled={isRefreshing}
            className="btn btn-sm btn-secondary"
          >
            <RefreshCw
              size={12}
              aria-hidden="true"
              style={{
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Map & Detail Panel */}
      <div
        className={`live-tracking-layout ${selectedEmployee ? "has-selected-employee" : ""}`}
      >
        <div>
          <LiveManagerMap
            employees={filteredEmployees}
            stores={stores}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={(emp) => setSelectedEmployeeId(emp ? emp.employeeId : null)}
            height="clamp(380px, 55vh, 560px)"
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
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
              <div
                style={{
                  fontWeight: 600,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                }}
              >
                Status: {selectedEmployee.freshness.status}
              </div>
              <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: "2px" }}>
                {selectedEmployee.freshness.warningNote ??
                  "Fresh GPS fix reported within SLA"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted, #64748b)" }}>Active Trip:</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary, #030407)" }}>
                  {selectedEmployee.tripTitle ?? "In Progress"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted, #64748b)" }}>Last Update:</span>
                <span style={{ color: "var(--text-primary, #030407)" }}>
                  {new Date(selectedEmployee.recordedAt).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted, #64748b)" }}>Accuracy:</span>
                <span style={{ color: "var(--text-primary, #030407)" }}>
                  {selectedEmployee.accuracyM
                    ? `±${Math.round(selectedEmployee.accuracyM)}m`
                    : "Unavailable"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted, #64748b)" }}>Coordinates:</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary, #334155)",
                  }}
                >
                  {selectedEmployee.latitude.toFixed(4)},{" "}
                  {selectedEmployee.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <a
                href={`/trips/${selectedEmployee.tripId}`}
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  textAlign: "center",
                  display: "block",
                  fontSize: "0.8125rem",
                }}
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
