"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import {
  createInFlightActionGuard,
  formatUtcTimestamp,
} from "@/lib/ux/formatting-and-resilience";
import type { OrgRole } from "@/modules/tenancy/domain";
import type { TripDecisionStatus, TripDetail } from "@/modules/trips/domain";

export interface TripDetailClientProps {
  initialDetail: TripDetail;
  activeOrgId: string;
  currentUserId: string;
  userRole: OrgRole;
  storesMap: Record<string, { name: string; city: string; region: string }>;
}

export function TripDetailClient({
  initialDetail,
  activeOrgId,
  currentUserId,
  userRole,
  storesMap,
}: TripDetailClientProps): ReactNode {
  const [detail, setDetail] = useState<TripDetail>(initialDetail);
  const trip = detail.trip;

  // Reviewer form state
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const actionGuard = createInFlightActionGuard();

  const isOwner = trip.ownerUserId === currentUserId;
  const isManagerOrAdmin = userRole === "manager" || userRole === "admin";
  const isSelfSubmitted = isOwner && isManagerOrAdmin;

  async function handleSubmitTrip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/trips/${trip.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: submissionNote.trim() || undefined,
        }),
      });

      const payload = (await res.json()) as {
        data?: TripDetail;
        error?: { message: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message || "Failed to submit trip for approval.");
      }

      setDetail(payload.data);
      setSubmissionNote("");
      setConfirmation("Trip successfully submitted for manager approval.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error occurred while submitting trip."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  async function handleDecisionSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);

    if (decisionChoice !== "approved" && decisionNote.trim().length === 0) {
      setError(
        "A decision note explaining the reason is required for rejection or changes requested."
      );
      return;
    }

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/trips/${trip.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionChoice,
          note: decisionNote.trim() || "Approved by manager.",
        }),
      });

      const payload = (await res.json()) as {
        data?: TripDetail;
        error?: { message: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message || "Failed to record approval decision.");
      }

      setDetail(payload.data);
      setDecisionNote("");
      setConfirmation(`Trip decision recorded: ${decisionChoice.replace("_", " ")}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error occurred while recording decision."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="trip-detail-heading">
        <div className="card-header">
          <div>
            <Link
              href="/trips"
              className="card-meta"
              style={{ display: "inline-block", marginBottom: "0.5rem" }}
            >
              ← Back to Field Trips
            </Link>
            <h1 id="trip-detail-heading" style={{ margin: 0, fontSize: "1.5rem" }}>
              {trip.title}
            </h1>
            <p className="card-meta">
              📅 {trip.startDate} to {trip.endDate} • Trip ID: <code>{trip.id}</code>
            </p>
          </div>
          <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Trip operation failed"
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

      <div className="card-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className="card" aria-labelledby="trip-summary-heading">
            <h2
              id="trip-summary-heading"
              style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
            >
              Operational Purpose
            </h2>
            <p className="break-long-words">{trip.purpose}</p>

            {trip.decisionNote ? (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-subtle, #f9fafb)",
                  border: "1px solid var(--border-subtle, #e5e7eb)",
                }}
              >
                <strong>Manager Decision Note:</strong> {trip.decisionNote}
                {trip.decidedAt ? (
                  <div
                    className="card-meta"
                    style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}
                  >
                    Decided on: {formatUtcTimestamp(trip.decidedAt)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="card" aria-labelledby="trip-stops-heading">
            <div className="card-header" style={{ marginBottom: "0.5rem" }}>
              <h2 id="trip-stops-heading" style={{ margin: 0, fontSize: "1.125rem" }}>
                Planned Store Stops ({detail.stops.length})
              </h2>
              {trip.status === "draft" || trip.status === "changes_requested" ? (
                <Link
                  href={`/trips/${trip.id}/edit`}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8125rem" }}
                >
                  Edit Stops
                </Link>
              ) : null}
            </div>

            {detail.stops.length === 0 ? (
              <p className="card-meta">No store stops planned for this trip.</p>
            ) : (
              <ol
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {detail.stops.map((stop) => {
                  const store = storesMap[stop.storeId];
                  return (
                    <li
                      key={stop.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--bg-subtle, #f9fafb)",
                        border: "1px solid var(--border-default, #e5e7eb)",
                      }}
                    >
                      <div>
                        <strong>Stop #{stop.sequenceNumber}:</strong>{" "}
                        <Link
                          href={`/stores/${stop.storeId}`}
                          style={{ fontWeight: 600 }}
                        >
                          {store?.name ?? stop.storeId}
                        </Link>
                        <span className="card-meta" style={{ marginLeft: "0.5rem" }}>
                          ({store?.city ?? "City"}, {store?.region ?? "Region"})
                        </span>
                      </div>
                      <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                        Status: <strong>{stop.status}</strong>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="card" aria-labelledby="audit-trail-heading">
            <h2
              id="audit-trail-heading"
              style={{ margin: "0 0 0.75rem", fontSize: "1.125rem" }}
            >
              Audit History &amp; Decision Log
            </h2>
            {detail.auditEvents.length === 0 ? (
              <p className="card-meta">No audit events recorded yet.</p>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {detail.auditEvents.map((evt) => (
                  <li
                    key={evt.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle, #e5e7eb)",
                      backgroundColor: "var(--bg-surface)",
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
                        {evt.eventType.replace(/_/g, " ").toUpperCase()}
                      </strong>
                      <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                        {formatUtcTimestamp(evt.createdAt)}
                      </span>
                    </div>
                    {evt.note ? (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                        {evt.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {isOwner && (trip.status === "draft" || trip.status === "changes_requested") ? (
            <section className="card" aria-labelledby="submit-trip-heading">
              <h2
                id="submit-trip-heading"
                style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
              >
                Submit for Approval
              </h2>
              <p className="card-meta" style={{ margin: "0 0 1rem" }}>
                Once submitted, this trip is locked for manager review.
              </p>
              <form
                onSubmit={handleSubmitTrip}
                style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
              >
                <textarea
                  rows={2}
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Optional submission note for your reviewer…"
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || detail.stops.length === 0}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Submitting…" : "Submit for Manager Approval"}
                </button>
              </form>
            </section>
          ) : null}

          {isManagerOrAdmin && trip.status === "submitted" ? (
            <section className="card" aria-labelledby="review-decision-heading">
              <h2
                id="review-decision-heading"
                style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
              >
                Manager Decision
              </h2>

              {isSelfSubmitted ? (
                <div
                  role="status"
                  style={{
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--status-warning-bg, #fffbeb)",
                    border: "1px solid var(--status-warning-border, #fef3c7)",
                    fontSize: "0.875rem",
                  }}
                >
                  <strong>Self-Approval Policy:</strong> You are the owner of this trip.
                  Organization policy requires a peer manager or administrator to review
                  and approve your submission.
                </div>
              ) : (
                <form
                  onSubmit={handleDecisionSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                >
                  <div>
                    <label
                      htmlFor="decision-select"
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                      }}
                    >
                      Decision Outcome
                    </label>
                    <select
                      id="decision-select"
                      value={decisionChoice}
                      onChange={(e) =>
                        setDecisionChoice(e.target.value as TripDecisionStatus)
                      }
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)",
                        backgroundColor: "var(--bg-surface)",
                        fontWeight: 600,
                      }}
                    >
                      <option value="approved">Approve Trip</option>
                      <option value="changes_requested">Request Changes</option>
                      <option value="rejected">Reject Trip</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="decision-note"
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                      }}
                    >
                      Reviewer Note {decisionChoice !== "approved" ? "*" : ""}
                    </label>
                    <textarea
                      id="decision-note"
                      rows={3}
                      required={decisionChoice !== "approved"}
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder={
                        decisionChoice === "approved"
                          ? "Optional approval note…"
                          : "Specify required adjustments or reason for rejection…"
                      }
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                  >
                    {isSubmitting
                      ? "Recording…"
                      : `Confirm ${decisionChoice.replace("_", " ")}`}
                  </button>
                </form>
              )}
            </section>
          ) : null}

          <section className="card" aria-labelledby="trip-metadata-heading">
            <h2
              id="trip-metadata-heading"
              style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
            >
              Trip Info
            </h2>
            <dl
              style={{
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Owner User ID</dt>
                <dd style={{ margin: 0, fontFamily: "monospace" }}>{trip.ownerUserId}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Created (UTC)</dt>
                <dd style={{ margin: 0 }}>{formatUtcTimestamp(trip.createdAt)}</dd>
              </div>
              {trip.submittedAt ? (
                <div>
                  <dt style={{ color: "var(--text-muted)" }}>Submitted (UTC)</dt>
                  <dd style={{ margin: 0 }}>{formatUtcTimestamp(trip.submittedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
