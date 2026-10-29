"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { useCurrentRole } from "@/components/ui/RoleContext";
import type { Trip } from "@/modules/trips/domain";

export interface TripsListClientProps {
  initialTrips: readonly Trip[];
  activeOrgName: string;
  activeOrgId?: string;
}

export function TripsListClient({
  initialTrips = [],
  activeOrgName,
  activeOrgId: _activeOrgId,
}: TripsListClientProps): ReactNode {
  const { currentRole } = useCurrentRole();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const filteredTrips = initialTrips.filter((trip) => {
    if (statusFilter !== "all" && trip.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        trip.title.toLowerCase().includes(q) ||
        trip.purpose.toLowerCase().includes(q) ||
        trip.ownerUserId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: initialTrips.length,
    submitted: initialTrips.filter((t) => t.status === "submitted").length,
    inProgress: initialTrips.filter((t) => t.status === "in_progress").length,
    completed: initialTrips.filter((t) => t.status === "completed").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <section className="page-header" aria-labelledby="trips-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Field Travel Logistics</p>
          <h1 id="trips-heading" className="page-title">
            Field Trips
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrgName}</strong> • Plan multi-store itineraries,
            submit for manager approval, and review outcomes.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/trips/new" className="btn btn-primary">
            + Plan New Trip
          </Link>
        </div>
      </section>

      {/* Quick Status KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--primary">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Planned</span>
            <span className="kpi-icon" aria-hidden="true">
              🗺️
            </span>
          </div>
          <div className="kpi-value">{counts.total}</div>
          <p className="kpi-footnote">Itineraries on record</p>
        </div>

        <div className="kpi-card kpi-card--warning">
          <div className="kpi-card-top">
            <span className="kpi-label">Awaiting Approval</span>
            <span className="kpi-icon" aria-hidden="true">
              ⚖️
            </span>
          </div>
          <div className="kpi-value" style={{ color: "var(--status-warning-text)" }}>
            {counts.submitted}
          </div>
          <p className="kpi-footnote">Manager review required</p>
        </div>

        <div className="kpi-card kpi-card--info">
          <div className="kpi-card-top">
            <span className="kpi-label">In Progress</span>
            <span className="kpi-icon" aria-hidden="true">
              📍
            </span>
          </div>
          <div className="kpi-value" style={{ color: "var(--status-info-text)" }}>
            {counts.inProgress}
          </div>
          <p className="kpi-footnote">Currently on the road</p>
        </div>

        <div className="kpi-card kpi-card--success">
          <div className="kpi-card-top">
            <span className="kpi-label">Completed</span>
            <span className="kpi-icon" aria-hidden="true">
              ✓
            </span>
          </div>
          <div className="kpi-value" style={{ color: "var(--status-success)" }}>
            {counts.completed}
          </div>
          <p className="kpi-footnote">Finished field visits</p>
        </div>
      </div>

      {/* Filter and View Controls */}
      <section
        className="filter-bar"
        aria-label="Filter trips by workflow status and keyword"
      >
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="trip-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, purpose, owner…"
            className="form-input"
            aria-label="Search field trips"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            htmlFor="trip-status-filter"
            className="form-label"
            style={{ margin: 0 }}
          >
            Status:
          </label>
          <select
            id="trip-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ minWidth: "11rem" }}
          >
            <option value="all">All Statuses ({initialTrips.length})</option>
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
          title={initialTrips.length === 0 ? "No trips yet" : "No matching field trips"}
          description={
            initialTrips.length === 0
              ? "Plan a multi-store field trip, assign destination stops, and submit for manager approval."
              : "Try broadening your status filters or search query."
          }
          actionLabel="+ Plan New Trip"
          actionHref="/trips/new"
        />
      ) : viewMode === "list" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredTrips.map((trip) => {
            const isManagerOrAdmin = currentRole === "admin" || currentRole === "manager";
            const canEdit =
              trip.status === "draft" || trip.status === "changes_requested";

            return (
              <article
                key={trip.id}
                className="card"
                style={{
                  transition: "all 0.15s ease",
                }}
              >
                <div className="card-header">
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                  >
                    <div className="flex-row-center">
                      <Link
                        href={`/trips/${trip.id}`}
                        style={{
                          textDecoration: "none",
                          color: "var(--text-primary)",
                          fontWeight: 700,
                          fontSize: "1.125rem",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {trip.title}
                      </Link>
                      <StatusBadge
                        descriptor={getApprovalStatusDescriptor(trip.status)}
                      />
                    </div>
                    <p className="card-meta" style={{ margin: 0 }}>
                      Dates: <strong>{trip.startDate}</strong> to{" "}
                      <strong>{trip.endDate}</strong> • Representative:{" "}
                      <code>{trip.ownerUserId}</code>
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-secondary">
                      View Details →
                    </Link>
                    {canEdit ? (
                      <Link
                        href={`/trips/${trip.id}/edit`}
                        className="btn btn-sm btn-outline"
                      >
                        Edit
                      </Link>
                    ) : null}
                    {isManagerOrAdmin && trip.status === "submitted" ? (
                      <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-primary">
                        Review Policy
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    <strong>Purpose:</strong> {trip.purpose}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    Created: {new Date(trip.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Calendar / Schedule View */
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 className="card-title" style={{ marginBottom: "1rem" }}>
            Scheduled Itineraries Calendar View
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div>
                  <strong>{trip.title}</strong>
                  <div className="card-meta" style={{ marginTop: "0.25rem" }}>
                    📅 {trip.startDate} → {trip.endDate} • {trip.ownerUserId}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                  <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-secondary">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
