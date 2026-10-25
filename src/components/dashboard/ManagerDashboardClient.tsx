"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge, getApprovalStatusDescriptor } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import {
  DEMO_TRIPS,
  DEMO_VISITS,
  DEMO_OPERATIONS_TIMELINE,
  type ExtendedDemoTrip,
  type ExtendedDemoVisit,
} from "@/lib/mock-data/fieldtrack-demo-data";

export interface ManagerDashboardClientProps {
  isDemoData: boolean;
}

export function ManagerDashboardClient({ isDemoData: _isDemoData }: ManagerDashboardClientProps): ReactNode {
  const { showToast } = useToast();
  const [selectedTrip, setSelectedTrip] = useState<ExtendedDemoTrip | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<ExtendedDemoVisit | null>(null);
  const [timelineItems, setTimelineItems] = useState(DEMO_OPERATIONS_TIMELINE);
  const [trips, setTrips] = useState(DEMO_TRIPS);
  const [dateRange, setDateRange] = useState("Last 7 Days (Oct 18 - Oct 25)");

  const pendingApprovals = trips.filter((t) => t.status === "submitted");
  const inProgressTrips = trips.filter((t) => t.status === "in_progress");

  function handleQuickApprove(tripId: string) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, status: "approved", decidedAt: new Date().toISOString() } : t
      )
    );
    showToast("Trip approved and scheduled for field execution.", "success");
    setTimelineItems((prev) => [
      {
        id: `ev-${Date.now()}`,
        timestamp: "Just now",
        type: "trip_approved",
        title: "Trip Approved by Manager",
        description: `Manager approved trip #${tripId.slice(0, 8)}. Field rep notified.`,
        badge: "Approved",
        badgeType: "success" as const,
      },
      ...prev,
    ]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Date Range & Operations Bar */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #1B3580 0%, #122660 100%)",
          color: "#FFFFFF",
          padding: "1.5rem",
          borderRadius: "var(--radius-xl)",
          border: "none",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <span style={{ fontSize: "0.8125rem", color: "#FDE68A", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Operational Telemetry Overview
            </span>
            <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.5rem", color: "#FFFFFF", fontFamily: "var(--font-heading)" }}>
              Field Operations &amp; Travel Control
            </h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#D1D5DB", maxWidth: "38rem" }}>
              Monitoring 38 active retail stores across 4 territories. All check-ins GPS-verified with immutable audit trails.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ background: "rgba(255, 255, 255, 0.15)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-md)", fontSize: "0.8125rem" }}>
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  showToast(`Dashboard date range set to ${e.target.value}`, "info");
                }}
                style={{
                  background: "transparent",
                  color: "#FFFFFF",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  outline: "none",
                }}
                aria-label="Dashboard period"
              >
                <option value="Last 7 Days (Oct 18 - Oct 25)" style={{ color: "#111827" }}>Last 7 Days (Oct 18 - Oct 25)</option>
                <option value="Trailing 30 Days (Oct 1 - Oct 31)" style={{ color: "#111827" }}>Trailing 30 Days (Oct 1 - Oct 31)</option>
                <option value="Q4 2026 Target Run" style={{ color: "#111827" }}>Q4 2026 Target Run</option>
              </select>
            </div>
            <Link href="/trips/new" className="btn btn-accent" style={{ color: "#111827", fontWeight: 700 }}>
              + Plan New Field Trip
            </Link>
          </div>
        </div>
      </div>

      {/* 2-Column Operations Grid: Pending Approvals & Today's Active Trips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))", gap: "1.5rem" }}>
        {/* Pending Approvals Queue */}
        <section className="card" aria-labelledby="pending-approvals-heading">
          <div className="card-header">
            <div>
              <h2 id="pending-approvals-heading" className="card-title">
                Pending Approval Queue
              </h2>
              <p className="card-meta">Trips requiring manager policy decision</p>
            </div>
            <span
              style={{
                background: "var(--status-warning-bg)",
                color: "var(--status-warning-text)",
                padding: "0.125rem 0.625rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem",
                fontWeight: 700,
                border: "1px solid var(--status-warning-border)",
              }}
            >
              {pendingApprovals.length} Awaiting
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              ✓ All submitted trips have been reviewed!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {pendingApprovals.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div>
                      <strong style={{ fontSize: "0.9375rem", color: "var(--brand-dark)" }}>{trip.title}</strong>
                      <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                        Rep: <strong>{trip.repName}</strong> • Territory: {trip.territory}
                      </p>
                    </div>
                    <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    <span>📅 {trip.startDate} to {trip.endDate}</span>
                    <span>🏬 {trip.storeCount} planned stops</span>
                    {trip.budgetEstimated ? <span>💵 {trip.budgetEstimated}</span> : null}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSelectedTrip(trip)}
                    >
                      Inspect Itinerary
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleQuickApprove(trip.id)}
                    >
                      Quick Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active & Today's Field Trips */}
        <section className="card" aria-labelledby="active-trips-heading">
          <div className="card-header">
            <div>
              <h2 id="active-trips-heading" className="card-title">
                Active Itineraries &amp; Routes
              </h2>
              <p className="card-meta">Live operations in progress right now</p>
            </div>
            <Link href="/trips" className="btn btn-sm btn-outline">
              View All Trips
            </Link>
          </div>

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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: "0.9375rem" }}>{trip.title}</strong>
                    <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                      Assigned: <strong>{trip.repName}</strong> ({trip.territory})
                    </p>
                  </div>
                  <span
                    style={{
                      background: "var(--status-info-bg)",
                      color: "var(--brand-primary)",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      border: "1px solid var(--status-info-border)",
                    }}
                  >
                    {trip.completedStops} of {trip.storeCount} stops completed
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: "100%", height: "0.5rem", background: "var(--border-default)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(trip.completedStops / trip.storeCount) * 100}%`,
                      height: "100%",
                      background: "var(--brand-primary)",
                      borderRadius: "var(--radius-full)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  <span>Next: {trip.stores.find((s) => s.status === "pending")?.name || "All stops checked out"}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTrip(trip)}
                    style={{ background: "transparent", border: "none", color: "var(--brand-primary)", fontWeight: 600, cursor: "pointer", fontSize: "0.8125rem" }}
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Store Visits & Live Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))", gap: "1.5rem" }}>
        {/* Recent Store Visits Feed */}
        <section className="card" aria-labelledby="recent-visits-heading">
          <div className="card-header">
            <div>
              <h2 id="recent-visits-heading" className="card-title">
                Recent Store Visits &amp; Evidence
              </h2>
              <p className="card-meta">Real-time check-in/out feed with GPS tags</p>
            </div>
            <Link href="/visits" className="btn btn-sm btn-secondary">
              All Visits
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {DEMO_VISITS.slice(0, 4).map((visit) => (
              <div
                key={visit.id}
                style={{
                  padding: "0.875rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: visit.hasException ? "#FFFDF5" : "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.875rem" }}>{visit.storeName}</strong>
                  {visit.hasException ? (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--status-danger)", background: "var(--status-danger-bg)", padding: "0.125rem 0.375rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--status-danger-border)" }}>
                      Exception
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--status-success)", background: "var(--status-success-bg)", padding: "0.125rem 0.375rem", borderRadius: "var(--radius-sm)" }}>
                      GPS Verified
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  <span>Rep: {visit.repName} • {visit.durationMinutes ? `${visit.durationMinutes} mins` : "Active"}</span>
                  <span>{visit.evidence.length} photos</span>
                </div>

                {visit.exceptionReason ? (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--status-danger)" }}>
                    ⚠️ {visit.exceptionReason}
                  </p>
                ) : null}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedVisit(visit)}
                    style={{ background: "transparent", border: "none", color: "var(--brand-primary)", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    View Visit Details &amp; Evidence →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Operations Activity Timeline */}
        <section className="card" aria-labelledby="timeline-heading">
          <div className="card-header">
            <div>
              <h2 id="timeline-heading" className="card-title">
                Live Operations Timeline
              </h2>
              <p className="card-meta">Real-time audit log of team actions</p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Auto-refreshed</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {timelineItems.map((item, index) => (
              <div key={item.id} style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "0.75rem",
                      height: "0.75rem",
                      borderRadius: "50%",
                      background:
                        item.badgeType === "success"
                          ? "var(--status-success)"
                          : item.badgeType === "warning"
                          ? "var(--brand-accent)"
                          : "var(--brand-primary)",
                      marginTop: "0.25rem",
                    }}
                  />
                  {index < timelineItems.length - 1 ? (
                    <div style={{ width: "2px", height: "2.5rem", background: "var(--border-default)", marginTop: "0.25rem" }} />
                  ) : null}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{item.title}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.timestamp}</span>
                  </div>
                  <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Trip Inspection Modal */}
      {selectedTrip ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTrip(null)}
          title={`Trip Itinerary: ${selectedTrip.title}`}
          footer={
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedTrip(null)}
              >
                Close
              </button>
              {selectedTrip.status === "submitted" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    handleQuickApprove(selectedTrip.id);
                    setSelectedTrip(null);
                  }}
                >
                  Approve Trip
                </button>
              ) : null}
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div>
              <span className="card-meta">PURPOSE &amp; OBJECTIVES</span>
              <p style={{ margin: "0.25rem 0 0", color: "var(--text-primary)" }}>{selectedTrip.purpose}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <span className="card-meta">ASSIGNED REPRESENTATIVE</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>{selectedTrip.repName}</p>
              </div>
              <div>
                <span className="card-meta">TRAVEL DATES</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>{selectedTrip.startDate} to {selectedTrip.endDate}</p>
              </div>
            </div>

            <div>
              <span className="card-meta">STOPS &amp; VISIT SEQUENCE</span>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {selectedTrip.stores.map((s) => (
                  <li key={s.id}>
                    <strong>Stop {s.sequence}:</strong> {s.name} —{" "}
                    <span style={{ textTransform: "capitalize", color: s.status === "checked_out" ? "var(--status-success)" : "var(--text-muted)" }}>
                      {s.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {selectedTrip.expectedOutcomes?.length ? (
              <div>
                <span className="card-meta">EXPECTED DELIVERABLES</span>
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", color: "var(--text-secondary)" }}>
                  {selectedTrip.expectedOutcomes.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {/* Visit Evidence Modal */}
      {selectedVisit ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVisit(null)}
          title={`Visit Evidence: ${selectedVisit.storeName}`}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedVisit(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <span className="card-meta">FIELD EXECUTIVE</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>{selectedVisit.repName}</p>
              </div>
              <div>
                <span className="card-meta">GPS TELEMETRY</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600, color: "var(--status-success)" }}>
                  {selectedVisit.gpsCoordinates
                    ? `✓ ${selectedVisit.gpsCoordinates.lat.toFixed(4)}° N, ${Math.abs(selectedVisit.gpsCoordinates.lng).toFixed(4)}° W (±${selectedVisit.gpsCoordinates.accuracyMeters}m)`
                    : "Simulated on-site"}
                </p>
              </div>
            </div>

            <div>
              <span className="card-meta">MERCHANDISING CHECKLIST</span>
              <div style={{ margin: "0.5rem 0 0", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {selectedVisit.checklist.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ color: item.completed ? "var(--status-success)" : "var(--status-danger)", fontWeight: 700 }}>
                      {item.completed ? "✓" : "✕"}
                    </span>
                    <span style={{ textDecoration: item.completed ? "none" : "line-through", color: item.completed ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedVisit.aiSummary ? (
              <div style={{ background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)", borderRadius: "var(--radius-md)", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-primary)" }}>
                  ✨ AI VISIT SYNTHESIS
                </span>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--status-info-text)" }}>
                  {selectedVisit.aiSummary}
                </p>
              </div>
            ) : null}

            <div>
              <span className="card-meta">FIELD OBSERVATIONS</span>
              <p style={{ margin: "0.25rem 0 0", background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
                {selectedVisit.notes}
              </p>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
