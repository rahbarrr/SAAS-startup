"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import {
  buildEmployeeDecisionHistory,
  type TripAuditEvent,
  type TripAuditEventType,
  type TripDecisionStatus,
  type TripStatus,
} from "@/modules/trips/domain";

const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000003";
const MANAGER_ID = "10000000-0000-4000-8000-000000000002";

export default function TripDetailPage(): ReactNode {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const [status, setStatus] = useState<TripStatus>("draft");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [decidedBy, setDecidedBy] = useState<string | null>(null);
  const [decidedAt, setDecidedAt] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);

  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [reviewerNoteInput, setReviewerNoteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [auditEvents, setAuditEvents] = useState<TripAuditEvent[]>([
    {
      id: "evt-1",
      orgId: ORG_ID,
      tripId,
      actorUserId: EMPLOYEE_ID,
      eventType: "trip_created",
      oldStatus: null,
      newStatus: "draft",
      note: "Created trip draft with 2 ordered store stops",
      metadata: { stop_count: 2, source: "web" },
      createdAt: "2026-10-22T08:00:00.000Z",
    },
  ]);

  const { decisions: decisionHistory, notification: inAppNotification } = useMemo(
    () =>
      buildEmployeeDecisionHistory({
        trip: {
          id: tripId,
          orgId: ORG_ID,
          ownerUserId: EMPLOYEE_ID,
          title: "Q4 Endcap Audit — Downtown",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          purpose: "Verify promotional endcap compliance across downtown stores",
          status,
          submittedAt,
          decidedBy,
          decidedAt,
          decisionNote,
          createdAt: "2026-10-22T08:00:00.000Z",
          updatedAt: "2026-10-22T08:00:00.000Z",
        },
        stops: [],
        auditEvents,
      }),
    [tripId, status, submittedAt, decidedBy, decidedAt, decisionNote, auditEvents]
  );

  function handleSubmitForApproval() {
    setError(null);
    setConfirmation(null);

    if (status === "submitted") {
      setError(
        "Duplicate submission prevented: this trip is already awaiting manager approval."
      );
      return;
    }

    if (status !== "draft" && status !== "changes_requested") {
      setError(`Cannot submit trip from '${status}' status.`);
      return;
    }

    const oldStatus = status;
    const isResubmission = oldStatus === "changes_requested";
    const eventType: TripAuditEventType = isResubmission
      ? "trip_resubmitted"
      : "trip_submitted";
    const nowIso = new Date().toISOString();

    setStatus("submitted");
    setSubmittedAt(nowIso);
    setDecidedBy(null);
    setDecidedAt(null);
    setDecisionNote(null);

    setAuditEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        orgId: ORG_ID,
        tripId,
        actorUserId: EMPLOYEE_ID,
        eventType,
        oldStatus,
        newStatus: "submitted",
        note: isResubmission
          ? "Resubmitted trip for manager approval after requested changes"
          : "Submitted trip for manager approval",
        metadata: { stop_count: 2, source: "web" },
        createdAt: nowIso,
      },
    ]);
    setConfirmation(
      isResubmission
        ? "Trip resubmitted for manager approval."
        : "Trip submitted for manager approval."
    );
  }

  function handleManagerDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);

    if (status !== "submitted") {
      setError("Only submitted trips can be decided by a manager.");
      return;
    }

    const trimmedNote = reviewerNoteInput.trim();
    if (
      (decisionChoice === "changes_requested" || decisionChoice === "rejected") &&
      trimmedNote.length < 3
    ) {
      setError(
        "Please provide a decision note (at least 3 characters) explaining why changes are requested or why the trip is rejected."
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const eventType: TripAuditEventType =
      decisionChoice === "approved"
        ? "trip_approved"
        : decisionChoice === "changes_requested"
          ? "trip_changes_requested"
          : "trip_rejected";
    const effectiveNote = trimmedNote || `Trip marked as ${decisionChoice}`;

    setStatus(decisionChoice);
    setDecidedBy(MANAGER_ID);
    setDecidedAt(nowIso);
    setDecisionNote(effectiveNote);

    setAuditEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        orgId: ORG_ID,
        tripId,
        actorUserId: MANAGER_ID,
        eventType,
        oldStatus: "submitted",
        newStatus: decisionChoice,
        note: effectiveNote,
        metadata: { stop_count: 2, source: "web" },
        createdAt: nowIso,
      },
    ]);
    setReviewerNoteInput("");
    setConfirmation(
      `Manager decision recorded (${decisionChoice}). Employee in-app decision history updated.`
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="trip-detail-heading">
        <div className="card-header">
          <div>
            <h1
              id="trip-detail-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              Q4 Endcap Audit — Downtown
            </h1>
            <p className="card-meta">
              Trip ID: {tripId} • Dates: 2026-10-25 to 2026-10-26
            </p>
          </div>
          <StatusBadge descriptor={getApprovalStatusDescriptor(status)} />
        </div>
      </section>

      <section
        className="card"
        aria-labelledby="in-app-notification-heading"
        style={{
          borderLeft: "4px solid var(--brand-primary, #2563eb)",
        }}
      >
        <div className="card-header">
          <h2 id="in-app-notification-heading" className="card-title">
            {inAppNotification.headline}
          </h2>
          <span className="card-meta">
            Notification Channel: In-App Only (no email/push sent)
          </span>
        </div>
        <p style={{ margin: "0.25rem 0 0" }}>{inAppNotification.detail}</p>
        {inAppNotification.decidedAt ? (
          <p className="card-meta" style={{ margin: "0.35rem 0 0" }}>
            Reviewed by Manager ({inAppNotification.decidedBy}) at{" "}
            {inAppNotification.decidedAt}
          </p>
        ) : null}
      </section>

      {error ? (
        <ErrorState
          title="Workflow action blocked"
          message={error}
          onRetry={() => setError(null)}
        />
      ) : null}

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{ padding: "0.875rem 1.25rem", textAlign: "left" }}
        >
          <strong>{confirmation}</strong>
        </div>
      ) : null}

      <section className="card" aria-labelledby="ordered-stops-heading">
        <div className="card-header">
          <h2 id="ordered-stops-heading" className="card-title">
            Planned vs Actual Stop Execution (2 Stops)
          </h2>
          <span className="card-meta">
            Completion Rule: Trip completes when 100% of planned stops are checked out
          </span>
        </div>
        <p className="card-meta" style={{ margin: "0 0 0.5rem" }}>
          Location is displayed strictly as a point-in-time check-in/out record, not live
          tracking. Device coordinates are stored as unverified device-reported data, not
          verified proof.
        </p>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <li>
            <strong>Stop #1:</strong> Downtown Fresh Mart #101 (North-Central — 120 Main
            St, Chicago) • Planned Status: <code>planned</code> • Actual Visit:{" "}
            <Link href="/visits/70000000-0000-4000-8000-000000000001">
              View Visit Detail
            </Link>
          </li>
          <li>
            <strong>Stop #2:</strong> Lakeside Supercenter #204 (North-East — 850 Lake
            Shore Dr, Chicago) • Planned Status: <code>planned</code> • Actual Visit:{" "}
            <Link href="/visits/70000000-0000-4000-8000-000000000002">
              View Visit Detail
            </Link>
          </li>
        </ol>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          {status === "draft" || status === "changes_requested" ? (
            <button
              type="button"
              onClick={handleSubmitForApproval}
              className="btn btn-primary"
            >
              {status === "changes_requested"
                ? "Resubmit for Manager Approval"
                : "Submit for Manager Approval"}
            </button>
          ) : null}

          {status === "draft" ||
          status === "changes_requested" ||
          status === "approved" ? (
            <Link href={`/trips/${tripId}/edit`} className="btn btn-secondary">
              {status === "approved"
                ? "Edit Approved Trip (Requires Re-Approval)"
                : "Edit Trip Plan"}
            </Link>
          ) : null}

          <Link href="/approvals" className="btn btn-secondary">
            Open Manager Approvals Inbox
          </Link>

          <Link href="/trips" className="btn btn-secondary">
            Back to Trips
          </Link>
        </div>
      </section>

      <section className="card" aria-labelledby="employee-decision-history-heading">
        <h2 id="employee-decision-history-heading" className="card-title">
          Employee-Facing Decision History ({decisionHistory.length})
        </h2>
        <p className="card-meta">
          Chronological record of manager approval decisions and feedback notes for this
          trip.
        </p>
        {decisionHistory.length === 0 ? (
          <p className="card-meta" style={{ margin: 0 }}>
            No manager decisions have been recorded for this trip yet.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {decisionHistory.map((item) => (
              <li key={item.auditEventId}>
                <strong>{item.decisionStatus.toUpperCase()}</strong> —{" "}
                {item.note ?? "No note provided"}{" "}
                <span className="card-meta">
                  (Reviewer: {item.reviewerUserId} at {item.decidedAt})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="manager-review-heading">
        <h2 id="manager-review-heading" className="card-title">
          Manager Review &amp; Decision
        </h2>
        <p className="card-meta">
          Only an active Manager or Admin of this organization who is not the trip owner
          may decide a submitted trip.
        </p>

        <form
          onSubmit={handleManagerDecision}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="card-grid">
            <div>
              <label
                htmlFor="decision-select"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Decision
              </label>
              <select
                id="decision-select"
                value={decisionChoice}
                onChange={(e) => setDecisionChoice(e.target.value as TripDecisionStatus)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg-surface)",
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
                Decision Note (required for Request Changes / Reject)
              </label>
              <input
                id="decision-note"
                type="text"
                value={reviewerNoteInput}
                onChange={(e) => setReviewerNoteInput(e.target.value)}
                placeholder="Reason or instructions for the field employee"
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={status !== "submitted"}
              className="btn btn-primary"
            >
              Record Manager Decision
            </button>
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="audit-trail-heading">
        <h2 id="audit-trail-heading" className="card-title">
          Trip Audit Trail ({auditEvents.length})
        </h2>
        <p className="card-meta">
          Append-only history of state-changing actions and edits on this trip.
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {auditEvents.map((evt) => (
            <li key={evt.id}>
              <strong>{evt.eventType}</strong> (
              {evt.oldStatus ? `${evt.oldStatus} → ` : ""}
              {evt.newStatus}) — {evt.note}{" "}
              <span className="card-meta">({evt.createdAt})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
