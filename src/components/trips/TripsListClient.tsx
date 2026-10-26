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
              Workspace: <strong>{activeOrgName}</strong> • Plan multi-store itineraries,
              submit for manager approval, and review outcomes.
            </p>
          </div>
          <Link href="/trips/new" className="btn btn-primary">
            + Plan New Trip
          </Link>
        </div>
      </section>

      {/* Quick Status KPI Strip */}
      <div
        className="card-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}
      >
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--brand-primary)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Total Planned
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
            }}
          >
            {counts.total}
          </span>
        </div>
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--brand-accent)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Awaiting Approval
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              color: "var(--brand-accent)",
            }}
          >
            {counts.submitted}
          </span>
        </div>
        <div
          className="card"
          style={{ padding: "0.875rem 1rem", borderLeft: "3px solid #3B82F6" }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            In Progress
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              color: "var(--brand-primary)",
            }}
          >
            {counts.inProgress}
          </span>
        </div>
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--status-success)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Completed
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              color: "var(--status-success)",
            }}
          >
            {counts.completed}
          </span>
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
            style={{ minWidth: "10rem" }}
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
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                  >
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
                      Owner: <strong>{trip.ownerUserId.slice(0, 8)}</strong> • Dates:{" "}
                      <strong>
                        {trip.startDate} to {trip.endDate}
                      </strong>
                    </p>
                  </div>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {trip.purpose}
                </p>

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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      📅 {trip.startDate} to {trip.endDate}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {canEdit ? (
                      <Link
                        href={`/trips/${trip.id}/edit`}
                        className="btn btn-sm btn-secondary"
                      >
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 className="card-title" style={{ fontSize: "1.125rem" }}>
              Field Route Schedule
            </h2>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              All dates UTC
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                style={{
                  padding: "0.75rem 1rem",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.9375rem" }}>{trip.title}</strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    {trip.startDate} to {trip.endDate}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                  <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-secondary">
                    View →
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
