"use client";

import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ManagerDailyBriefing } from "@/modules/ai-intelligence/domain";

export interface AiInsightsClientProps {
  orgId: string;
  userRole?: string;
  initialBriefing?: ManagerDailyBriefing | null;
}

export function AiInsightsClient({
  orgId,
  userRole: _userRole = "manager",
  initialBriefing = null,
}: AiInsightsClientProps) {
  const { showToast } = useToast();
  const [briefing, setBriefing] = useState<ManagerDailyBriefing | null>(initialBriefing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Executive summary editable state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState(initialBriefing?.executiveSummary ?? "");

  // Local actions tracking
  const [actionStatuses, setActionStatuses] = useState<Record<string, "pending" | "accepted" | "dismissed">>({});

  async function refreshBriefing() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/ai/briefing`);
      const payload = (await res.json()) as { data?: ManagerDailyBriefing; error?: { message?: string } };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error?.message || "Failed to load live daily briefing.");
      }
      setBriefing(payload.data);
      setEditedSummary(payload.data.executiveSummary);
      showToast("Live operations briefing updated.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error refreshing briefing.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAction(actionId: string, status: "accepted" | "dismissed") {
    setActionStatuses((prev) => ({ ...prev, [actionId]: status }));
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/ai/briefing/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, status }),
      });
      const payload = (await res.json()) as { error?: { message?: string } };
      if (!res.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to update action status.");
      }
      showToast(
        status === "accepted" ? "Follow-up action accepted and recorded." : "Recommendation dismissed.",
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to record action.", "error");
    }
  }

  function handleSaveSummary() {
    if (briefing) {
      setBriefing({
        ...briefing,
        executiveSummary: editedSummary,
      });
    }
    setIsEditingSummary(false);
    showToast("Manager revisions to executive summary saved.", "success");
  }

  if (loading && !briefing) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <div className="spinner" style={{ margin: "0 auto 1rem", width: "2rem", height: "2rem" }} />
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>Synthesizing authorized operations briefing...</p>
      </div>
    );
  }

  if (error && !briefing) {
    return (
      <ErrorState
        title="Operations Briefing Unavailable"
        message={error}
        onRetry={refreshBriefing}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Briefing Header Banner */}
      <div
        className="card"
        style={{
          borderLeft: "4px solid var(--brand-primary)",
          padding: "1.25rem 1.5rem",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F9FAFF 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(27, 53, 128, 0.1)",
                  color: "var(--brand-primary)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.025em",
                }}
              >
                ✨ AI OPERATIONS SYNTHESIS
              </span>
              <span
                className="status-badge"
                style={{
                  background: "rgba(79, 70, 229, 0.12)",
                  color: "var(--brand-primary)",
                  fontSize: "0.75rem",
                }}
              >
                Daily Briefing: {briefing?.briefingDate ?? new Date().toISOString().slice(0, 10)}
              </span>
              <span
                className="status-badge"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "var(--brand-accent)",
                  fontSize: "0.75rem",
                }}
              >
                Advisory Draft • Requires Human Review
              </span>
            </div>

            <h2 style={{ fontSize: "1.35rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
              {briefing?.summaryHeadline ?? "Manager's Daily Operations Intelligence"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Data retrieved at {briefing ? new Date(briefing.retrievedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"} UTC. Powered by {briefing?.modelUsed ?? "FieldTrack Engine"}.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshBriefing}
            disabled={loading}
            style={{ fontSize: "0.8125rem" }}
          >
            {loading ? "Refreshing…" : "🔄 Refresh Live Data"}
          </button>
        </div>
      </div>

      {/* Operational Metrics Ribbon */}
      {briefing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
          <div style={{ padding: "0.875rem", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Trips Today</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--brand-dark)" }}>{briefing.metrics.tripsScheduledToday}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Active work itineraries</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Visits Scheduled</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--brand-dark)" }}>{briefing.metrics.visitsScheduledToday}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{briefing.metrics.completedVisitsCount} completed today</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Overdue Visits</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: briefing.metrics.overdueVisitsCount > 0 ? "var(--error-red)" : "var(--success-green)" }}>
              {briefing.metrics.overdueVisitsCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Passed appointment time</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Pending Approvals</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: briefing.metrics.pendingApprovalsCount > 0 ? "var(--brand-accent)" : "var(--success-green)" }}>
              {briefing.metrics.pendingApprovalsCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Submitted trips</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Missing Evidence</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: briefing.metrics.missingEvidenceCount > 0 ? "var(--brand-accent)" : "var(--success-green)" }}>
              {briefing.metrics.missingEvidenceCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Completed with 0 photos</div>
          </div>
        </div>
      )}

      {/* Executive Summary Card with Editability */}
      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
            Operational Executive Summary
          </h3>
          {!isEditingSummary ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditingSummary(true)}
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            >
              ✏️ Edit Summary
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditedSummary(briefing?.executiveSummary ?? "");
                  setIsEditingSummary(false);
                }}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSummary}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
              >
                Save Edits
              </button>
            </div>
          )}
        </div>

        {!isEditingSummary ? (
          <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--text-main)", lineHeight: 1.6 }}>
            {briefing?.executiveSummary ?? "No operational summary available for this period."}
          </p>
        ) : (
          <textarea
            rows={4}
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-strong)",
              fontFamily: "inherit",
              fontSize: "0.9375rem",
              lineHeight: 1.5,
            }}
          />
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
          <strong>Data Basis:</strong> {briefing?.dataCompleteness.explanation ?? "Synthesized from authorized records."}
        </div>
      </div>

      {/* Critical Operational Exceptions */}
      {briefing && briefing.criticalExceptions.length > 0 && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
            🚨 Critical Operational Exceptions ({briefing.criticalExceptions.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {briefing.criticalExceptions.map((exc) => (
              <div
                key={exc.id}
                style={{
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: exc.severity === "high" ? "#FEF2F2" : "#FFFBEB",
                  border: exc.severity === "high" ? "1px solid #FECACA" : "1px solid #FDE68A",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        color: exc.severity === "high" ? "#B91C1C" : "#B45309",
                      }}
                    >
                      [{exc.severity.toUpperCase()}] {exc.title}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--brand-dark)" }}>
                    {exc.detail}
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  Ref: {exc.sourceRecordId.slice(0, 8)}…
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Follow-Up Actions */}
      {briefing && briefing.recommendedActions.length > 0 && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
            ⚡ Recommended Manager Actions ({briefing.recommendedActions.length})
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.875rem" }}>
            {briefing.recommendedActions.map((action) => {
              const currentStatus = actionStatuses[action.id] ?? action.status;
              const isHandled = currentStatus !== "pending";

              return (
                <div
                  key={action.id}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    background: isHandled ? "#F8FAFC" : "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <strong style={{ fontSize: "0.875rem", color: "var(--brand-dark)" }}>
                        {action.title}
                      </strong>
                      <span
                        className="status-badge"
                        style={{
                          background:
                            currentStatus === "accepted"
                              ? "rgba(5, 150, 105, 0.12)"
                              : currentStatus === "dismissed"
                              ? "rgba(107, 114, 128, 0.12)"
                              : "rgba(79, 70, 229, 0.12)",
                          color:
                            currentStatus === "accepted"
                              ? "var(--success-green)"
                              : currentStatus === "dismissed"
                              ? "var(--text-secondary)"
                              : "var(--brand-primary)",
                          fontSize: "0.7rem",
                        }}
                      >
                        {currentStatus.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      {action.rationale}
                    </p>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                      Target: {action.targetEntityType} • Ref: {action.targetEntityId.slice(0, 8)}…
                    </div>
                  </div>

                  {!isHandled ? (
                    <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleUpdateAction(action.id, "accepted")}
                        style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem", flex: 1 }}
                      >
                        ✓ Accept Action
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleUpdateAction(action.id, "dismissed")}
                        style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                      Action recorded by manager.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Workload Imbalances */}
      {briefing && briefing.workloadImbalances.length > 0 && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.0625rem", color: "var(--brand-dark)" }}>
            👥 Representative Workload Distribution
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Representative</th>
                  <th style={{ textAlign: "center" }}>Active Trips</th>
                  <th style={{ textAlign: "center" }}>Planned Stops</th>
                  <th style={{ textAlign: "center" }}>Completed Visits</th>
                  <th style={{ textAlign: "center" }}>Outstanding</th>
                  <th style={{ textAlign: "left" }}>Status & Note</th>
                </tr>
              </thead>
              <tbody>
                {briefing.workloadImbalances.map((wl) => (
                  <tr key={wl.repUserId}>
                    <td style={{ fontWeight: 600 }}>{wl.repName}</td>
                    <td style={{ textAlign: "center" }}>{wl.assignedTripsCount}</td>
                    <td style={{ textAlign: "center" }}>{wl.plannedStopsCount}</td>
                    <td style={{ textAlign: "center" }}>{wl.completedVisitsCount}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: wl.outstandingAssignments > 8 ? "var(--brand-accent)" : "var(--brand-dark)" }}>
                      {wl.outstandingAssignments}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          background:
                            wl.status === "overloaded"
                              ? "rgba(220, 38, 38, 0.12)"
                              : wl.status === "underutilized"
                              ? "rgba(107, 114, 128, 0.12)"
                              : "rgba(5, 150, 105, 0.12)",
                          color:
                            wl.status === "overloaded"
                              ? "var(--error-red)"
                              : wl.status === "underutilized"
                              ? "var(--text-secondary)"
                              : "var(--success-green)",
                          fontSize: "0.7rem",
                          marginRight: "0.5rem",
                        }}
                      >
                        {wl.status.toUpperCase()}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>{wl.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insufficient Data State */}
      {briefing && !briefing.dataCompleteness.hasSufficientData && (
        <EmptyState
          title="Insufficient Operational Data"
          description={briefing.dataCompleteness.explanation}
        />
      )}

      {/* Disclaimers Footer */}
      {briefing && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5, textAlign: "center", padding: "0.5rem" }}>
          {briefing.aiDisclaimer} AI recommendations do not replace managerial judgement or organizational policies.
        </div>
      )}
    </div>
  );
}
