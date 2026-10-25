"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { formatUtcTimestamp } from "@/lib/ux/formatting-and-resilience";
import type { Visit } from "@/modules/visits/domain";

export interface VisitsListClientProps {
  initialVisits: readonly Visit[];
  activeOrgName: string;
}

export function VisitsListClient({
  initialVisits,
  activeOrgName,
}: VisitsListClientProps): ReactNode {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredVisits = initialVisits.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="visits-heading">
        <div className="card-header">
          <div>
            <h1 id="visits-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Store Visits &amp; Execution
            </h1>
            <p className="card-meta">
              Organization: <strong>{activeOrgName}</strong> • On-site check-ins, audit
              checklists, photo evidence capture, and checkout telemetry.
            </p>
          </div>
          <Link href="/trips" className="btn btn-primary">
            View Approved Trips
          </Link>
        </div>
      </section>

      <section className="card" aria-label="Filter visits by execution status">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label htmlFor="visit-status-filter" style={{ fontWeight: 600 }}>
            Execution Status:
          </label>
          <select
            id="visit-status-filter"
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
            <option value="all">All Visits</option>
            <option value="in_progress">In Progress (Checked In)</option>
            <option value="submitted">Submitted (Checked Out)</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </section>

      {filteredVisits.length === 0 ? (
        <EmptyState
          title="No store visits found"
          description="Store visits are recorded when checking into stops on approved field trips."
          actionLabel="View Field Trips"
          actionHref="/trips"
        />
      ) : (
        <div className="card-grid">
          {filteredVisits.map((visit) => (
            <article key={visit.id} className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title" style={{ fontSize: "1.125rem" }}>
                    <Link
                      href={`/visits/${visit.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      Visit {visit.id.slice(0, 8)}…
                    </Link>
                  </h2>
                  <p className="card-meta">
                    Trip Stop ID: <code>{visit.tripStopId.slice(0, 8)}…</code>
                  </p>
                </div>
                <StatusBadge descriptor={getApprovalStatusDescriptor(visit.status)} />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.875rem",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Checked In:</span>{" "}
                  <strong>{formatUtcTimestamp(visit.checkedInAt)}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Checked Out:</span>{" "}
                  <strong>
                    {visit.checkedOutAt
                      ? formatUtcTimestamp(visit.checkedOutAt)
                      : "Not checked out"}
                  </strong>
                </div>
              </div>

              {visit.notes ? (
                <p
                  className="card-meta break-long-words"
                  style={{ fontSize: "0.8125rem" }}
                >
                  {visit.notes}
                </p>
              ) : null}

              <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                <Link
                  href={`/visits/${visit.id}`}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                >
                  View Execution &amp; Evidence →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
