"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { AiTripPlanSummary } from "@/modules/ai-intelligence/domain";

export interface AiTripPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  tripId: string;
  tripTitle: string;
  tripStatus: string;
  onTripUpdated?: () => void;
}

export function AiTripPlanningModal({
  isOpen,
  onClose,
  orgId,
  tripId,
  tripTitle,
  tripStatus,
  onTripUpdated,
}: AiTripPlanningModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AiTripPlanSummary | null>(null);
  const [confirmApproved, setConfirmApproved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTripPlan();
    } else {
      setError(null);
    }
  }, [isOpen, tripId, orgId]);

  async function loadTripPlan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/trips/${encodeURIComponent(tripId)}/ai-plan`
      );
      const payload = (await res.json()) as {
        data?: AiTripPlanSummary;
        error?: { message?: string };
      };
      if (!res.ok || !payload.data) {
        throw new Error(
          payload.error?.message || "Failed to load AI trip planning recommendations."
        );
      }
      setSummary(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error analyzing trip plan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApplySequence() {
    if (!summary) return;
    setApplying(true);
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/trips/${encodeURIComponent(tripId)}/ai-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply",
            proposedStopOrder: summary.suggestedSequence.proposedSequence.map((s) => ({
              storeId: s.storeId,
            })),
            confirmApprovedTripModification: confirmApproved,
          }),
        }
      );

      const payload = (await res.json()) as {
        data?: unknown;
        error?: { message?: string };
      };
      if (!res.ok || payload.error) {
        throw new Error(
          payload.error?.message || "Failed to apply recommended visit sequence."
        );
      }

      showToast(
        "Trip stop sequence updated according to AI route recommendation.",
        "success"
      );
      if (onTripUpdated) {
        onTripUpdated();
      }
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to apply sequence.",
        "error"
      );
    } finally {
      setApplying(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Trip Planning Assistant">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          maxHeight: "75vh",
          overflowY: "auto",
          paddingRight: "0.25rem",
        }}
      >
        {/* Banner */}
        <div
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
            border: "1px solid #C7D2FE",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginBottom: "0.25rem",
              }}
            >
              <strong style={{ fontSize: "0.9375rem", color: "var(--brand-primary)" }}>
                Itinerary Synthesis for &ldquo;{tripTitle}&rdquo;
              </strong>
              <span
                className="status-badge"
                style={{
                  background: "rgba(79, 70, 229, 0.12)",
                  color: "var(--brand-primary)",
                  fontSize: "0.7rem",
                }}
              >
                Advisory Draft • Requires Human Approval
              </span>
            </div>
            <p
              style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}
            >
              Evaluates assigned store stops, potential scheduling conflicts, stop
              density, and optimized travel sequence using verified FieldTrack records.
            </p>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
            <div
              className="spinner"
              style={{ margin: "0 auto 1rem", width: "2rem", height: "2rem" }}
            />
            <p
              style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}
            >
              Analyzing trip schedule, store locations, and route sequences...
            </p>
          </div>
        )}

        {error && !loading && (
          <ErrorState
            title="Analysis Unavailable"
            message={error}
            onRetry={loadTripPlan}
          />
        )}

        {summary && !loading && (
          <>
            {/* Quick KPI Strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Workload
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color:
                      summary.workloadSummary.workloadStatus === "excessive"
                        ? "var(--error-red)"
                        : "var(--brand-dark)",
                  }}
                >
                  {summary.workloadSummary.workloadStatus.toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {summary.totalStops} stops planned
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Conflicts
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color:
                      summary.conflicts.length > 0
                        ? "var(--brand-accent)"
                        : "var(--success-green)",
                  }}
                >
                  {summary.conflicts.length === 0
                    ? "None Detected"
                    : `${summary.conflicts.length} Warning(s)`}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {summary.conflicts.filter((c) => c.severity === "high").length} high
                  severity
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Route Savings
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: summary.suggestedSequence.isReordered
                      ? "var(--success-green)"
                      : "var(--text-secondary)",
                  }}
                >
                  {summary.suggestedSequence.isReordered
                    ? `~${(summary.suggestedSequence.distanceSavingsMeters / 1000).toFixed(1)} km`
                    : "Optimal"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {summary.suggestedSequence.durationSavingsMinutes > 0
                    ? `~${summary.suggestedSequence.durationSavingsMinutes} mins saved`
                    : "No reordering needed"}
                </div>
              </div>
            </div>

            {/* Schedule Conflicts & Missing Details */}
            {summary.conflicts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h4
                  style={{ margin: 0, fontSize: "0.875rem", color: "var(--brand-dark)" }}
                >
                  ⚠️ Potential Scheduling & Workload Issues
                </h4>
                {summary.conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    style={{
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-sm)",
                      background: conflict.severity === "high" ? "#FEF2F2" : "#FFFBEB",
                      border:
                        conflict.severity === "high"
                          ? "1px solid #FECACA"
                          : "1px solid #FDE68A",
                      fontSize: "0.8125rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: conflict.severity === "high" ? "#B91C1C" : "#B45309",
                      }}
                    >
                      [{conflict.severity.toUpperCase()}]
                    </span>
                    <span style={{ color: "var(--brand-dark)", flex: 1 }}>
                      {conflict.description}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Sequence Recommendation */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4
                  style={{ margin: 0, fontSize: "0.875rem", color: "var(--brand-dark)" }}
                >
                  📍 Suggested Visit Sequence (Traveling Salesperson Analysis)
                </h4>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {summary.suggestedSequence.confidenceExplanation}
                </span>
              </div>

              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem",
                  background: "var(--bg-card)",
                }}
              >
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "1.25rem",
                    fontSize: "0.8125rem",
                    color: "var(--brand-dark)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  {summary.suggestedSequence.proposedSequence.map((ps) => (
                    <li key={ps.storeId} style={{ lineHeight: 1.4 }}>
                      <strong>{ps.storeName}</strong> {ps.city ? `(${ps.city})` : ""}
                      {!ps.hasCoordinates && (
                        <span
                          style={{
                            color: "var(--brand-accent)",
                            marginLeft: "0.5rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          (missing GPS)
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Recommendations & Follow-Ups */}
            {summary.recommendations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h4
                  style={{ margin: 0, fontSize: "0.875rem", color: "var(--brand-dark)" }}
                >
                  💡 Manager Guidance
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {summary.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "var(--radius-sm)",
                        background: "#F8FAFC",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          color: "var(--brand-primary)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {rec.title}
                      </div>
                      <p
                        style={{
                          margin: "0 0 0.25rem",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {rec.rationale}
                      </p>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--brand-dark)",
                          fontStyle: "italic",
                        }}
                      >
                        Suggested action: {rec.suggestedAction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Trip Warning Checkbox */}
            {tripStatus === "approved" && summary.suggestedSequence.isReordered && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8125rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmApproved}
                    onChange={(e) => setConfirmApproved(e.target.checked)}
                    style={{ marginTop: "0.15rem" }}
                  />
                  <span>
                    <strong>Trip is currently approved.</strong> Applying a new visit
                    sequence requires re-verifying the itinerary and will reset the trip
                    to draft for re-approval.
                  </span>
                </label>
              </div>
            )}

            {/* Evidence & Disclaimer Footer */}
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                lineHeight: 1.4,
                borderTop: "1px solid var(--border-color)",
                paddingTop: "0.75rem",
              }}
            >
              <p style={{ margin: "0 0 0.25rem" }}>
                <strong>Evidence Basis:</strong> {summary.evidenceExplanation}
              </p>
              <p style={{ margin: 0, fontStyle: "italic" }}>
                {summary.aiDisclaimer} (Model: {summary.modelUsed})
              </p>
            </div>
          </>
        )}

        {/* Modal Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "1rem",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={applying}
          >
            Dismiss
          </button>

          {summary?.suggestedSequence.isReordered && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplySequence}
              disabled={applying || (tripStatus === "approved" && !confirmApproved)}
            >
              {applying ? "Applying Sequence..." : "Apply Proposed Sequence"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
