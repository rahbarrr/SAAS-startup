"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatUtcTimestamp } from "@/lib/ux/formatting-and-resilience";
import type { Trip, TripDecisionStatus } from "@/modules/trips/domain";

export interface ApprovalsInboxClientProps {
  initialTrips: readonly Trip[];
  activeOrgId: string;
  activeOrgName: string;
  currentUserId: string;
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
}: ApprovalsInboxClientProps): ReactNode {
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([...initialTrips]);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [search, setSearch] = useState("");

  // Modal dialog states
  const [actionTrip, setActionTrip] = useState<Trip | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decision history (accumulates decisions made in session)
  const [decisionHistory, setDecisionHistory] = useState<DecisionHistoryEntry[]>([]);

  const pendingTrips = trips.filter((t) => t.status === "submitted");
  const approvedTrips = trips.filter(
    (t) =>
      t.status === "approved" || t.status === "in_progress" || t.status === "completed"
  );
  const rejectedTrips = trips.filter(
    (t) => t.status === "rejected" || t.status === "changes_requested"
  );

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
      trip.purpose.toLowerCase().includes(q) ||
      trip.ownerUserId.toLowerCase().includes(q)
    );
  });

  function openDecisionDialog(trip: Trip, decision: TripDecisionStatus) {
    setActionTrip(trip);
    setDecisionChoice(decision);
    setDecisionNote("");
    setError(null);
  }

  async function handleConfirmDecision(e: FormEvent) {
    e.preventDefault();
    if (!actionTrip) return;

    if (actionTrip.ownerUserId === currentUserId) {
      setError(
        "Self-approval is forbidden: you cannot approve or decide your own field trip."
      );
      return;
    }

    if (decisionChoice !== "approved" && decisionNote.trim().length === 0) {
      setError(
        "A detailed explanatory note is required when requesting changes or rejecting a trip."
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${activeOrgId}/trips/${actionTrip.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decisionChoice,
            note:
              decisionNote.trim() ||
              (decisionChoice === "approved" ? "Approved by manager." : undefined),
          }),
        }
      );

      const payload = (await res.json()) as {
        data?: unknown;
        error?: { message?: string };
      };

      if (!res.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to record approval decision.");
      }

      setTrips((prev) =>
        prev.map((t) =>
          t.id === actionTrip.id
            ? {
                ...t,
                status:
                  decisionChoice === "approved"
                    ? "approved"
                    : decisionChoice === "rejected"
                      ? "rejected"
                      : "changes_requested",
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
          repName: actionTrip.ownerUserId.slice(0, 8),
          decision: decisionChoice,
          note: decisionNote.trim() || "Policy approval recorded.",
          decidedAt: formatUtcTimestamp(new Date().toISOString()),
          decidedBy: "Verified Manager",
        },
        ...prev,
      ]);

      const actionLabel =
        decisionChoice === "approved"
          ? "approved"
          : decisionChoice === "rejected"
            ? "rejected"
            : "returned for modifications";

      showToast(`Trip #${actionTrip.id.slice(0, 8)} ${actionLabel}.`, "success");
      setActionTrip(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <section className="page-header" aria-labelledby="inbox-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Governance & Approvals</p>
          <h1 id="inbox-heading" className="page-title">
            Manager Approval Inbox
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrgName}</strong> • Policy compliance verification,
            self-approval prevention, and trip approvals.
          </p>
        </div>

        <div className="page-actions">
          <span className="status-badge status-badge--warning">
            {pendingTrips.length} Pending Review
          </span>
        </div>
      </section>

      {/* Tabs and Search Bar */}
      <section className="filter-bar" aria-label="Approvals tabs and search filter">
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending Review ({pendingTrips.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            Approved &amp; Scheduled ({approvedTrips.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            Changes &amp; Rejected ({rejectedTrips.length})
          </button>
        </div>

        <div className="search-input-wrapper" style={{ minWidth: "min(100%, 16rem)" }}>
          <span className="search-icon">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search submitted trips…"
            className="form-input"
            aria-label="Filter approvals list"
          />
        </div>
      </section>

      {/* List Content */}
      {filteredList.length === 0 ? (
        <EmptyState
          title={
            activeTab === "pending"
              ? "All submitted trips have been reviewed!"
              : `No trips with status '${activeTab}'`
          }
          description={
            activeTab === "pending"
              ? "There are currently no field trips awaiting your manager approval decision."
              : "No trip records match the current status and search filters."
          }
          actionLabel="View All Trips"
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
                      : trip.status === "approved" ||
                          trip.status === "in_progress" ||
                          trip.status === "completed"
                        ? "4px solid var(--status-success)"
                        : "4px solid var(--status-danger)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                }}
              >
                <div className="card-header">
                  <div>
                    <strong style={{ fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
                      {trip.title}
                    </strong>
                    <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                      Submitted by: <strong>Rep ({trip.ownerUserId.slice(0, 8)})</strong>{" "}
                      • Dates:{" "}
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

                {trip.decisionNote ? (
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "#FFFBEB",
                      border: "1px solid var(--status-warning-border)",
                    }}
                  >
                    <strong style={{ color: "var(--status-warning-text)" }}>
                      Manager Decision Note:
                    </strong>{" "}
                    {trip.decisionNote}
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
                  <Link
                    href={`/trips/${trip.id}`}
                    className="btn btn-sm btn-secondary"
                    style={{
                      minHeight: "44px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Inspect Full Itinerary →
                  </Link>

                  {trip.status === "submitted" ? (
                    isSelfSubmitted ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Self-approval restricted by policy (peer manager required)
                      </span>
                    ) : (
                      <div
                        className="approvals-action-buttons"
                        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{
                            color: "var(--brand-accent)",
                            minHeight: "44px",
                            padding: "0.5rem 0.875rem",
                          }}
                          onClick={() => openDecisionDialog(trip, "changes_requested")}
                        >
                          Request Changes
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ minHeight: "44px", padding: "0.5rem 0.875rem" }}
                          onClick={() => openDecisionDialog(trip, "rejected")}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{ minHeight: "44px", padding: "0.5rem 0.875rem" }}
                          onClick={() => openDecisionDialog(trip, "approved")}
                        >
                          ✓ Approve Trip
                        </button>
                      </div>
                    )
                  ) : (
                    <Link
                      href={`/trips/${trip.id}`}
                      className="btn btn-sm btn-outline"
                      style={{
                        minHeight: "44px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      View Audit Details →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Decision History Log */}
      {decisionHistory.length > 0 && (
        <section className="card" aria-labelledby="history-heading">
          <div className="card-header">
            <div>
              <h2 id="history-heading" className="card-title">
                Session Audit Decision Log
              </h2>
              <p className="card-meta">
                Recorded policy determinations in current session
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {decisionHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong style={{ fontSize: "0.875rem" }}>{item.tripTitle}</strong>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(item.decision)} />
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {item.note}
                </p>
                <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                  Decided by {item.decidedBy} at {item.decidedAt}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decision Dialog Modal */}
      {actionTrip ? (
        <Modal
          isOpen={true}
          onClose={() => setActionTrip(null)}
          title={
            decisionChoice === "approved"
              ? "Approve Field Trip"
              : decisionChoice === "rejected"
                ? "Reject Field Trip"
                : "Request Itinerary Changes"
          }
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
                {isSubmitting
                  ? "Recording Decision…"
                  : `Confirm ${decisionChoice.replace("_", " ")}`}
              </button>
            </div>
          }
        >
          <form
            onSubmit={handleConfirmDecision}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                background: "var(--bg-subtle)",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9375rem" }}>
                {actionTrip.title}
              </strong>
              <span className="card-meta">
                Rep: {actionTrip.ownerUserId.slice(0, 8)} • Dates: {actionTrip.startDate}{" "}
                to {actionTrip.endDate}
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
                    : "e.g., Please adjust visit duration or include cooler calibration logs."
                }
                rows={3}
                required={decisionChoice !== "approved"}
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
