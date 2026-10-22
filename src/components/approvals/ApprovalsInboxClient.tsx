"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import {
  createInFlightActionGuard,
  formatUtcTimestamp,
} from "@/lib/ux/formatting-and-resilience";
import type { Trip, TripDecisionStatus } from "@/modules/trips/domain";

export interface ApprovalsInboxClientProps {
  initialTrips: readonly Trip[];
  activeOrgId: string;
  activeOrgName: string;
  currentUserId: string;
}

export function ApprovalsInboxClient({
  initialTrips,
  activeOrgId,
  activeOrgName,
  currentUserId,
}: ApprovalsInboxClientProps): ReactNode {
  const [trips, setTrips] = useState<Trip[]>([...initialTrips]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const actionGuard = createInFlightActionGuard();

  async function handleDecisionSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTripId) return;
    setError(null);
    setConfirmation(null);

    if (decisionChoice !== "approved" && decisionNote.trim().length === 0) {
      setError("A note is required when requesting changes or rejecting a trip.");
      return;
    }

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/orgs/${activeOrgId}/trips/${selectedTripId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decisionChoice,
            note: decisionNote.trim() || "Approved by manager.",
          }),
        }
      );

      const payload = (await res.json()) as {
        data?: { trip?: Trip };
        error?: { message: string };
      };

      if (!res.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to record approval decision.");
      }

      setTrips((prev) => prev.filter((t) => t.id !== selectedTripId));
      setSelectedTripId(null);
      setDecisionNote("");
      setConfirmation(
        `Trip decision successfully recorded (${decisionChoice.replace("_", " ")}).`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error while recording decision."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="inbox-heading">
        <div className="card-header">
          <div>
            <h1 id="inbox-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Manager Approval Inbox
            </h1>
            <p className="card-meta">
              Organization: <strong>{activeOrgName}</strong> • Review and decide submitted
              field trip plans.
            </p>
          </div>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              backgroundColor: "var(--status-info-bg, #eff6ff)",
              color: "var(--status-info-text, #1e40af)",
              fontWeight: 700,
              fontSize: "0.875rem",
            }}
          >
            {trips.length} Pending
          </span>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Approval decision failed"
          message={error}
          onRetry={() => setError(null)}
        />
      ) : null}

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{
            padding: "0.875rem 1.25rem",
            textAlign: "left",
            backgroundColor: "var(--color-success-subtle, #ecfdf5)",
            border: "1px solid var(--color-success-border, #a7f3d0)",
          }}
        >
          <strong>{confirmation}</strong>
        </div>
      ) : null}

      {trips.length === 0 ? (
        <EmptyState
          title="No trips awaiting approval"
          description="All submitted field trips have been decided. New submissions will appear here automatically."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {trips.map((trip) => {
            const isSelf = trip.ownerUserId === currentUserId;
            const isSelected = selectedTripId === trip.id;

            return (
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
                      📅 {trip.startDate} to {trip.endDate} • Submitted{" "}
                      {formatUtcTimestamp(trip.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
                </div>

                <p className="break-long-words">{trip.purpose}</p>

                {isSelf ? (
                  <div
                    role="status"
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--status-warning-bg, #fffbeb)",
                      border: "1px solid var(--status-warning-border, #fef3c7)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <strong>Self-Approval Prevention:</strong> You are the owner of this
                    trip. Organization policy requires a peer manager or administrator to
                    decide this trip.
                  </div>
                ) : (
                  <div>
                    {isSelected ? (
                      <form
                        onSubmit={handleDecisionSubmit}
                        style={{
                          marginTop: "0.5rem",
                          padding: "1rem",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--bg-subtle, #f9fafb)",
                          border: "1px solid var(--border-default, #e5e7eb)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: "1rem" }}>Record Decision</h3>
                        <div
                          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            onClick={() => setDecisionChoice("approved")}
                            className={`btn ${decisionChoice === "approved" ? "btn-primary" : "btn-secondary"}`}
                            style={{ flex: 1 }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisionChoice("changes_requested")}
                            className={`btn ${decisionChoice === "changes_requested" ? "btn-primary" : "btn-secondary"}`}
                            style={{ flex: 1 }}
                          >
                            ✎ Request Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisionChoice("rejected")}
                            className={`btn ${decisionChoice === "rejected" ? "btn-primary" : "btn-secondary"}`}
                            style={{ flex: 1 }}
                          >
                            ✕ Reject
                          </button>
                        </div>

                        <div>
                          <label
                            htmlFor={`note-${trip.id}`}
                            style={{
                              display: "block",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              marginBottom: "0.25rem",
                            }}
                          >
                            Reviewer Note{" "}
                            {decisionChoice !== "approved" ? "*" : "(optional)"}
                          </label>
                          <textarea
                            id={`note-${trip.id}`}
                            rows={2}
                            required={decisionChoice !== "approved"}
                            value={decisionNote}
                            onChange={(e) => setDecisionNote(e.target.value)}
                            placeholder={
                              decisionChoice === "approved"
                                ? "Optional approval note…"
                                : "Specify required changes or reason for rejection…"
                            }
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "var(--radius-md)",
                              border: "1px solid var(--border-strong)",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn btn-primary"
                          >
                            {isSubmitting
                              ? "Recording…"
                              : `Confirm ${decisionChoice.replace("_", " ")}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTripId(null);
                              setDecisionNote("");
                            }}
                            className="btn btn-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTripId(trip.id);
                            setDecisionChoice("approved");
                          }}
                          className="btn btn-primary"
                          style={{ fontSize: "0.875rem" }}
                        >
                          Review &amp; Decide
                        </button>
                        <Link
                          href={`/trips/${trip.id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: "0.875rem" }}
                        >
                          View Full Trip
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
