"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
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
  mode: "create" | "edit";
  initialTitle?: string;
  initialPurpose?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialStatus?: TripStatus;
  initialStops?: readonly EditableStopItem[];
  availableStores?: readonly AvailableStoreOption[];
}

const DEFAULT_ACTIVE_STORES: readonly AvailableStoreOption[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    name: "Downtown Fresh Mart #101",
    region: "North-Central",
    city: "Chicago",
    active: true,
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    name: "Lakeside Supercenter #204",
    region: "North-East",
    city: "Chicago",
    active: true,
  },
];

export function TripPlanForm({
  mode,
  initialTitle = "",
  initialPurpose = "",
  initialStartDate = "2026-10-25",
  initialEndDate = "2026-10-26",
  initialStatus = "draft",
  initialStops = [],
  availableStores = DEFAULT_ACTIVE_STORES,
}: TripPlanFormProps): ReactNode {
  const [title, setTitle] = useState(initialTitle);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [status, setStatus] = useState<TripStatus>(initialStatus);
  const [stops, setStops] = useState<EditableStopItem[]>([...initialStops]);
  const [selectedStoreId, setSelectedStoreId] = useState(
    availableStores.find((s) => s.active)?.id ?? ""
  );

  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const activeStores = availableStores.filter((s) => s.active);

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

  function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
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

    const wasApproved = status === "approved";
    if (wasApproved) {
      setStatus("draft");
      setConfirmation(
        "Approved trip updated and reset to Draft. Please submit again for a new manager approval cycle."
      );
      return;
    }

    setConfirmation(
      mode === "create"
        ? `Draft trip "${title.trim()}" saved with ${stops.length} ordered stop(s).`
        : `Trip "${title.trim()}" updated with ${stops.length} ordered stop(s).`
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className="card-header">
        <div>
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
          style={{ padding: "0.875rem 1.25rem", textAlign: "left" }}
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
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Trip Title *
            </label>
            <input
              id="trip-title"
              type="text"
              required
              minLength={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q4 Endcap Audit — Downtown"
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
              htmlFor="trip-purpose"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Purpose / Objective
            </label>
            <input
              id="trip-purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Verify promotional endcap compliance and restock"
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
              htmlFor="trip-start-date"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Start Date *
            </label>
            <input
              id="trip-start-date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
              htmlFor="trip-end-date"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              End Date *
            </label>
            <input
              id="trip-end-date"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

        <section
          aria-labelledby="stops-builder-heading"
          style={{
            borderTop: "1px solid var(--border-default)",
            paddingTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
          }}
        >
          <h2 id="stops-builder-heading" className="card-title">
            Ordered Store Stops ({stops.length})
          </h2>
          <p className="card-meta">
            Add active organization stores in visit sequence (1..N). Duplicate stores
            within the same trip are prevented.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div style={{ flex: "1 1 16rem" }}>
              <label
                htmlFor="add-stop-store-select"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Select Active Store
              </label>
              <select
                id="add-stop-store-select"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.region} — {store.city})
                  </option>
                ))}
              </select>
            </div>

            <button type="button" onClick={handleAddStop} className="btn btn-secondary">
              + Add Store Stop
            </button>
          </div>

          {stops.length === 0 ? (
            <p className="card-meta">
              No stops added yet. At least 1 store stop is required before submitting for
              approval.
            </p>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {stops.map((stop, idx) => {
                const storeInfo = availableStores.find((s) => s.id === stop.storeId);
                return (
                  <li
                    key={stop.storeId}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.75rem 1rem",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-subtle)",
                    }}
                  >
                    <div>
                      <strong>
                        Stop #{idx + 1}: {storeInfo?.name ?? stop.storeId}
                      </strong>
                      {storeInfo ? (
                        <span className="card-meta" style={{ display: "block" }}>
                          {storeInfo.region} • {storeInfo.city}
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleMoveStop(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move stop ${idx + 1} up`}
                        className="btn btn-secondary"
                        style={{ padding: "0.375rem 0.75rem" }}
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStop(idx, 1)}
                        disabled={idx === stops.length - 1}
                        aria-label={`Move stop ${idx + 1} down`}
                        className="btn btn-secondary"
                        style={{ padding: "0.375rem 0.75rem" }}
                      >
                        ↓ Down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        aria-label={`Remove stop ${idx + 1}`}
                        className="btn btn-secondary"
                        style={{ padding: "0.375rem 0.75rem" }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary">
            {mode === "create" ? "Save Trip Draft" : "Save Trip Changes"}
          </button>
          <Link href="/trips" className="btn btn-secondary">
            Back to Trips
          </Link>
        </div>
      </form>
    </div>
  );
}
