"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { GoalRingCard } from "@/components/ui/GoalRingCard";
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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
    <div
      className="mobile-page-stack"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
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

      {/* Quick Status Circular Ring KPI Strip */}
      <div className="kpi-grid kpi-grid--four">
        <GoalRingCard
          title="Total Planned"
          subtitle="Itineraries on record"
          value={counts.total}
          totalLabel={`in ${activeOrgName}`}
          percentage={100}
          tone="blue"
          icon="🗺️"
          primarySegmentLabel={`Total (${counts.total})`}
          secondarySegmentLabel="Active Scope"
        />

        <GoalRingCard
          title="Awaiting Approval"
          subtitle="Manager review required"
          value={counts.submitted}
          totalLabel={`of ${counts.total} itineraries`}
          percentage={
            counts.total > 0 ? Math.round((counts.submitted / counts.total) * 100) : 0
          }
          tone="obsidian"
          icon="⚖️"
          primarySegmentLabel={`Pending (${counts.submitted})`}
          secondarySegmentLabel={`Reviewed (${Math.max(0, counts.total - counts.submitted)})`}
        />

        <GoalRingCard
          title="In Progress"
          subtitle="Currently on the road"
          value={counts.inProgress}
          totalLabel={`of ${counts.total} itineraries`}
          percentage={
            counts.total > 0 ? Math.round((counts.inProgress / counts.total) * 100) : 0
          }
          tone="blue"
          icon="📍"
          primarySegmentLabel={`Active (${counts.inProgress})`}
          secondarySegmentLabel="60s GPS Sync"
        />

        <GoalRingCard
          title="Completed"
          subtitle="Finished field visits"
          value={counts.completed}
          totalLabel={`of ${counts.total} itineraries`}
          percentage={
            counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0
          }
          tone="obsidian"
          icon="✓"
          primarySegmentLabel={`Done (${counts.completed})`}
          secondarySegmentLabel="Verified"
        />
      </div>

      {/* Filter and View Controls */}
      <section
        className="filter-bar"
        aria-label="Filter trips by workflow status and keyword"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: "1 1 18rem",
            minWidth: 0,
          }}
        >
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 0 }}>
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

          <button
            type="button"
            className="btn btn-sm btn-secondary mobile-filter-toggle-btn"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            aria-expanded={showMobileFilters}
          >
            {showMobileFilters ? "Hide Filters" : `Filters${statusFilter !== "all" ? " • 1" : ""}`}
          </button>
        </div>

        <div
          className={`filter-bar-secondary-controls ${showMobileFilters ? "is-open" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 auto" }}>
            <label
              htmlFor="trip-status-filter"
              className="form-label"
              style={{ margin: 0, fontSize: "0.8125rem" }}
            >
              Status:
            </label>
            <select
              id="trip-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ minWidth: "10.5rem", flex: 1 }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filteredTrips.map((trip) => {
            const isManagerOrAdmin = currentRole === "admin" || currentRole === "manager";
            const canEdit =
              trip.status === "draft" || trip.status === "changes_requested";

            return (
              <article
                key={trip.id}
                className="card mobile-trip-card"
                style={{
                  transition: "all 0.15s ease",
                }}
              >
                <div className="card-header" style={{ gap: "0.5rem" }}>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0, flex: 1 }}
                  >
                    <div
                      className="flex-row-center"
                      style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.375rem" }}
                    >
                      <Link
                        href={`/trips/${trip.id}`}
                        className="mobile-trip-card-title"
                        style={{
                          textDecoration: "none",
                          color: "var(--text-primary)",
                          fontWeight: 700,
                          fontSize: "1.0625rem",
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
                      📅 <strong>{trip.startDate}</strong> →{" "}
                      <strong>{trip.endDate}</strong> • Rep:{" "}
                      <code>{trip.ownerUserId.slice(0, 8)}</code>
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    paddingTop: "0.625rem",
                    marginTop: "0.5rem",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      flex: "1 1 12rem",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>Purpose:</strong> {trip.purpose}
                  </span>
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
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
