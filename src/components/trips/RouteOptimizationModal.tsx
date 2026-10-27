"use client";

import { type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { RouteOptimizationProposal } from "@/modules/routing/domain";

export interface RouteOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: RouteOptimizationProposal | null;
  isApplying: boolean;
  isApprovedTrip: boolean;
  onApply: (proposal: RouteOptimizationProposal) => Promise<void>;
}

export function RouteOptimizationModal({
  isOpen,
  onClose,
  proposal,
  isApplying,
  isApprovedTrip,
  onApply,
}: RouteOptimizationModalProps): ReactNode {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !proposal) return null;

  const originalKm = (proposal.originalDistanceMeters / 1000).toFixed(1);
  const proposedKm = (proposal.proposedDistanceMeters / 1000).toFixed(1);
  const savedKm = (proposal.distanceSavingsMeters / 1000).toFixed(1);

  async function handleApplyClick() {
    if (!proposal) return;
    setError(null);
    try {
      await onApply(proposal);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply optimized route order."
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Multi-Stop Route Optimization"
      maxWidth="42rem"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isApplying}
          >
            Keep Original Sequence
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApplyClick}
            disabled={isApplying || proposal.percentageSavings === 0}
          >
            {isApplying ? "Applying Sequence…" : "Apply Optimized Order"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error ? (
          <div
            role="alert"
            style={{
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "#fee2e2",
              color: "#991c1c",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "0.875rem 1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#1e293b",
              marginBottom: "0.25rem",
            }}
          >
            Optimization Objective
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
            Minimizing total transit distance across planned store stops using
            Nearest-Neighbor tour construction and 2-Opt path uncrossing.
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}
        >
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#f1f5f9",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Original Distance
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1e293b",
                marginTop: "0.25rem",
              }}
            >
              {originalKm} km
            </div>
          </div>
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#f1f5f9",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Proposed Distance
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0f766e",
                marginTop: "0.25rem",
              }}
            >
              {proposedKm} km
            </div>
          </div>
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                color: "#065f46",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Estimated Savings
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#047857",
                marginTop: "0.25rem",
              }}
            >
              {savedKm} km ({proposal.percentageSavings}%)
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            color: "#64748b",
            backgroundColor: "#fffbeb",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid #fef3c7",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div>
            <strong>Routing Provider:</strong>{" "}
            <span
              style={{
                fontWeight: 600,
                color:
                  proposal.providerName === "google"
                    ? "#1d4ed8"
                    : proposal.providerName === "osrm"
                      ? "#0f766e"
                      : "#b45309",
              }}
            >
              {proposal.providerName === "google"
                ? "Google Routes (Road-Network Driving)"
                : proposal.providerName === "osrm"
                  ? "OSRM (Road-Network Driving)"
                  : "Haversine (Geodesic Straight-Line)"}
            </span>
          </div>
          <div>
            ⚠️ <strong>Measurement Notice:</strong> {proposal.distanceDisclaimer}
          </div>
        </div>

        {isApprovedTrip ? (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#b45309",
              backgroundColor: "#fef3c7",
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius-sm)",
            }}
          >
            ℹ️ <strong>Approval Notice:</strong> This trip is currently approved.
            Re-ordering stops will reset its status to draft and require manager
            re-approval.
          </div>
        ) : null}

        <div>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#334155" }}>
            Stop Sequence Comparison
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              fontSize: "0.8125rem",
            }}
          >
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "var(--radius-md)",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: "#64748b",
                  marginBottom: "0.35rem",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "0.25rem",
                }}
              >
                Current Order ({proposal.originalOrder.length})
              </div>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {proposal.originalOrder.map((stop) => (
                  <li key={`orig-${stop.id}`}>
                    <span style={{ fontWeight: 500 }}>{stop.storeName}</span>{" "}
                    <span style={{ color: "#64748b" }}>({stop.city})</span>
                  </li>
                ))}
              </ol>
            </div>

            <div
              style={{
                border: "1px solid #0f766e",
                borderRadius: "var(--radius-md)",
                padding: "0.5rem",
                backgroundColor: "#f0fdfa",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: "#0f766e",
                  marginBottom: "0.35rem",
                  borderBottom: "1px solid #ccfbf1",
                  paddingBottom: "0.25rem",
                }}
              >
                Proposed Order ({proposal.proposedOrder.length})
              </div>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {proposal.proposedOrder.map((stop) => (
                  <li key={`prop-${stop.id}`}>
                    <span style={{ fontWeight: 600, color: "#115e59" }}>
                      {stop.storeName}
                    </span>{" "}
                    <span style={{ color: "#0f766e" }}>({stop.city})</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {proposal.explanation ? (
          <div style={{ fontSize: "0.8125rem", color: "#475569", fontStyle: "italic" }}>
            {proposal.explanation}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
