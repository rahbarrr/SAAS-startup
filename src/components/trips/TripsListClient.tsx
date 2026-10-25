"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { useCurrentRole } from "@/components/ui/RoleContext";
import type { Trip } from "@/modules/trips/domain";
import type { ExtendedDemoTrip } from "@/lib/mock-data/fieldtrack-demo-data";

export interface TripsListClientProps {
  initialTrips: readonly (Trip | ExtendedDemoTrip)[];
  activeOrgName: string;
  isDemo?: boolean;
  activeOrgId?: string;
}

function normalizeTrip(trip: Trip | ExtendedDemoTrip): ExtendedDemoTrip {
  if ("repName" in trip && "stores" in trip && Array.isArray((trip as ExtendedDemoTrip).stores)) {
    return trip as ExtendedDemoTrip;
  }
  return {
    ...trip,
    repName: trip.ownerUserId ? `Member (${trip.ownerUserId.slice(0, 8)})` : "Field Representative",
    territory: "Assigned Territory",
    storeCount: 0,
    completedStops: 0,
    expectedOutcomes: [],
    stores: [],
    budgetEstimated: undefined,
    travelMode: "Company Vehicle",
  };
}

export function TripsListClient({
  initialTrips,
  activeOrgName,
  isDemo = false,
  activeOrgId: _activeOrgId,
}: TripsListClientProps): ReactNode {
  const { currentRole } = useCurrentRole();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Map initial trips to display items
  const allTrips: ExtendedDemoTrip[] = (initialTrips ?? []).map(normalizeTrip);

  const filteredTrips = allTrips.filter((trip) => {
    if (statusFilter !== "all" && trip.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        trip.title.toLowerCase().includes(q) ||
        trip.purpose.toLowerCase().includes(q) ||
        trip.repName.toLowerCase().includes(q) ||
        trip.territory.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: allTrips.length,
    submitted: allTrips.filter((t) => t.status === "submitted").length,
    inProgress: allTrips.filter((t) => t.status === "in_progress").length,
    completed: allTrips.filter((t) => t.status === "completed").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <section aria-labelledby="trips-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="trips-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Field Trips
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrgName}</strong> • Plan multi-store itineraries, submit for manager approval, and review outcomes.
            </p>
          </div>
          <Link href="/trips/new" className="btn btn-primary">
            + Plan New Trip
          </Link>
        </div>
      </section>

      {/* Demo Notice Banner */}
      {isDemo ? (
        <div
          role="note"
          style={{
            background: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem 0.875rem",
            fontSize: "0.8125rem",
            color: "var(--brand-dark)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <span>
            ⚡ <strong>Interactive Demo Mode:</strong> Viewing demonstration retail trips. Sign in to your workspace to manage persisted production field itineraries.
          </span>
          <Link href="/login" style={{ color: "var(--brand-primary)", fontWeight: 700, textDecoration: "none" }}>
            Sign In →
          </Link>
        </div>
      ) : null}

      {/* Quick Status KPI Strip */}
      <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-primary)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Total Planned</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)" }}>{counts.total}</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-accent)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Awaiting Approval</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--brand-accent)" }}>{counts.submitted}</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid #3B82F6" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>In Progress</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--brand-primary)" }}>{counts.inProgress}</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--status-success)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Completed</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--status-success)" }}>{counts.completed}</span>
        </div>
      </div>

      {/* Filter and View Controls */}
      <section className="filter-bar" aria-label="Filter trips by workflow status and keyword">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="trip-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, representative, territory…"
            className="form-input"
            aria-label="Search field trips"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="trip-status-filter" className="form-label" style={{ margin: 0 }}>
            Status:
          </label>
          <select
            id="trip-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ minWidth: "10rem" }}
          >
            <option value="all">All Statuses ({allTrips.length})</option>
            <option value="draft">Drafts</option>
            <option value="submitted">Submitted (Awaiting Approval)</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* List vs Calendar Toggle */}
        <div className="tabs-container" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className={`tab-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            ☰ List View
          </button>
          <button
            type="button"
            className={`tab-btn ${viewMode === "calendar" ? "active" : ""}`}
            onClick={() => setViewMode("calendar")}
          >
            📅 Schedule View
          </button>
        </div>
      </section>

      {/* Content: List View vs Calendar View */}
      {filteredTrips.length === 0 ? (
        <EmptyState
          title={allTrips.length === 0 ? "No field trips created yet" : "No field trips match your criteria"}
          description={
            allTrips.length === 0
              ? "Create your first field trip itinerary, add destination stores, and submit for manager approval."
              : "Try broadening your status filters or search query."
          }
          actionLabel="+ Plan New Trip"
          actionHref="/trips/new"
        />
      ) : viewMode === "list" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredTrips.map((trip) => {
            const isManagerOrAdmin = currentRole === "admin" || currentRole === "manager";
            const canEdit = trip.status === "draft" || trip.status === "changes_requested";

            return (
              <article
                key={trip.id}
                className="card"
                style={{
                  transition: "box-shadow 0.15s ease",
                  borderLeft:
                    trip.status === "in_progress"
                      ? "4px solid var(--brand-primary)"
                      : trip.status === "submitted"
                      ? "4px solid var(--brand-accent)"
                      : trip.status === "completed"
                      ? "4px solid var(--status-success)"
                      : "4px solid var(--border-default)",
                }}
              >
                <div className="card-header">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link
                        href={`/trips/${trip.id}`}
                        style={{
                          fontSize: "1.0625rem",
                          fontWeight: 700,
                          color: "var(--brand-dark)",
                          textDecoration: "none",
                        }}
                      >
                        {trip.title}
                      </Link>
                    </div>
                    <p className="card-meta" style={{ margin: 0 }}>
                      Field Rep: <strong>{trip.repName}</strong> • Destination: <strong>{trip.territory}</strong>
                    </p>
                  </div>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                </div>

                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  {trip.purpose}
                </p>

                {/* Stops sequence preview */}
                <div style={{ background: "var(--bg-subtle)", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", fontSize: "0.8125rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                    Planned Itinerary ({trip.stores?.length ?? trip.storeCount ?? 0} retail stops):
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.375rem" }}>
                    {trip.stores && trip.stores.length > 0 ? (
                      trip.stores.map((s) => (
                        <span
                          key={s.id}
                          style={{
                            background: "var(--bg-surface)",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-default)",
                            color: s.status === "checked_out" ? "var(--status-success)" : "var(--text-primary)",
                            fontWeight: s.status === "checked_out" ? 600 : 400,
                          }}
                        >
                          {s.status === "checked_out" ? "✓ " : `${s.sequence}. `}
                          {s.name}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        Destination stops configured on trip details page
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--border-default)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "var(--text-muted)" }}>
                    <span>📅 {trip.startDate} to {trip.endDate}</span>
                    {trip.budgetEstimated ? <span>💵 {trip.budgetEstimated}</span> : null}
                    {trip.travelMode ? <span>🚗 {trip.travelMode}</span> : null}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {canEdit ? (
                      <Link href={`/trips/${trip.id}/edit`} className="btn btn-sm btn-secondary">
                        Edit Trip
                      </Link>
                    ) : null}
                    {isManagerOrAdmin && trip.status === "submitted" ? (
                      <Link href="/approvals" className="btn btn-sm btn-primary">
                        Review in Approvals →
                      </Link>
                    ) : null}
                    <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-outline">
                      View Itinerary Details
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Calendar / Itinerary Schedule View */
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 className="card-title" style={{ fontSize: "1.125rem" }}>
              Field Route Schedule — Week of Oct 25, 2026
            </h2>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>All times UTC</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", gap: "1rem" }}>
            {[
              { day: "Monday", date: "Oct 22", trips: allTrips.filter((t) => t.startDate <= "2026-10-22" && t.endDate >= "2026-10-22") },
              { day: "Tuesday", date: "Oct 23", trips: allTrips.filter((t) => t.startDate <= "2026-10-23" && t.endDate >= "2026-10-23") },
              { day: "Wednesday", date: "Oct 24", trips: allTrips.filter((t) => t.startDate <= "2026-10-24" && t.endDate >= "2026-10-24") },
              { day: "Thursday", date: "Oct 25 (Today)", dateClass: "highlight", trips: allTrips.filter((t) => t.startDate <= "2026-10-25" && t.endDate >= "2026-10-25") },
              { day: "Friday", date: "Oct 26", trips: allTrips.filter((t) => t.startDate <= "2026-10-26" && t.endDate >= "2026-10-26") },
            ].map((col) => (
              <div
                key={col.day}
                style={{
                  background: col.dateClass ? "#F0F5FF" : "var(--bg-subtle)",
                  border: col.dateClass ? "1px solid var(--status-info-border)" : "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.875rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  minHeight: "16rem",
                }}
              >
                <div style={{ borderBottom: "1px solid var(--border-default)", paddingBottom: "0.5rem" }}>
                  <strong style={{ fontSize: "0.875rem", color: col.dateClass ? "var(--brand-primary)" : "var(--text-primary)" }}>
                    {col.day}
                  </strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{col.date}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {col.trips.length === 0 ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No scheduled routes
                    </span>
                  ) : (
                    col.trips.map((t) => (
                      <Link
                        key={t.id}
                        href={`/trips/${t.id}`}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--radius-sm)",
                          padding: "0.5rem",
                          textDecoration: "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          boxShadow: "var(--shadow-xs)",
                        }}
                      >
                        <strong style={{ fontSize: "0.8125rem", color: "var(--brand-dark)" }}>{t.title}</strong>
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Rep: {t.repName}</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                          <span style={{ fontSize: "0.6875rem", color: "var(--brand-primary)", fontWeight: 600 }}>{t.storeCount} stops</span>
                          <StatusBadge descriptor={getApprovalStatusDescriptor(t.status)} />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
