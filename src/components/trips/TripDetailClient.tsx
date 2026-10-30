"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { TripPlannerMap } from "@/components/maps";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import {
  captureDeviceLocationWithConsent,
  classifyRequestFailure,
  createInFlightActionGuard,
  formatUtcTimestamp,
} from "@/lib/ux/formatting-and-resilience";
import type { RouteOptimizationProposal } from "@/modules/routing/domain";
import type { OrgRole } from "@/modules/tenancy/domain";
import type { TripDecisionStatus, TripDetail } from "@/modules/trips/domain";
import { AiTripPlanningModal } from "./AiTripPlanningModal";
import { RouteOptimizationModal } from "./RouteOptimizationModal";

export interface TripDetailClientProps {
  initialDetail: TripDetail;
  activeOrgId: string;
  currentUserId: string;
  userRole: OrgRole;
  storesMap: Record<
    string,
    {
      name: string;
      city: string;
      region: string;
      addressLine1?: string;
      countryCode?: string;
      latitude?: number | null;
      longitude?: number | null;
    }
  >;
  visitsMap?: Record<string, { id: string; status: string }>;
}

export function TripDetailClient({
  initialDetail,
  activeOrgId,
  currentUserId,
  userRole,
  storesMap,
  visitsMap,
}: TripDetailClientProps): ReactNode {
  const router = useRouter();
  const [detail, setDetail] = useState<TripDetail>(initialDetail);
  const [visitsState, setVisitsState] = useState<
    Record<string, { id: string; status: string }>
  >(visitsMap ?? {});
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);
  const trip = detail.trip;

  // Reviewer form state
  const [decisionChoice, setDecisionChoice] = useState<TripDecisionStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Route optimization and AI Planning state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeProposal, setRouteProposal] = useState<RouteOptimizationProposal | null>(
    null
  );
  const [isApplyingRoute, setIsApplyingRoute] = useState(false);
  const [isAiPlanningOpen, setIsAiPlanningOpen] = useState(false);

  // Active-trip location tracking state
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [isRecordingLocation, setIsRecordingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCapturedPoint, setLastCapturedPoint] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
  } | null>(null);

  const actionGuard = createInFlightActionGuard();

  const isOwner = trip.ownerUserId === currentUserId;
  const isManagerOrAdmin = userRole === "manager" || userRole === "admin";
  const isSelfSubmitted = isOwner && isManagerOrAdmin;

  async function handleRecordBreadcrumb() {
    setLocationError(null);
    setIsRecordingLocation(true);
    try {
      const loc = await captureDeviceLocationWithConsent();
      if (loc.status === "permission_denied") {
        throw new Error(
          "Location permission denied. Please enable geolocation in your browser to record checkpoints."
        );
      }
      if (loc.status === "unavailable" || loc.latitude == null || loc.longitude == null) {
        throw new Error("Device GPS coordinates are currently unavailable.");
      }

      const res = await fetch(`/api/orgs/${activeOrgId}/trips/${trip.id}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracyMeters: loc.accuracyMeters ?? 25,
          batteryLevel: 0.85,
          isMoving: true,
        }),
      });

      const payload = await res.json();
      if (!res.ok || payload.error) {
        throw new Error(
          payload.error?.message || "Failed to record location breadcrumb."
        );
      }

      setLastCapturedPoint({
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy: loc.accuracyMeters ?? 25,
        timestamp: new Date().toLocaleTimeString(),
      });
      setConfirmation("Trip location checkpoint recorded.");
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Error capturing location.");
    } finally {
      setIsRecordingLocation(false);
    }
  }

  function handleStartTracking() {
    setIsTrackingActive(true);
    void handleRecordBreadcrumb();
  }

  function handleStopTracking() {
    setIsTrackingActive(false);
    setConfirmation("Active trip tracking stopped.");
  }

  async function handleOpenRouteOptimizer() {
    setError(null);
    setIsOptimizing(true);
    try {
      const res = await fetch(
        `/api/orgs/${activeOrgId}/trips/${trip.id}/optimize-route`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "propose" }),
        }
      );
      const payload = (await res.json()) as {
        data?: RouteOptimizationProposal;
        error?: { message: string };
      };
      if (!res.ok || payload.error || !payload.data) {
        throw new Error(
          payload.error?.message || "Failed to generate route optimization proposal."
        );
      }
      setRouteProposal(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating route proposal.");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleApplyOptimizedRoute(proposal: RouteOptimizationProposal) {
    setIsApplyingRoute(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orgs/${activeOrgId}/trips/${trip.id}/optimize-route`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply",
            confirmApprovedTripModification: trip.status === "approved",
            proposedStopOrder: proposal.proposedOrder.map((s) => ({
              storeId: s.storeId,
              plannedAt: s.plannedWindow?.start ?? null,
            })),
          }),
        }
      );
      const payload = (await res.json()) as {
        data?: TripDetail;
        error?: { message: string };
      };
      if (!res.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message || "Failed to apply optimized route.");
      }
      setDetail(payload.data);
      setRouteProposal(null);
      setConfirmation(
        trip.status === "approved"
          ? "Route sequence updated. Notice: trip status reset to draft for manager re-approval."
          : "Route sequence successfully updated to optimized order."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply optimized route.");
    } finally {
      setIsApplyingRoute(false);
    }
  }

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

  async function handleCheckIn(stopId: string) {
    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsCheckingIn(stopId);

    try {
      const loc = await captureDeviceLocationWithConsent();
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch(`/api/orgs/${activeOrgId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripStopId: stopId,
          idempotencyKey,
          location: loc,
        }),
      });

      const payload = (await res.json()) as {
        data?: { id: string; status: string };
        error?: { message: string; code?: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        const classified = classifyRequestFailure({
          status: res.status,
          errorCode: payload.error?.code,
          errorMessage: payload.error?.message,
        });
        throw new Error(classified.userMessage);
      }

      const visitData = payload.data;
      setVisitsState((prev) => ({
        ...prev,
        [stopId]: { id: visitData.id, status: visitData.status },
      }));
      setConfirmation("Check-in recorded. Opening store visit execution…");
      router.push(`/visits/${visitData.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during check-in.");
    } finally {
      setIsCheckingIn(null);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className="page-header" aria-labelledby="trip-detail-heading">
        <div className="page-header-text">
          <Link
            href="/trips"
            className="auth-back-link"
            style={{ marginBottom: "0.25rem" }}
          >
            ← Back to Field Trips
          </Link>
          <h1 id="trip-detail-heading" className="page-title">
            {trip.title}
          </h1>
          <p className="page-subtitle">
            📅 <strong>{trip.startDate}</strong> to <strong>{trip.endDate}</strong> • Trip
            ID: <code>{trip.id}</code>
          </p>
        </div>
        <div className="page-actions">
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
        <div role="status" aria-live="polite" className="alert alert--success">
          <span aria-hidden="true">✓</span>
          <span>{confirmation}</span>
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: ".75rem",
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  padding: ".9rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default, #dbe2ef)",
                  background: "var(--bg-subtle, #f8fafc)",
                }}
              >
                <div className="card-meta" style={{ marginBottom: ".35rem" }}>
                  STARTING POINT
                </div>
                <strong>{trip.startLocation || "Not specified"}</strong>
              </div>
              <div
                style={{
                  padding: ".9rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default, #dbe2ef)",
                  background: "var(--bg-subtle, #f8fafc)",
                }}
              >
                <div className="card-meta" style={{ marginBottom: ".35rem" }}>
                  DESTINATION CITY / AREA
                </div>
                <strong>{trip.destinationCity || "Not specified"}</strong>
              </div>
            </div>

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
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAiPlanningOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: "0.8125rem",
                    background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                    borderColor: "#C7D2FE",
                    color: "var(--brand-primary)",
                    fontWeight: 600,
                  }}
                >
                  ✨ AI Planning Assistant
                </button>
                {isOwner &&
                (trip.status === "draft" ||
                  trip.status === "changes_requested" ||
                  trip.status === "approved") ? (
                  <>
                    {detail.stops.length >= 2 ? (
                      <button
                        type="button"
                        onClick={handleOpenRouteOptimizer}
                        disabled={isOptimizing}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8125rem" }}
                      >
                        {isOptimizing ? "Optimizing…" : "⚡ Optimize Route"}
                      </button>
                    ) : null}
                    <Link
                      href={`/trips/${trip.id}/edit`}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      {trip.status === "approved"
                        ? "Edit Trip (Re-opens Draft)"
                        : "Edit Stops"}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>

            {detail.stops.length > 0 ? (
              <div style={{ marginBottom: "1rem" }}>
                <TripPlannerMap
                  title="Persisted Trip Route"
                  stops={detail.stops.map((stop) => {
                    const store = storesMap[stop.storeId];
                    return {
                      id: stop.id,
                      sequenceNumber: stop.sequenceNumber,
                      storeName: store?.name ?? stop.storeId,
                      city: store?.city ?? "",
                      region: store?.region ?? "",
                      addressLine1: store?.addressLine1,
                      latitude: store?.latitude ?? null,
                      longitude: store?.longitude ?? null,
                    };
                  })}
                />
              </div>
            ) : null}

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
                  const lat = store?.latitude;
                  const lng = store?.longitude;
                  const hasCoords = typeof lat === "number" && typeof lng === "number";
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
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {store?.addressLine1 ? (
                            <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                              {store.addressLine1}
                            </span>
                          ) : null}
                          {hasCoords ? (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "var(--color-success-text, #166534)",
                                backgroundColor: "var(--color-success-subtle, #ecfdf5)",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "9999px",
                              }}
                            >
                              ✓ ({lat.toFixed(4)}, {lng.toFixed(4)})
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "var(--status-warning-text, #92400e)",
                                backgroundColor: "var(--status-warning-bg, #fffbeb)",
                                border: "1px solid var(--status-warning-border, #fef3c7)",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "9999px",
                              }}
                            >
                              ⚠️ Missing Coordinates
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
                      >
                        <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                          Status: <strong>{stop.status}</strong>
                        </span>
                        {visitsState[stop.id] ? (
                          <Link
                            href={`/visits/${visitsState[stop.id]?.id}`}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.625rem" }}
                          >
                            Visit ({visitsState[stop.id]?.status}) →
                          </Link>
                        ) : stop.status === "planned" &&
                          trip.status === "approved" &&
                          isOwner ? (
                          <button
                            type="button"
                            disabled={isCheckingIn === stop.id}
                            onClick={() => handleCheckIn(stop.id)}
                            className="btn btn-primary"
                            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.625rem" }}
                          >
                            {isCheckingIn === stop.id ? "Checking in…" : "Check In"}
                          </button>
                        ) : null}
                      </div>
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

          {isOwner && trip.status === "in_progress" ? (
            <section className="card" aria-labelledby="location-tracking-heading">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <h2
                  id="location-tracking-heading"
                  style={{ margin: 0, fontSize: "1.125rem" }}
                >
                  📍 Active Trip Tracking
                </h2>
                {isTrackingActive ? (
                  <span
                    className="status-badge"
                    style={{
                      background: "rgba(5, 150, 105, 0.12)",
                      color: "var(--success-green, #059669)",
                      border: "1px solid rgba(5, 150, 105, 0.25)",
                      fontSize: "0.75rem",
                    }}
                  >
                    🟢 Tracking Active
                  </span>
                ) : (
                  <span
                    className="status-badge"
                    style={{
                      background: "rgba(107, 114, 128, 0.12)",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.75rem",
                }}
              >
                Privacy-aware location telemetry: Breadcrumbs are recorded strictly while
                this work trip is in-progress and this browser tab is active.
              </p>

              {locationError ? (
                <div
                  role="alert"
                  style={{
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.75rem",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--danger-red, #ef4444)",
                    fontSize: "0.75rem",
                  }}
                >
                  {locationError}
                </div>
              ) : null}

              {lastCapturedPoint ? (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.75rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div>
                    <strong>Last Checkpoint:</strong> {lastCapturedPoint.lat.toFixed(4)},{" "}
                    {lastCapturedPoint.lng.toFixed(4)}
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    Accuracy: ±{Math.round(lastCapturedPoint.accuracy)}m • Recorded:{" "}
                    {lastCapturedPoint.timestamp}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {!isTrackingActive ? (
                  <button
                    type="button"
                    onClick={handleStartTracking}
                    disabled={isRecordingLocation}
                    className="btn btn-primary"
                    style={{ width: "100%", fontSize: "0.8125rem" }}
                  >
                    {isRecordingLocation
                      ? "Requesting GPS Fix…"
                      : "Enable Active Trip Tracking"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRecordBreadcrumb()}
                      disabled={isRecordingLocation}
                      className="btn btn-secondary"
                      style={{ width: "100%", fontSize: "0.8125rem" }}
                    >
                      {isRecordingLocation ? "Recording…" : "📍 Record Checkpoint Now"}
                    </button>
                    <button
                      type="button"
                      onClick={handleStopTracking}
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        fontSize: "0.8125rem",
                        color: "var(--danger-red, #ef4444)",
                      }}
                    >
                      Stop Tracking
                    </button>
                  </>
                )}
              </div>

              <div
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                ⚠️ <strong>Web Browser Limitation:</strong> Background GPS tracking when
                the browser is closed or suspended is not supported on iOS Safari /
                Android browsers without a future native application.
              </div>
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

      <RouteOptimizationModal
        isOpen={Boolean(routeProposal)}
        onClose={() => setRouteProposal(null)}
        proposal={routeProposal}
        isApplying={isApplyingRoute}
        isApprovedTrip={trip.status === "approved"}
        onApply={handleApplyOptimizedRoute}
      />

      <AiTripPlanningModal
        isOpen={isAiPlanningOpen}
        onClose={() => setIsAiPlanningOpen(false)}
        orgId={activeOrgId}
        tripId={trip.id}
        tripTitle={trip.title}
        tripStatus={trip.status}
        onTripUpdated={() => window.location.reload()}
      />
    </div>
  );
}
