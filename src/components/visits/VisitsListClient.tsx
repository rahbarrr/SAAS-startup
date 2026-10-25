"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type { Visit } from "@/modules/visits/domain";
import type { ExtendedDemoVisit } from "@/lib/mock-data/fieldtrack-demo-data";

export interface VisitsListClientProps {
  initialVisits: readonly (Visit | ExtendedDemoVisit)[];
  activeOrgName: string;
  isDemo?: boolean;
  activeOrgId?: string;
}

function normalizeVisit(v: Visit | ExtendedDemoVisit): ExtendedDemoVisit {
  if ("storeName" in v && "repName" in v) {
    return v as ExtendedDemoVisit;
  }
  return {
    id: v.id,
    tripId: "trip-01",
    tripTitle: "Assigned Trip Route",
    storeId: "store-01",
    storeName: "Retail Store Visit",
    storeCode: "STR-001",
    storeAddress: "Physical Retail Address",
    repId: v.employeeUserId,
    repName: `Representative (${v.employeeUserId.slice(0, 8)})`,
    scheduledTime: "09:00 AM",
    checkInTime: v.checkedInAt ? v.checkedInAt.slice(11, 16) : null,
    checkOutTime: v.checkedOutAt ? v.checkedOutAt.slice(11, 16) : null,
    status: v.status,
    durationMinutes: 45,
    gpsVerified: Boolean(v.checkInLocation),
    gpsCoordinates:
      v.checkInLocation &&
      v.checkInLocation.latitude !== null &&
      v.checkInLocation.longitude !== null
        ? {
            lat: v.checkInLocation.latitude,
            lng: v.checkInLocation.longitude,
            accuracyMeters: v.checkInLocation.accuracyMeters ?? 10,
          }
        : null,
    checklist: [],
    evidence: [],
    notes: v.notes ?? "",
    aiSummary: null,
    hasException: false,
    exceptionReason: undefined,
  };
}

