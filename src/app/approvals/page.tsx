"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type {
  ApprovalInboxStatusFilter,
  TripAuditEvent,
  TripDecisionStatus,
  TripStatus,
} from "@/modules/trips/domain";

interface InboxStopItem {
  sequenceNumber: number;
  storeName: string;
  region: string;
  city: string;
}

interface InboxTripItem {
  id: string;
  title: string;
  purpose: string;
  ownerUserId: string;
  ownerDisplayName: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  stops: InboxStopItem[];
  auditEvents: TripAuditEvent[];
}

const ACTIVE_REVIEWER_ID = "10000000-0000-4000-8000-000000000002"; // Marcus Manager (Acme Retail North)
const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const INITIAL_INBOX_TRIPS: InboxTripItem[] = [
  {
    id: "50000000-0000-4000-8000-000000000002",
    title: "Lakeside Beverage Merchandising Run",
    purpose: "Verify Q4 beverage cooler placement and promotional price tags.",
    ownerUserId: "10000000-0000-4000-8000-000000000003",
    ownerDisplayName: "Fiona Field (fiona.field@acme.local)",
    startDate: "2026-10-27",
    endDate: "2026-10-28",
    status: "submitted",
    submittedAt: "2026-10-22T09:15:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    stops: [
      {
        sequenceNumber: 1,
        storeName: "Lakeside Supercenter #204",
        region: "North-East",
        city: "Chicago",
      },
      {
        sequenceNumber: 2,
        storeName: "Downtown Fresh Mart #101",
        region: "North-Central",
        city: "Chicago",
      },
    ],
    auditEvents: [
      {
        id: "evt-201",
        orgId: ORG_ID,
        tripId: "50000000-0000-4000-8000-000000000002",
        actorUserId: "10000000-0000-4000-8000-000000000003",
        eventType: "trip_created",
        oldStatus: null,
        newStatus: "draft",
        note: "Created trip draft",
        metadata: { stop_count: 2, source: "web" },
        createdAt: "2026-10-22T08:45:00.000Z",
      },
      {
        id: "evt-202",
        orgId: ORG_ID,
        tripId: "50000000-0000-4000-8000-000000000002",
        actorUserId: "10000000-0000-4000-8000-000000000003",
        eventType: "trip_submitted",
        oldStatus: "draft",
        newStatus: "submitted",
        note: "Submitted trip for manager approval",
        metadata: { stop_count: 2, source: "web" },
        createdAt: "2026-10-22T09:15:00.000Z",
      },
    ],
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    title: "Manager Marcus Self-Submitted Audit",
    purpose: "Spot check North-Central flagship store compliance.",
    ownerUserId: ACTIVE_REVIEWER_ID,
    ownerDisplayName: "Marcus Manager (marcus.manager@acme.local — You)",
    startDate: "2026-10-29",
    endDate: "2026-10-29",
    status: "submitted",
    submittedAt: "2026-10-22T09:30:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    stops: [
      {
        sequenceNumber: 1,
        storeName: "Downtown Fresh Mart #101",
        region: "North-Central",
        city: "Chicago",
      },
    ],
    auditEvents: [
      {
        id: "evt-301",
        orgId: ORG_ID,
        tripId: "50000000-0000-4000-8000-000000000003",
        actorUserId: ACTIVE_REVIEWER_ID,
        eventType: "trip_submitted",
        oldStatus: "draft",
        newStatus: "submitted",
        note: "Submitted own trip for another manager/admin to review",
        metadata: { stop_count: 1, source: "web" },
        createdAt: "2026-10-22T09:30:00.000Z",
      },
    ],
  },
];

