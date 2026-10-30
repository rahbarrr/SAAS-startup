"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";

export interface AuditLogViewerClientProps {
  orgId: string;
  initialEvents: OrganizationAuditEvent[];
  initialCursor?: string | null;
  userRole?: string;
}

export function AuditLogViewerClient({
  orgId,
  initialEvents,
  initialCursor,
  userRole = "field_employee",
}: AuditLogViewerClientProps) {
  const { showToast } = useToast();
  const [events, setEvents] = useState<OrganizationAuditEvent[]>(initialEvents);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [startDateFrom, setStartDateFrom] = useState<string>("");
  const [startDateTo, setStartDateTo] = useState<string>("");
  const [actorIdFilter, setActorIdFilter] = useState<string>("");

  // Inspect changes modal
  const [inspectingEvent, setInspectingEvent] = useState<OrganizationAuditEvent | null>(
    null
  );
  const isFirstMountRef = useRef(true);

  const fetchLogs = useCallback(
    async (cursor?: string | null) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        if (selectedAction !== "all") params.set("action", selectedAction);
        if (selectedEntity !== "all") params.set("entityType", selectedEntity);
        if (startDateFrom) params.set("startDateFrom", startDateFrom);
        if (startDateTo) params.set("startDateTo", startDateTo);
        if (actorIdFilter.trim()) params.set("actorUserId", actorIdFilter.trim());
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/orgs/${orgId}/audit?${params.toString()}`);
        const envelope = await res.json();
        if (!res.ok || !envelope.data) {
          throw new Error(envelope.error?.message || "Failed to load audit events.");
        }

        if (cursor) {
          setEvents((prev) => [...prev, ...envelope.data.items]);
        } else {
          setEvents(envelope.data.items);
        }
        setNextCursor(envelope.data.pagination.nextCursor);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load audit trail.";
        setErrorMessage(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId, selectedAction, selectedEntity, startDateFrom, startDateTo, actorIdFilter]
  );

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    void fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (selectedAction !== "all") params.set("action", selectedAction);
      if (selectedEntity !== "all") params.set("entityType", selectedEntity);
      if (startDateFrom) params.set("startDateFrom", startDateFrom);
      if (startDateTo) params.set("startDateTo", startDateTo);

      const res = await fetch(`/api/orgs/${orgId}/audit/export?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || "Audit export request failed.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fieldtrack-audit-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Audit log exported as ${format.toUpperCase()} (sanitized).`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed.";
      showToast(msg, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("approved") || action.includes("created")) {
      return { bg: "rgba(5, 150, 105, 0.12)", color: "var(--success-green, #059669)" };
    }
    if (
      action.includes("rejected") ||
      action.includes("revoked") ||
      action.includes("deleted")
    ) {
      return { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger-red, #ef4444)" };
    }
    if (action.includes("export") || action.includes("submitted")) {
      return { bg: "rgba(217, 119, 6, 0.12)", color: "var(--warning-amber, #d97706)" };
    }
    return { bg: "rgba(27, 53, 128, 0.1)", color: "var(--brand-primary, #1b3580)" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Governance & Immutability Notice */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          background: "rgba(27, 53, 128, 0.03)",
          border: "1px solid rgba(27, 53, 128, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🛡️</span>
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--brand-dark)",
                fontSize: "0.875rem",
              }}
            >
              Enterprise Immutable Audit Trail
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Protected by PostgreSQL append-only triggers and tenant RLS. Historical
              records cannot be modified or deleted.
            </div>
          </div>
        </div>

        {userRole === "admin" ? (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
            >
              {isExporting ? "Exporting…" : "Export Clean CSV"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport("json")}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
            >
              Export JSON
            </button>
          </div>
        ) : null}
      </div>

      {/* Filter Controls Bar */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}
          >
            Action Type
          </label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="input-field"
            style={{ height: "36px", minWidth: "160px" }}
          >
            <option value="all">All Actions</option>
            <option value="trip.created">Trip Created</option>
            <option value="trip.submitted">Trip Submitted</option>
            <option value="trip.approved">Trip Approved</option>
            <option value="trip.rejected">Trip Rejected</option>
            <option value="trip.route_optimized">Route Optimized</option>
            <option value="visit.checked_in">Visit Checked In</option>
            <option value="visit.checked_out">Visit Checked Out</option>
            <option value="member.invited">Member Invited</option>
            <option value="member.role_changed">Role Changed</option>
            <option value="audit.exported">Audit Exported</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}
          >
            Entity Type
          </label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="input-field"
            style={{ height: "36px", minWidth: "140px" }}
          >
            <option value="all">All Entities</option>
            <option value="trip">Trip</option>
            <option value="visit">Visit</option>
            <option value="store">Store</option>
            <option value="membership">Membership</option>
            <option value="organization">Organization</option>
            <option value="audit">Audit Log</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}
          >
            From Date (UTC)
          </label>
          <input
            type="date"
            value={startDateFrom}
            onChange={(e) => setStartDateFrom(e.target.value)}
            className="input-field"
            style={{ height: "36px" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}
          >
            To Date (UTC)
          </label>
          <input
            type="date"
            value={startDateTo}
            onChange={(e) => setStartDateTo(e.target.value)}
            className="input-field"
            style={{ height: "36px" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            flex: 1,
            minWidth: "180px",
          }}
        >
          <label
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}
          >
            Actor User ID
          </label>
          <input
            type="text"
            placeholder="Filter by actor UUID…"
            value={actorIdFilter}
            onChange={(e) => setActorIdFilter(e.target.value)}
            className="input-field"
            style={{ height: "36px" }}
          />
        </div>
      </div>

      {errorMessage ? (
        <ErrorState
          title="Audit Trail Load Error"
          message={errorMessage}
          onRetry={() => void fetchLogs()}
        />
      ) : null}

      {/* Events Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-responsive">
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ padding: "0.75rem 1rem" }}>Timestamp (UTC)</th>
                <th style={{ padding: "0.75rem 1rem" }}>Action</th>
                <th style={{ padding: "0.75rem 1rem" }}>Actor &amp; Role</th>
                <th style={{ padding: "0.75rem 1rem" }}>Entity</th>
                <th style={{ padding: "0.75rem 1rem" }}>Reason</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                    <EmptyState
                      title="No audit events found"
                      description="No recorded operational events match the active filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const badgeStyle = getActionBadgeColor(ev.actionType);
                  return (
                    <tr key={ev.id}>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.8125rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(ev.createdAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          className="status-badge"
                          style={{
                            background: badgeStyle.bg,
                            color: badgeStyle.color,
                            fontWeight: 600,
                            fontSize: "0.75rem",
                          }}
                        >
                          {ev.actionType}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
                          {ev.actorUserId ? ev.actorUserId.slice(0, 8) + "…" : "System"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {ev.actorRole ?? "automated"}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem" }}>
                        <span style={{ fontWeight: 600 }}>{ev.entityType}</span>:{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                          {ev.entityId.slice(0, 8)}…
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {ev.reason ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setInspectingEvent(ev)}
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {nextCursor ? (
          <div
            style={{
              padding: "1rem",
              textAlign: "center",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => void fetchLogs(nextCursor)}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              {isLoading ? "Loading next batch…" : "Load More Audit Records"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Changes Inspector Modal */}
      {inspectingEvent ? (
        <Modal
          isOpen={true}
          onClose={() => setInspectingEvent(null)}
          title={`Audit Event: ${inspectingEvent.actionType}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <div
              style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.5rem" }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                Event ID:
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                {inspectingEvent.id}
              </span>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                Timestamp:
              </span>
              <span>{inspectingEvent.createdAt} (UTC)</span>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Entity:</span>
              <span>
                {inspectingEvent.entityType} ({inspectingEvent.entityId})
              </span>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Actor:</span>
              <span>
                {inspectingEvent.actorUserId ?? "System"} (Role:{" "}
                {inspectingEvent.actorRole ?? "system"})
              </span>

              {inspectingEvent.correlationId ? (
                <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    Correlation:
                  </span>
                  <span style={{ fontFamily: "monospace" }}>
                    {inspectingEvent.correlationId}
                  </span>
                </>
              ) : null}

              {inspectingEvent.reason ? (
                <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    Reason:
                  </span>
                  <span>{inspectingEvent.reason}</span>
                </>
              ) : null}
            </div>

            <div>
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--brand-dark)",
                  marginBottom: "0.25rem",
                }}
              >
                Recorded State Changes (Sanitized):
              </div>
              <pre
                style={{
                  background: "var(--bg-canvas)",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.75rem",
                  overflowX: "auto",
                  maxHeight: "260px",
                }}
              >
                {JSON.stringify(inspectingEvent.changes, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