export function VisitsListClient({
  initialVisits,
  activeOrgName,
  isDemo = false,
  activeOrgId: _activeOrgId,
}: VisitsListClientProps): ReactNode {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<ExtendedDemoVisit | null>(null);

  const visits: ExtendedDemoVisit[] = (initialVisits ?? []).map(normalizeVisit);

  const filteredVisits = visits.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        v.storeName.toLowerCase().includes(q) ||
        v.repName.toLowerCase().includes(q) ||
        v.storeCode.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
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
              Workspace: <strong>{activeOrgName}</strong> • On-site check-ins, itemized compliance checklists, signed photo evidence, and checkout telemetry.
            </p>
          </div>
          <Link href="/trips" className="btn btn-primary">
            View Approved Itineraries
          </Link>
        </div>
      </section>

      {/* Telemetry / Demo Notice Banner */}
      <div
        role="note"
        style={{
          background: "var(--status-info-bg)",
          border: "1px solid var(--status-info-border)",
          borderRadius: "var(--radius-md)",
          padding: "0.875rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          fontSize: "0.875rem",
          color: "var(--brand-dark)",
        }}
      >
        <div>
          {isDemo ? (
            <>
              <strong>⚡ Interactive Demo Mode:</strong> Viewing demonstration retail store visits. Real field check-ins and checkouts use consent-driven device sensors.
            </>
          ) : (
            <>
              <strong>Consent-Driven Telemetry:</strong> Point-in-time check-in and checkout timestamps, location accuracy, and completed compliance checklists are securely isolated to your active workspace.
            </>
          )}
        </div>
        {isDemo ? (
          <Link href="/login" style={{ color: "var(--brand-primary)", fontWeight: 700, textDecoration: "none" }}>
            Sign In →
          </Link>
        ) : null}
      </div>

      {/* Search and Filters */}
      <section className="filter-bar" aria-label="Filter visits by execution status and store">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="visit-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by store name, code, rep, or notes…"
            className="form-input"
            aria-label="Search store visits"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="visit-status-filter" className="form-label" style={{ margin: 0 }}>
            Status:
          </label>
          <select
            id="visit-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ minWidth: "12rem" }}
          >
            <option value="all">All Execution States ({visits.length})</option>
            <option value="in_progress">In Progress (Checked In)</option>
            <option value="submitted">Submitted (Checked Out)</option>
            <option value="reviewed">Reviewed by Manager</option>
          </select>
        </div>
      </section>

      {/* Visits Feed */}
      {filteredVisits.length === 0 ? (
        <EmptyState
          title={visits.length === 0 ? "No store visits recorded yet" : "No store visits match your search"}
          description={
            visits.length === 0
              ? "Visits are created when field employees check in to planned store stops on approved trips."
              : "Try clearing search filters to see all recorded store visits."
          }
          actionLabel="View All Field Trips"
          actionHref="/trips"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredVisits.map((visit) => {
            const completedChecklist = (visit.checklist ?? []).filter((c) => c.completed).length;
            const totalChecklist = (visit.checklist ?? []).length;

            return (
              <article
                key={visit.id}
                className="card"
                style={{
                  borderLeft: visit.hasException
                    ? "4px solid var(--status-danger)"
                    : visit.status === "reviewed"
                    ? "4px solid var(--status-success)"
                    : visit.status === "submitted"
                    ? "4px solid var(--brand-primary)"
                    : "4px solid var(--border-default)",
                }}
              >
                <div className="card-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link
                        href={`/visits/${visit.id}`}
                        style={{
                          fontSize: "1.0625rem",
                          fontWeight: 700,
                          color: "var(--brand-dark)",
                          textDecoration: "none",
                        }}
                      >
                        {visit.storeName}
                      </Link>
                      <span className="font-mono text-muted text-sm">[{visit.storeCode}]</span>
                    </div>
                    <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                      Executive: <strong>{visit.repName}</strong> • Trip: {visit.tripTitle}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {visit.hasException ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--status-danger)",
                          background: "var(--status-danger-bg)",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--status-danger-border)",
                        }}
                      >
                        ⚠️ Exception
                      </span>
                    ) : null}
                    <StatusBadge descriptor={getApprovalStatusDescriptor(visit.status)} />
                  </div>
                </div>

                {/* Telemetry Row */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                    padding: "0.75rem 1rem",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div>
                    <span className="card-meta">CHECK-IN:</span>{" "}
                    <strong>{visit.checkInTime ?? "Not checked in"}</strong>
                  </div>
                  <div>
                    <span className="card-meta">CHECK-OUT:</span>{" "}
                    <strong>{visit.checkOutTime ?? "In progress"}</strong>
                  </div>
                  <div>
                    <span className="card-meta">DURATION:</span>{" "}
                    <strong>{visit.durationMinutes ? `${visit.durationMinutes} mins` : "Active now"}</strong>
                  </div>
                  <div>
                    <span className="card-meta">GPS:</span>{" "}
                    <span style={{ color: visit.gpsVerified ? "var(--status-success)" : "var(--text-muted)", fontWeight: 600 }}>
                      {visit.gpsVerified ? "✓ Verified on-site" : "Pending check-in"}
                    </span>
                  </div>
                  <div>
                    <span className="card-meta">CHECKLIST:</span>{" "}
                    <strong style={{ color: completedChecklist === totalChecklist ? "var(--status-success)" : "var(--text-primary)" }}>
                      {completedChecklist}/{totalChecklist} completed
                    </strong>
                  </div>
                  <div>
                    <span className="card-meta">PHOTO PROOF:</span>{" "}
                    <strong>{visit.evidence.length} uploaded</strong>
                  </div>
                </div>

                {/* Exception Alert or Notes */}
                {visit.exceptionReason ? (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--status-danger-bg)",
                      border: "1px solid var(--status-danger-border)",
                      fontSize: "0.8125rem",
                      color: "var(--status-danger-text)",
                    }}
                  >
                    <strong>Flagged Anomaly:</strong> {visit.exceptionReason}
                  </div>
                ) : null}

                {/* AI Summary Preview */}
                {visit.aiSummary ? (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--status-info-bg)",
                      border: "1px solid var(--status-info-border)",
                      fontSize: "0.8125rem",
                      color: "var(--status-info-text)",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>✨ AI Field Summary:</span> {visit.aiSummary}
                  </div>
                ) : null}

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--border-default)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSelectedVisit(visit)}
                  >
                    Quick Inspect Proof &amp; Tasks
                  </button>

                  <Link href={`/visits/${visit.id}`} className="btn btn-sm btn-outline">
                    Open Visit Detail &amp; Execution →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Visit Quick Inspection Modal */}
      {selectedVisit ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVisit(null)}
          title={`Visit Evidence: ${selectedVisit.storeName}`}
          footer={
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedVisit(null)}
              >
                Close
              </button>
              <Link href={`/visits/${selectedVisit.id}`} className="btn btn-primary">
                Open Full Execution Form
              </Link>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <span className="card-meta">STORE &amp; CODE</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>{selectedVisit.storeName} ({selectedVisit.storeCode})</p>
                <span className="card-meta">{selectedVisit.storeAddress}</span>
              </div>
              <div>
                <span className="card-meta">GPS TELEMETRY</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600, color: "var(--status-success)" }}>
                  {selectedVisit.gpsCoordinates
                    ? `✓ ${selectedVisit.gpsCoordinates.lat}° N, ${selectedVisit.gpsCoordinates.lng}° W (±${selectedVisit.gpsCoordinates.accuracyMeters}m)`
                    : "Simulated demonstration"}
                </p>
              </div>
            </div>

            <div>
              <span className="card-meta">COMPLIANCE CHECKLIST</span>
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {selectedVisit.checklist.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ color: c.completed ? "var(--status-success)" : "var(--status-danger)", fontWeight: 700 }}>
                      {c.completed ? "✓" : "✕"}
                    </span>
                    <span style={{ color: c.completed ? "var(--text-primary)" : "var(--text-muted)" }}>{c.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedVisit.evidence.length > 0 ? (
              <div>
                <span className="card-meta">PHOTO EVIDENCE GALLERY</span>
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {selectedVisit.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-subtle)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span>📷</span>
                      <div>
                        <strong>{ev.fileName}</strong>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{ev.fileSize} • {ev.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <span className="card-meta">EXECUTIVE NOTES</span>
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