export default function ApprovalsPage(): ReactNode {
  const [trips, setTrips] = useState<InboxTripItem[]>(INITIAL_INBOX_TRIPS);
  const [statusFilter, setStatusFilter] =
    useState<ApprovalInboxStatusFilter>("submitted");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [excludeOwnTrips, setExcludeOwnTrips] = useState(false);

  const [selectedTripId, setSelectedTripId] = useState<string>(
    INITIAL_INBOX_TRIPS[0]?.id ?? ""
  );
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inAppBanner, setInAppBanner] = useState<string | null>(null);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) {
        return false;
      }
      if (excludeOwnTrips && trip.ownerUserId === ACTIVE_REVIEWER_ID) {
        return false;
      }
      if (startDateFrom && trip.startDate < startDateFrom) {
        return false;
      }
      if (startDateTo && trip.startDate > startDateTo) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = trip.title.toLowerCase().includes(q);
        const matchesPurpose = trip.purpose.toLowerCase().includes(q);
        const matchesOwner = trip.ownerDisplayName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesPurpose && !matchesOwner) {
          return false;
        }
      }
      return true;
    });
  }, [trips, statusFilter, excludeOwnTrips, startDateFrom, startDateTo, searchQuery]);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) ?? filteredTrips[0] ?? null,
    [trips, selectedTripId, filteredTrips]
  );

  function handleDecisionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setInAppBanner(null);

    if (!selectedTrip) {
      setErrorMessage("Select a trip plan to record a decision.");
      return;
    }

    if (selectedTrip.ownerUserId === ACTIVE_REVIEWER_ID) {
      setErrorMessage(
        "Self-approval is forbidden: the trip owner cannot approve, reject, or request changes on their own trip. Another active manager or admin must review this plan."
      );
      return;
    }

    if (selectedTrip.status !== "submitted") {
      setErrorMessage(
        `Stale status conflict (409): this trip is currently '${selectedTrip.status}' and can no longer be decided.`
      );
      return;
    }

    const trimmedNote = decisionNote.trim();
    if (
      (decisionChoice === "changes_requested" || decisionChoice === "rejected") &&
      trimmedNote.length < 3
    ) {
      setErrorMessage(
        "A decision explanation of at least 3 characters is required when requesting changes or rejecting a trip."
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const auditEventType =
      decisionChoice === "approved"
        ? "trip_approved"
        : decisionChoice === "changes_requested"
          ? "trip_changes_requested"
          : "trip_rejected";

    setTrips((prev) =>
      prev.map((item) => {
        if (item.id !== selectedTrip.id) return item;
        return {
          ...item,
          status: decisionChoice,
          decidedBy: ACTIVE_REVIEWER_ID,
          decidedAt: nowIso,
          decisionNote: trimmedNote || "Approved for execution",
          auditEvents: [
            ...item.auditEvents,
            {
              id: `evt-${Date.now()}`,
              orgId: ORG_ID,
              tripId: item.id,
              actorUserId: ACTIVE_REVIEWER_ID,
              eventType: auditEventType,
              oldStatus: "submitted",
              newStatus: decisionChoice,
              note: trimmedNote || "Approved for execution",
              metadata: {
                stop_count: item.stops.length,
                source: "web",
              },
              createdAt: nowIso,
            },
          ],
        };
      })
    );

    setDecisionNote("");
    setInAppBanner(
      `Decision recorded (${decisionChoice}) for "${selectedTrip.title}". In-app decision history updated for the trip owner (in-app notifications only; email/push is not configured).`
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="approvals-heading">
        <div className="card-header">
          <div>
            <h1
              id="approvals-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              Manager Approvals Inbox
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Review submitted field trip plans for your active organization, inspect
              ordered store stops, and record concurrency-safe approval decisions.
            </p>
          </div>
          <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
        </div>
      </section>

      <div
        role="note"
        aria-label="In-app notification channel disclosure"
        className="card"
        style={{
          padding: "0.75rem 1rem",
          backgroundColor: "var(--bg-surface-muted, #f8fafc)",
          fontSize: "0.875rem",
        }}
      >
        <strong>Notification Channel: In-App Only.</strong> Decisions recorded here
        immediately update the employee&apos;s in-app trip status and decision history
        feed. No external email or push notification provider is configured in this phase.
      </div>

      {errorMessage ? (
        <ErrorState
          title="Decision could not be recorded"
          message={errorMessage}
          onRetry={() => setErrorMessage(null)}
        />
      ) : null}

      {inAppBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{ padding: "0.875rem 1.25rem", textAlign: "left" }}
        >
          <strong>{inAppBanner}</strong>
        </div>
      ) : null}

      <section className="card" aria-labelledby="inbox-filters-heading">
        <h2 id="inbox-filters-heading" className="card-title">
          Inbox Filters
        </h2>
        <div className="card-grid">
          <div>
            <label
              htmlFor="inbox-status-filter"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Status
            </label>
            <select
              id="inbox-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ApprovalInboxStatusFilter)
              }
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <option value="submitted">Pending Approval (Submitted)</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="inbox-search"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Search Title, Purpose, or Employee
            </label>
            <input
              id="inbox-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., Lakeside or Fiona"
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="inbox-date-from"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Start Date From
            </label>
            <input
              id="inbox-date-from"
              type="date"
              value={startDateFrom}
              onChange={(e) => setStartDateFrom(e.target.value)}
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="inbox-date-to"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Start Date To
            </label>
            <input
              id="inbox-date-to"
              type="date"
              value={startDateTo}
              onChange={(e) => setStartDateTo(e.target.value)}
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginTop: "0.75rem",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              minHeight: "var(--touch-target-min)",
            }}
          >
            <input
              type="checkbox"
              checked={excludeOwnTrips}
              onChange={(e) => setExcludeOwnTrips(e.target.checked)}
            />
            <span>Hide trips I own (self-approval is disallowed)</span>
          </label>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setStatusFilter("submitted");
              setSearchQuery("");
              setStartDateFrom("");
              setStartDateTo("");
              setExcludeOwnTrips(false);
            }}
          >
            Reset Filters
          </button>
        </div>
      </section>

      {filteredTrips.length === 0 ? (
        <EmptyState
          title="No matching trips in inbox"
          description="No trips match your current filter selection. Try switching Status to 'All Statuses' or resetting filters."
        />
      ) : (
        <div className="card-grid">
          <section className="card" aria-labelledby="inbox-list-heading">
            <h2 id="inbox-list-heading" className="card-title">
              Matching Trips ({filteredTrips.length})
            </h2>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {filteredTrips.map((trip) => {
                const isSelected = selectedTrip?.id === trip.id;
                const isOwnTrip = trip.ownerUserId === ACTIVE_REVIEWER_ID;
                return (
                  <li
                    key={trip.id}
                    style={{
                      padding: "0.875rem",
                      borderRadius: "var(--radius-md)",
                      border: isSelected
                        ? "2px solid var(--brand-primary, #2563eb)"
                        : "1px solid var(--border-subtle, #cbd5e1)",
                    }}
                  >
                    <div className="card-header">
                      <strong>{trip.title}</strong>
                      <StatusBadge
                        descriptor={getApprovalStatusDescriptor(trip.status)}
                      />
                    </div>
                    <p className="card-meta" style={{ margin: "0.25rem 0" }}>
                      Owner: {trip.ownerDisplayName}
                    </p>
                    <p className="card-meta" style={{ margin: "0.25rem 0" }}>
                      Dates: {trip.startDate} to {trip.endDate} • Stops:{" "}
                      {trip.stops.length}
                    </p>
                    {isOwnTrip ? (
                      <p
                        className="card-meta"
                        style={{ margin: "0.25rem 0", fontWeight: 600 }}
                      >
                        Note: You own this trip — another manager/admin must decide it.
                      </p>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedTripId(trip.id);
                          setErrorMessage(null);
                        }}
                      >
                        {isSelected ? "Inspecting Plan" : "Open Full Plan"}
                      </button>
                      <Link href={`/trips/${trip.id}`} className="btn btn-secondary">
                        View Trip Detail Page
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectedTrip ? (
            <section className="card" aria-labelledby="inspector-heading">
              <div className="card-header">
                <div>
                  <h2 id="inspector-heading" className="card-title">
                    Full Trip Plan: {selectedTrip.title}
                  </h2>
                  <p className="card-meta" style={{ margin: 0 }}>
                    Owner: {selectedTrip.ownerDisplayName} • Submitted:{" "}
                    {selectedTrip.submittedAt ?? "—"}
                  </p>
                </div>
                <StatusBadge
                  descriptor={getApprovalStatusDescriptor(selectedTrip.status)}
                />
              </div>

              <p style={{ margin: "0.5rem 0" }}>
                <strong>Purpose:</strong> {selectedTrip.purpose || "No purpose specified"}
              </p>
              <p className="card-meta" style={{ margin: "0 0 0.75rem" }}>
                Schedule: {selectedTrip.startDate} to {selectedTrip.endDate}
              </p>

              <h3 style={{ fontSize: "1rem", margin: "0.5rem 0 0.25rem" }}>
                Ordered Store Stops ({selectedTrip.stops.length})
              </h3>
              <ol
                style={{
                  margin: "0 0 1rem",
                  paddingLeft: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                {selectedTrip.stops.map((stop) => (
                  <li key={stop.sequenceNumber}>
                    <strong>Stop #{stop.sequenceNumber}:</strong> {stop.storeName} (
                    {stop.region} — {stop.city})
                  </li>
                ))}
              </ol>

              <form
                onSubmit={handleDecisionSubmit}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                  borderTop: "1px solid var(--border-subtle, #e2e8f0)",
                  paddingTop: "1rem",
                }}
              >
                <h3 style={{ fontSize: "1rem", margin: 0 }}>Record Manager Decision</h3>

                {selectedTrip.ownerUserId === ACTIVE_REVIEWER_ID ? (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      padding: "0.625rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-strong)",
                      fontSize: "0.875rem",
                    }}
                  >
                    Self-approval guard active: Because you are the owner of this trip,
                    server and database policies forbid deciding your own submission.
                  </p>
                ) : null}

                <div>
                  <label
                    htmlFor="inbox-decision-select"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "0.25rem",
                    }}
                  >
                    Decision
                  </label>
                  <select
                    id="inbox-decision-select"
                    value={decisionChoice}
                    onChange={(e) =>
                      setDecisionChoice(e.target.value as TripDecisionStatus)
                    }
                    style={{
                      width: "100%",
                      minHeight: "var(--touch-target-min)",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-strong)",
                      backgroundColor: "var(--bg-surface)",
                    }}
                  >
                    <option value="approved">Approve Trip Plan</option>
                    <option value="changes_requested">
                      Request Changes (Explanation Required)
                    </option>
                    <option value="rejected">Reject Trip (Explanation Required)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="inbox-decision-note"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "0.25rem",
                    }}
                  >
                    Decision Explanation / Note{" "}
                    {decisionChoice === "changes_requested" ||
                    decisionChoice === "rejected"
                      ? "(Required — min 3 characters)"
                      : "(Optional for approval)"}
                  </label>
                  <textarea
                    id="inbox-decision-note"
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Provide clear feedback for the field employee..."
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={selectedTrip.status !== "submitted"}
                    className="btn btn-primary"
                  >
                    Submit Decision ({decisionChoice})
                  </button>
                </div>
              </form>

              <div
                style={{
                  borderTop: "1px solid var(--border-subtle, #e2e8f0)",
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
                  Append-Only Audit Trail ({selectedTrip.auditEvents.length})
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {selectedTrip.auditEvents.map((evt) => (
                    <li key={evt.id}>
                      <strong>{evt.eventType}</strong> (
                      {evt.oldStatus ? `${evt.oldStatus} → ` : ""}
                      {evt.newStatus}) — {evt.note ?? "—"}{" "}
                      <span className="card-meta">({evt.createdAt})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
