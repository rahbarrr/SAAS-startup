"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useCurrentRole } from "@/components/ui/RoleContext";
import { formatUtcTimestamp } from "@/lib/ux/formatting-and-resilience";
import type { Trip, TripDecisionStatus } from "@/modules/trips/domain";
import type { ExtendedDemoTrip } from "@/lib/mock-data/fieldtrack-demo-data";

export interface ApprovalsInboxClientProps {
  initialTrips: readonly (Trip | ExtendedDemoTrip)[];
  activeOrgId: string;
  activeOrgName: string;
  currentUserId: string;
  isDemo?: boolean;
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

interface DecisionHistoryEntry {
  id: string;
  tripTitle: string;
  repName: string;
  decision: TripDecisionStatus;
  note: string;
  decidedAt: string;
  decidedBy: string;
}

export function ApprovalsInboxClient({
  initialTrips,
  activeOrgId,
  activeOrgName,
  currentUserId,
  isDemo = false,
}: ApprovalsInboxClientProps): ReactNode {
  const { showToast } = useToast();
  const { currentRole } = useCurrentRole();

  // Normalize initialTrips
  const [trips, setTrips] = useState<ExtendedDemoTrip[]>(
    (initialTrips ?? []).map(normalizeTrip)
  );
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  // Modal dialog states
  const [inspectTrip, setInspectTrip] = useState<ExtendedDemoTrip | null>(null);
  const [actionTrip, setActionTrip] = useState<ExtendedDemoTrip | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decision history
  const [decisionHistory, setDecisionHistory] = useState<DecisionHistoryEntry[]>([
    {
      id: "hist-01",
      tripTitle: "Eastside Supercenter Inventory & Audit Verification",
      repName: "Aisha Patel",
      decision: "approved",
      note: "Approved. Coordinate with store director before photographing receiving bays.",
      decidedAt: "2026-10-24 15:30 UTC",
      decidedBy: "Marcus Vance (Manager)",
    },
    {
      id: "hist-02",
      tripTitle: "Bay Area Refrigeration & Cooler Anomaly Inspection",
      repName: "David Chen",
      decision: "changes_requested",
      note: "Please append calibration certificate ID and confirm if maintenance vendor has been notified.",
      decidedAt: "2026-10-25 08:30 UTC",
      decidedBy: "Marcus Vance (Manager)",
    },
  ]);

  const pendingTrips = trips.filter((t) => t.status === "submitted");
  const approvedTrips = trips.filter((t) => t.status === "approved" || t.status === "in_progress" || t.status === "completed");
  const rejectedTrips = trips.filter((t) => t.status === "rejected" || t.status === "changes_requested");

  const displayedList =
    activeTab === "pending"
      ? pendingTrips
      : activeTab === "approved"
      ? approvedTrips
      : rejectedTrips;

  const filteredList = displayedList.filter((trip) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      trip.title.toLowerCase().includes(q) ||
      trip.repName.toLowerCase().includes(q) ||
      trip.territory.toLowerCase().includes(q) ||
      trip.purpose.toLowerCase().includes(q)
    );
  });

  function openDecisionDialog(trip: ExtendedDemoTrip, choice: TripDecisionStatus) {
    if (trip.ownerUserId === currentUserId) {
      showToast("Self-approval is forbidden: another manager or administrator must review and decide your trip.", "error");
      return;
    }
    setError(null);
    setActionTrip(trip);
    setDecisionChoice(choice);
    setDecisionNote(choice === "approved" ? "Approved for field execution according to plan." : "");
  }

  async function handleConfirmDecision(e: FormEvent) {
    e.preventDefault();
    if (!actionTrip) return;

    if (actionTrip.ownerUserId === currentUserId) {
      setError("Self-approval is forbidden: you cannot approve or decide your own field trip.");
      return;
    }

    if (decisionChoice !== "approved" && decisionNote.trim().length === 0) {
      setError("A detailed explanatory note is required when requesting changes or rejecting a trip.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!isDemo && activeOrgId) {
        const res = await fetch(`/api/orgs/${activeOrgId}/trips/${actionTrip.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decisionChoice,
            note: decisionNote.trim() || (decisionChoice === "approved" ? "Approved by manager." : undefined),
          }),
        });

        const payload = (await res.json()) as {
          data?: unknown;
          error?: { message?: string };
        };

        if (!res.ok || payload.error) {
          throw new Error(payload.error?.message || "Failed to record approval decision.");
        }
      }

      setTrips((prev) =>
        prev.map((t) =>
          t.id === actionTrip.id
            ? {
                ...t,
                status: decisionChoice === "approved" ? "approved" : decisionChoice === "rejected" ? "rejected" : "changes_requested",
                decidedAt: new Date().toISOString(),
                decisionNote: decisionNote.trim(),
              }
            : t
        )
      );

      setDecisionHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          tripTitle: actionTrip.title,
          repName: actionTrip.repName,
          decision: decisionChoice,
          note: decisionNote.trim() || (decisionChoice === "approved" ? "Approved by manager." : "Decision recorded."),
          decidedAt: "Just now",
          decidedBy: currentRole === "admin" ? "Admin" : "Manager",
        },
        ...prev,
      ]);

      const label =
        decisionChoice === "approved"
          ? "Approved"
          : decisionChoice === "rejected"
          ? "Rejected"
          : "Changes Requested";

      showToast(`Trip decision recorded: ${label} for "${actionTrip.title}".`, "success");
      setActionTrip(null);
      setDecisionNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to record approval decision.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <section aria-labelledby="inbox-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="inbox-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Manager Approval Inbox
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrgName}</strong> • Policy compliance oversight for employee travel requests and multi-store itineraries.
            </p>
          </div>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--status-info-bg)",
              color: "var(--brand-primary)",
              fontWeight: 700,
              fontSize: "0.8125rem",
              border: "1px solid var(--status-info-border)",
            }}
          >
            {pendingTrips.length} Pending Review
          </span>
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
            ⚡ <strong>Interactive Demo Mode:</strong> Reviewing simulated approval requests. Sign in to your workspace to process live trip decisions.
          </span>
          <Link href="/login" style={{ color: "var(--brand-primary)", fontWeight: 700, textDecoration: "none" }}>
            Sign In →
          </Link>
        </div>
      ) : null}

      {/* Tabs and Search Bar */}
      <section className="filter-bar" aria-label="Approvals tabs and search filter">
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            ⏳ Pending Approval ({pendingTrips.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            ✓ Approved ({approvedTrips.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            ✕ Changes / Rejected ({rejectedTrips.length})
          </button>
        </div>

        <div className="search-input-wrapper" style={{ maxWidth: "20rem", marginLeft: "auto" }}>
          <span className="search-icon">🔍</span>
          <input
            id="approvals-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, rep, or territory…"
            className="form-input"
            aria-label="Search approval requests"
          />
        </div>
      </section>

      {/* Approvals Cards or Table */}
      {filteredList.length === 0 ? (
        <EmptyState
          title={
            activeTab === "pending"
              ? "All submitted trips have been reviewed"
              : `No ${activeTab} trips found`
          }
          description="Trip plans submitted by field employees will appear in this approval queue."
          actionLabel="View Trips Directory"
          actionHref="/trips"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredList.map((trip) => {
            const isSelfSubmitted = trip.ownerUserId === currentUserId;

            return (
              <article
                key={trip.id}
                className="card"
                style={{
                  borderLeft:
                    trip.status === "submitted"
                      ? "4px solid var(--brand-accent)"
                      : trip.status === "approved"
                      ? "4px solid var(--status-success)"
                      : "4px solid var(--status-danger)",
                }}
              >
                <div className="card-header">
                  <div>
                    <strong style={{ fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
                      {trip.title}
                    </strong>
                    <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                      Requested by <strong>{trip.repName}</strong> ({trip.territory}) • Submitted: {formatUtcTimestamp(trip.submittedAt ?? trip.createdAt)}
                    </p>
                  </div>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                </div>

                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  {trip.purpose}
                </p>

                {/* Itinerary highlights */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.8125rem", color: "var(--text-secondary)", background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
                  <div>
                    <span className="card-meta">TRAVEL DATES:</span>{" "}
                    <strong>{trip.startDate} to {trip.endDate}</strong>
                  </div>
                  <div>
                    <span className="card-meta">STOPS:</span>{" "}
                    <strong>{trip.storeCount} retail outlets</strong>
                  </div>
                  {trip.budgetEstimated ? (
                    <div>
                      <span className="card-meta">ESTIMATED BUDGET:</span>{" "}
                      <strong>{trip.budgetEstimated}</strong>
                    </div>
                  ) : null}
                  {trip.travelMode ? (
                    <div>
                      <span className="card-meta">TRANSPORT:</span>{" "}
                      <strong>{trip.travelMode}</strong>
                    </div>
                  ) : null}
                </div>

                {trip.decisionNote ? (
                  <div style={{ fontSize: "0.8125rem", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", background: "#FFFBEB", border: "1px solid var(--status-warning-border)" }}>
                    <strong style={{ color: "var(--status-warning-text)" }}>Manager Decision Note:</strong> {trip.decisionNote}
                  </div>
                ) : null}

                {/* Actions Bar */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--border-default)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setInspectTrip(trip)}
                  >
                    Inspect Full Itinerary
                  </button>

                  {trip.status === "submitted" ? (
                    isSelfSubmitted ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Self-approval restricted by policy (peer manager required)
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ color: "var(--brand-accent)" }}
                          onClick={() => openDecisionDialog(trip, "changes_requested")}
                        >
                          Request Changes
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => openDecisionDialog(trip, "rejected")}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => openDecisionDialog(trip, "approved")}
                        >
                          ✓ Approve Trip
                        </button>
                      </div>
                    )
                  ) : (
                    <Link href={`/trips/${trip.id}`} className="btn btn-sm btn-outline">
                      View Audit Details →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Decision Confirmation & Note Modal */}
      {actionTrip ? (
        <Modal
          isOpen={true}
          onClose={() => setActionTrip(null)}
          title={`Confirm Decision: ${decisionChoice.replace("_", " ").toUpperCase()}`}
          footer={
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActionTrip(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${
                  decisionChoice === "approved"
                    ? "btn-primary"
                    : decisionChoice === "rejected"
                    ? "btn-danger"
                    : "btn-accent"
                }`}
                onClick={handleConfirmDecision}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Recording Decision…" : `Confirm ${decisionChoice.replace("_", " ")}`}
              </button>
            </div>
          }
        >
          <form onSubmit={handleConfirmDecision} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
              <strong style={{ display: "block", fontSize: "0.9375rem" }}>{actionTrip.title}</strong>
              <span className="card-meta">
                Rep: {actionTrip.repName} • Dates: {actionTrip.startDate} to {actionTrip.endDate} • {actionTrip.storeCount} stops
              </span>
            </div>

            {error ? <div className="form-error">⚠️ {error}</div> : null}

            <div className="form-group">
              <label htmlFor="decision-note-input" className="form-label">
                {decisionChoice === "approved"
                  ? "Approval Note (Optional)"
                  : "Explanatory Reason / Requirements (Mandatory)"}
              </label>
              <textarea
                id="decision-note-input"
                className="form-textarea"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={
                  decisionChoice === "approved"
                    ? "e.g., Approved for field execution as planned."
                    : "e.g., Please adjust visit duration at Metro Hypermarket or include cooler calibration logs."
                }
                rows={3}
                required={decisionChoice !== "approved"}
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Itinerary Inspection Modal */}
      {inspectTrip ? (
        <Modal
          isOpen={true}
          onClose={() => setInspectTrip(null)}
          title={`Itinerary: ${inspectTrip.title}`}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setInspectTrip(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div>
              <span className="card-meta">PURPOSE</span>
              <p style={{ margin: "0.25rem 0 0" }}>{inspectTrip.purpose}</p>
            </div>

            <div>
              <span className="card-meta">RETAIL STOPS SEQUENCE</span>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {inspectTrip.stores.map((s) => (
                  <li key={s.id}>
                    <strong>Stop #{s.sequence}:</strong> {s.name}
                  </li>
                ))}
              </ul>
            </div>

            {inspectTrip.expectedOutcomes?.length ? (
              <div>
                <span className="card-meta">DELIVERABLES &amp; CHECKLISTS</span>
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", color: "var(--text-secondary)" }}>
                  {inspectTrip.expectedOutcomes.map((o, idx) => (
                    <li key={idx}>{o}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {/* Decision Audit History Log */}
      <section className="card" aria-labelledby="history-heading">
        <div className="card-header">
          <h2 id="history-heading" className="card-title">
            Recent Approval Decisions History
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Immutable audit trail</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Field Trip</th>
                <th>Representative</th>
                <th>Decision</th>
                <th>Decision Note</th>
                <th>Decided By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {decisionHistory.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.tripTitle}</strong></td>
                  <td>{entry.repName}</td>
                  <td>
                    <StatusBadge descriptor={getApprovalStatusDescriptor(entry.decision)} />
                  </td>
                  <td style={{ fontSize: "0.8125rem", maxWidth: "18rem" }}>{entry.note}</td>
                  <td style={{ fontSize: "0.8125rem" }}>{entry.decidedBy}</td>
                  <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{entry.decidedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
