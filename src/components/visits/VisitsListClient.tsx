"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type { Visit } from "@/modules/visits/domain";

export interface VisitsListClientProps {
  initialVisits: readonly Visit[];
  activeOrgName: string;
  activeOrgId?: string;
}

export function VisitsListClient({
  initialVisits = [],
  activeOrgName,
  activeOrgId: _activeOrgId,
}: VisitsListClientProps): ReactNode {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredVisits = initialVisits.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        v.id.toLowerCase().includes(q) ||
        v.employeeUserId.toLowerCase().includes(q) ||
        (v.notes ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: initialVisits.length,
    submitted: initialVisits.filter((v) => v.status === "submitted").length,
    reviewed: initialVisits.filter((v) => v.status === "reviewed").length,
    inProgress: initialVisits.filter((v) => v.status === "in_progress").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <section aria-labelledby="visits-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="visits-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Store Visits &amp; Execution
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrgName}</strong> • Real-time store stop
              execution, on-site telemetry, and photo evidence.
            </p>
          </div>
          <Link href="/trips" className="btn btn-secondary">
            View Active Trips →
          </Link>
        </div>
      </section>

      {/* Quick Summary Cards */}
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
            Total Visits
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
          style={{ padding: "0.875rem 1rem", borderLeft: "3px solid #8B5CF6" }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Reviewed
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              color: "#8B5CF6",
            }}
          >
            {counts.reviewed}
          </span>
        </div>
      </div>

      {/* Telemetry Disclosure Notice */}
      <div
        role="note"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: "0.75rem 1rem",
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
        }}
      >
        <strong>Consent-Driven Telemetry:</strong> Point-in-time check-in and checkout
        timestamps, location accuracy, and completed compliance checklists are securely
        isolated to your active workspace.
      </div>

      {/* Search and Filters */}
      <section
        className="filter-bar"
        aria-label="Filter visits by execution status and store"
      >
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="visit-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by visit ID or rep ID…"
            className="form-input"
            aria-label="Filter store visits"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            htmlFor="visit-status-filter"
            className="form-label"
            style={{ margin: 0 }}
          >
            Status:
          </label>
          <select
            id="visit-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ minWidth: "10rem" }}
          >
            <option value="all">All Statuses ({initialVisits.length})</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted (Completed)</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </section>

      {/* Visits List */}
      {filteredVisits.length === 0 ? (
        <EmptyState
          title={
            initialVisits.length === 0
              ? "No visits recorded yet"
              : "No matching store visits"
          }
          description={
            initialVisits.length === 0
              ? "Store visits will appear here as field representatives check in at scheduled stops."
              : "Try adjusting your search query or status filter."
          }
          actionLabel="View Field Trips"
          actionHref="/trips"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredVisits.map((visit) => (
            <article
              key={visit.id}
              className="card"
              style={{
                borderLeft:
                  visit.status === "in_progress"
                    ? "4px solid var(--brand-primary)"
                    : visit.status === "submitted" || visit.status === "reviewed"
                      ? "4px solid var(--status-success)"
                      : "4px solid var(--border-default)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div className="card-header">
                <div>
                  <Link
                    href={`/visits/${visit.id}`}
                    style={{
                      fontSize: "1.0625rem",
                      fontWeight: 700,
                      color: "var(--brand-dark)",
                      textDecoration: "none",
                    }}
                  >
                    Store Visit #{visit.id.slice(0, 8)}
                  </Link>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Executive ID: <strong>{visit.employeeUserId.slice(0, 8)}</strong> •
                    Stop ID: <strong>{visit.tripStopId.slice(0, 8)}</strong>
                  </p>
                </div>
                <StatusBadge descriptor={getApprovalStatusDescriptor(visit.status)} />
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span>
                  In:{" "}
                  {visit.checkedInAt
                    ? new Date(visit.checkedInAt).toLocaleString()
                    : "Not Checked In"}
                </span>
                <span>
                  Out:{" "}
                  {visit.checkedOutAt
                    ? new Date(visit.checkedOutAt).toLocaleString()
                    : "Not Checked Out"}
                </span>
                {visit.checkInLocation ? (
                  <span style={{ color: "var(--status-success)", fontWeight: 600 }}>
                    ✓ GPS Telemetry Recorded (±
                    {visit.checkInLocation.accuracyMeters ?? 10}m)
                  </span>
                ) : null}
              </div>

              {visit.notes ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    background: "var(--bg-subtle)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {visit.notes}
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-default)",
                }}
              >
                <Link href={`/visits/${visit.id}`} className="btn btn-sm btn-secondary">
                  View Visit Details &amp; Evidence →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
