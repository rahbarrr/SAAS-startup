"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type { Trip } from "@/modules/trips/domain";

export interface TripsListClientProps {
  initialTrips: readonly Trip[];
  activeOrgName: string;
}

export function TripsListClient({
  initialTrips,
  activeOrgName,
}: TripsListClientProps): ReactNode {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredTrips = initialTrips.filter((trip) => {
    if (statusFilter !== "all" && trip.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        trip.title.toLowerCase().includes(q) || trip.purpose.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="trips-heading">
        <div className="card-header">
          <div>
            <h1 id="trips-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Field Trips
            </h1>
            <p className="card-meta">
              Organization: <strong>{activeOrgName}</strong> • Manage multi-store routes,
              submit for manager approval, and review audit history.
            </p>
          </div>
          <Link href="/trips/new" className="btn btn-primary">
            + Create Trip Draft
          </Link>
        </div>
      </section>

      <section className="card" aria-label="Filter trips by workflow status and keyword">
        <div
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}
        >
          <div style={{ flex: "1 1 12rem" }}>
            <label
              htmlFor="trip-search"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Search Trips
            </label>
            <input
              id="trip-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or purpose…"
              style={{
                width: "100%",
                padding: "0.375rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="trip-status-filter"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Workflow Status
            </label>
            <select
              id="trip-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg-surface)",
                fontWeight: 600,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </section>

      {filteredTrips.length === 0 ? (
        <EmptyState
          title="No field trips match your filters"
          description="Create a draft trip plan with ordered store stops and submit it for manager approval."
          actionLabel="Create Trip Draft"
          actionHref="/trips/new"
        />
      ) : (
        <div className="card-grid">
          {filteredTrips.map((trip) => (
            <article key={trip.id} className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title" style={{ fontSize: "1.125rem" }}>
                    <Link
                      href={`/trips/${trip.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {trip.title}
                    </Link>
                  </h2>
                  <p className="card-meta">
                    📅 {trip.startDate} to {trip.endDate}
                  </p>
                </div>
                <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
              </div>

              <p className="card-meta break-long-words">{trip.purpose}</p>

              {trip.decisionNote ? (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-subtle, #f9fafb)",
                    border: "1px solid var(--border-subtle, #e5e7eb)",
                  }}
                >
                  <strong>Reviewer Note:</strong> {trip.decisionNote}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "0.75rem",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Link
                  href={`/trips/${trip.id}`}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                >
                  View Details &amp; Audit →
                </Link>

                {trip.status === "draft" || trip.status === "changes_requested" ? (
                  <Link
                    href={`/trips/${trip.id}/edit`}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                  >
                    Edit Draft
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
