"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge, getApprovalStatusDescriptor } from "@/components/ui/StatusBadge";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";
import type { Trip } from "@/modules/trips/domain";
import type { Visit } from "@/modules/visits/domain";

export interface ManagerDashboardClientProps {
  pendingApprovals: readonly Trip[];
  inProgressTrips: readonly Trip[];
  recentVisits: readonly Visit[];
  timelineEvents: readonly OrganizationAuditEvent[];
  activeOrgId: string;
}

function formatAuditAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ManagerDashboardClient({
  pendingApprovals = [],
  inProgressTrips = [],
  recentVisits = [],
  timelineEvents = [],
  activeOrgId: _activeOrgId,
}: ManagerDashboardClientProps): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Date Range & Operations Bar */}
      <div className="welcome-banner">
        <div>
          <span className="welcome-banner-eyebrow">Operational Telemetry Overview</span>
          <h2>Field Operations &amp; Travel Control</h2>
          <p>
            Committed records from authorized workspace. Check-ins, evidence capture, and
            approvals enforced with Row-Level Security.
          </p>
        </div>

        <div className="welcome-banner-actions">
          <Link href="/trips/new" className="btn btn-on-dark" style={{ fontWeight: 700 }}>
            + Plan New Field Trip
          </Link>
        </div>
      </div>

      {/* 2-Column Operations Grid: Pending Approvals & Today's Active Trips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Pending Approvals Queue */}
        <section className="neu-card" aria-labelledby="pending-approvals-heading">
          <div className="card-header">
            <div>
              <h2 id="pending-approvals-heading" className="card-title">
                Pending Approval Queue
              </h2>
              <p className="card-meta">Trips requiring manager policy decision</p>
            </div>
            <span
              style={{
                background:
                  pendingApprovals.length > 0
                    ? "var(--status-warning-bg)"
                    : "var(--status-success-bg)",
                color:
                  pendingApprovals.length > 0
                    ? "var(--status-warning-text)"
                    : "var(--status-success-text)",
                padding: "0.1875rem 0.625rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem",
                fontWeight: 700,
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-neu-raised-sm)",
              }}
            >
              {pendingApprovals.length} Awaiting
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}
            >
              ✓ All submitted trips have been reviewed! No pending approvals.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {pendingApprovals.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.9)",
                    boxShadow: "var(--shadow-neu-raised-sm)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                    transition:
                      "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <strong
                        style={{ fontSize: "0.9375rem", color: "var(--brand-dark)" }}
                      >
                        {trip.title}
                      </strong>
                      <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                        Dates: {trip.startDate} to {trip.endDate}
                      </p>
                    </div>
                    <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-primary">
                      Review Itinerary →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active & Today's Field Trips */}
        <section className="neu-card" aria-labelledby="active-trips-heading">
          <div className="card-header">
            <div>
              <h2 id="active-trips-heading" className="card-title">
                Active Itineraries &amp; Routes
              </h2>
              <p className="card-meta">Field trips currently in progress</p>
            </div>
            <Link href="/trips" className="btn btn-sm btn-outline">
              View All Trips
            </Link>
          </div>

          {inProgressTrips.length === 0 ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}
            >
              No field trips currently in progress.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {inProgressTrips.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    background: "#FAFCFE",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
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
                      <strong style={{ fontSize: "0.9375rem" }}>{trip.title}</strong>
                      <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                        Dates: {trip.startDate} to {trip.endDate}
                      </p>
                    </div>
                    <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <Link
                      href={`/trips/${trip.id}`}
                      style={{
                        color: "var(--brand-primary)",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Store Visits & Live Timeline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Recent Store Visits Feed */}
        <section className="neu-card" aria-labelledby="recent-visits-heading">
          <div className="card-header">
            <div>
              <h2 id="recent-visits-heading" className="card-title">
                Recent Store Visits &amp; Evidence
              </h2>
              <p className="card-meta">Committed store visits with check-in records</p>
            </div>
            <Link href="/visits" className="btn btn-sm btn-secondary">
              All Visits
            </Link>
          </div>

          {recentVisits.length === 0 ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}
            >
              No store visits recorded yet in this workspace.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recentVisits.slice(0, 5).map((visit) => (
                <div
                  key={visit.id}
                  style={{
                    padding: "0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ fontSize: "0.875rem" }}>
                      Visit #{visit.id.slice(0, 8)}
                    </strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "var(--brand-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {visit.status.replace("_", " ")}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8125rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      Check-in:{" "}
                      {visit.checkedInAt
                        ? new Date(visit.checkedInAt).toLocaleDateString()
                        : "Pending"}
                    </span>
                    <span>
                      Check-out:{" "}
                      {visit.checkedOutAt
                        ? new Date(visit.checkedOutAt).toLocaleTimeString()
                        : "Pending"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "0.25rem",
                    }}
                  >
                    <Link
                      href={`/visits/${visit.id}`}
                      style={{
                        color: "var(--brand-primary)",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        textDecoration: "none",
                      }}
                    >
                      View Visit Details &amp; Evidence →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Operations Activity Timeline */}
        <section className="neu-card" aria-labelledby="timeline-heading">
          <div className="card-header">
            <div>
              <h2 id="timeline-heading" className="card-title">
                Live Operations Timeline
              </h2>
              <p className="card-meta">Real-time audit log of team actions</p>
            </div>
            <Link href="/audit" className="btn btn-sm btn-outline">
              Audit Trail
            </Link>
          </div>

          {timelineEvents.length === 0 ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}
            >
              No operational events recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {timelineEvents.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "0.75rem",
                        height: "0.75rem",
                        borderRadius: "50%",
                        background: "var(--brand-cyan)",
                        boxShadow: "0 0 8px rgba(56, 217, 214, 0.7)",
                        marginTop: "0.25rem",
                      }}
                    />
                    {index < Math.min(timelineEvents.length, 5) - 1 ? (
                      <div
                        style={{
                          width: "2px",
                          height: "2.5rem",
                          background: "var(--border-default)",
                          marginTop: "0.25rem",
                        }}
                      />
                    ) : null}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <strong
                        style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}
                      >
                        {formatAuditAction(item.actionType)}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0.125rem 0 0",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Entity: {item.entityType} (
                      {item.entityId ? item.entityId.slice(0, 8) : "—"})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
