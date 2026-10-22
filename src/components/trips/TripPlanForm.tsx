"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { createInFlightActionGuard } from "@/lib/ux/formatting-and-resilience";
import type { TripStatus } from "@/modules/trips/domain";

export interface AvailableStoreOption {
  id: string;
  name: string;
  region: string;
  city: string;
  active: boolean;
}

export interface EditableStopItem {
  storeId: string;
  plannedAt: string;
}

export interface TripPlanFormProps {
  activeOrgId: string;
  tripId?: string;
  mode: "create" | "edit";
  initialTitle?: string;
  initialPurpose?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialStatus?: TripStatus;
  initialStops?: readonly EditableStopItem[];
  availableStores?: readonly AvailableStoreOption[];
}

export function TripPlanForm({
  activeOrgId,
  tripId,
  mode,
  initialTitle = "",
  initialPurpose = "",
  initialStartDate = new Date().toISOString().slice(0, 10),
  initialEndDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  initialStatus = "draft",
  initialStops = [],
  availableStores = [],
}: TripPlanFormProps): ReactNode {
  const [title, setTitle] = useState(initialTitle);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [status] = useState<TripStatus>(initialStatus);
  const [stops, setStops] = useState<EditableStopItem[]>([...initialStops]);
  const [selectedStoreId, setSelectedStoreId] = useState(
    availableStores.find((s) => s.active)?.id ?? ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const activeStores = availableStores.filter((s) => s.active);
  const actionGuard = createInFlightActionGuard();

  function handleAddStop() {
    setError(null);
    setConfirmation(null);

    if (!selectedStoreId) {
      setError("Please select an active store to add.");
      return;
    }

    if (stops.some((s) => s.storeId === selectedStoreId)) {
      setError("Duplicate store stop: this store is already in your trip stop list.");
      return;
    }

    setStops((prev) => [...prev, { storeId: selectedStoreId, plannedAt: "" }]);
  }

  function handleMoveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stops.length) {
      return;
    }
    setStops((prev) => {
      const next = [...prev];
      const current = next[index];
      const target = next[targetIndex];
      if (!current || !target) return prev;
      next[index] = target;
      next[targetIndex] = current;
      return next;
    });
  }

  function handleRemoveStop(index: number) {
    setStops((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);

    if (title.trim().length < 2) {
      setError("Trip title must be at least 2 characters.");
      return;
    }

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    if (stops.length === 0) {
      setError("Please add at least one planned store stop to the trip.");
      return;
    }

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const endpoint =
        mode === "create"
          ? `/api/orgs/${activeOrgId}/trips`
          : `/api/orgs/${activeOrgId}/trips/${tripId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          purpose: purpose.trim(),
          startDate,
          endDate,
          stops: stops.map((s, idx) => ({
            storeId: s.storeId,
            sequenceNumber: idx + 1,
            plannedAt: s.plannedAt || null,
          })),
        }),
      });

      const payload = (await res.json()) as {
        data?: { id: string; trip?: { id: string } };
        error?: { message: string };
      };

      if (!res.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to save field trip.");
      }

      const savedTripId = payload.data?.id || payload.data?.trip?.id || tripId;
      setConfirmation(
        mode === "create"
          ? `Draft trip "${title.trim()}" created successfully. Redirecting…`
          : `Trip "${title.trim()}" updated successfully. Redirecting…`
      );

      if (savedTripId) {
        setTimeout(() => {
          window.location.assign(`/trips/${savedTripId}`);
        }, 500);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving the trip."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className="card-header">
        <div>
          <Link
            href="/trips"
            className="card-meta"
            style={{ display: "inline-block", marginBottom: "0.5rem" }}
          >
            ← Back to Field Trips
          </Link>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
            {mode === "create" ? "Plan Field Trip" : "Edit Field Trip"}
          </h1>
          <p className="card-meta">
            Define your trip dates, purpose, and ordered store stops.
          </p>
        </div>
        <StatusBadge descriptor={getApprovalStatusDescriptor(status)} />
      </section>

      {status === "approved" ? (
        <div
          role="status"
          className="state-panel"
          style={{
            padding: "0.875rem 1.25rem",
            textAlign: "left",
            borderColor: "var(--status-warning-border)",
            backgroundColor: "var(--status-warning-bg)",
          }}
        >
          <strong>Re-Approval Policy:</strong> Saving changes to an approved trip resets
          its status to <strong>Draft</strong>, requires a new manager approval cycle, and
          records a <code>trip_reopened_for_edit</code> event in the audit trail.
        </div>
      ) : null}

      {error ? (
        <ErrorState
          title="Trip validation failed"
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

      <form
        onSubmit={handleSaveDraft}
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        <div className="card-grid">
          <div>
            <label
              htmlFor="trip-title"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Trip Title *
            </label>
            <input
              id="trip-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Endcap Audit — Downtown"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="trip-purpose"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Operational Purpose *
            </label>
            <input
              id="trip-purpose"
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Verify display compliance and restock levels"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>
        </div>

        <div className="card-grid">
          <div>
            <label
              htmlFor="start-date"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Start Date (YYYY-MM-DD) *
            </label>
            <input
              id="start-date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="end-date"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              End Date (YYYY-MM-DD) *
            </label>
            <input
              id="end-date"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>
        </div>

        <section aria-labelledby="stops-builder-heading" style={{ marginTop: "0.5rem" }}>
          <h2
            id="stops-builder-heading"
            style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
          >
            Planned Stops ({stops.length})
          </h2>
          <p className="card-meta" style={{ margin: "0 0 0.75rem" }}>
            Add and sequence retail stores in the exact order you plan to visit them.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            }}
          >
            <select
              aria-label="Select store to add"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              style={{
                flex: "1 1 15rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              {activeStores.length === 0 ? (
                <option value="">No active stores available in organization</option>
              ) : null}
              {activeStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.city}, {store.region})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAddStop}
              disabled={activeStores.length === 0}
              className="btn btn-secondary"
            >
              + Add Store Stop
            </button>
          </div>

          {stops.length === 0 ? (
            <div
              style={{
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-strong)",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              No stores added yet. Select a store above to add it to your trip route.
            </div>
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
              {stops.map((stop, idx) => {
                const store = availableStores.find((s) => s.id === stop.storeId);
                return (
                  <li
                    key={stop.storeId}
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
                      <strong>Stop #{idx + 1}:</strong> {store?.name ?? stop.storeId}
                      <span className="card-meta" style={{ marginLeft: "0.5rem" }}>
                        ({store?.city ?? "Store"}, {store?.region ?? ""})
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => handleMoveStop(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move stop ${idx + 1} up`}
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStop(idx, 1)}
                        disabled={idx === stops.length - 1}
                        aria-label={`Move stop ${idx + 1} down`}
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        aria-label={`Remove stop ${idx + 1}`}
                        style={{
                          padding: "0.25rem 0.5rem",
                          color: "var(--color-danger-text, #991b1b)",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="submit"
            disabled={isSubmitting || stops.length === 0}
            className="btn btn-primary"
          >
            {isSubmitting
              ? "Saving Trip…"
              : mode === "create"
                ? "Save Trip Draft"
                : "Save Changes"}
          </button>
          <Link href="/trips" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
