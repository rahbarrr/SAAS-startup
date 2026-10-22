"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { createInFlightActionGuard } from "@/lib/ux/formatting-and-resilience";
import type { Store } from "@/modules/stores/domain";

export interface StoreDetailClientProps {
  store: Store;
  activeOrgId: string;
  canWrite: boolean;
}

export function StoreDetailClient({
  store: initialStore,
  activeOrgId,
  canWrite,
}: StoreDetailClientProps): ReactNode {
  const [store, setStore] = useState<Store>(initialStore);

  const [name, setName] = useState(store.name);
  const [region, setRegion] = useState(store.region);
  const [addressLine1, setAddressLine1] = useState(store.addressLine1);
  const [city, setCity] = useState(store.city);
  const [stateProvince, setStateProvince] = useState(store.stateProvince ?? "");
  const [postalCode, setPostalCode] = useState(store.postalCode ?? "");
  const [latitude, setLatitude] = useState(
    store.latitude !== null ? String(store.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    store.longitude !== null ? String(store.longitude) : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const actionGuard = createInFlightActionGuard();

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!name.trim() || !region.trim() || !addressLine1.trim() || !city.trim()) {
      setError("Store name, region, street address, and city are required.");
      return;
    }

    const hasLat = latitude.trim().length > 0;
    const hasLng = longitude.trim().length > 0;
    if (hasLat !== hasLng) {
      setError("Latitude and longitude must both be provided together or both cleared.");
      return;
    }

    let parsedLat: number | null = null;
    let parsedLng: number | null = null;
    if (hasLat && hasLng) {
      parsedLat = Number(latitude);
      parsedLng = Number(longitude);
      if (
        Number.isNaN(parsedLat) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        Number.isNaN(parsedLng) ||
        parsedLng < -180 ||
        parsedLng > 180
      ) {
        setError(
          "Coordinates out of range: latitude must be -90..90 and longitude -180..180."
        );
        return;
      }
    }

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          region: region.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: null,
          city: city.trim(),
          stateProvince: stateProvince.trim() || null,
          postalCode: postalCode.trim() || null,
          latitude: parsedLat,
          longitude: parsedLng,
        }),
      });

      const payload = (await res.json()) as {
        data?: Store;
        error?: { message: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message || "Failed to update store.");
      }

      setStore(payload.data);
      setConfirmation("Store details successfully updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error occurred while updating store."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  async function handleToggleArchive() {
    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    const nextActive = !store.active;
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: nextActive,
        }),
      });

      const payload = (await res.json()) as {
        data?: Store;
        error?: { message: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        throw new Error(
          payload.error?.message || "Failed to change store active status."
        );
      }

      setStore(payload.data);
      setConfirmation(
        nextActive
          ? "Store restored to active status."
          : "Store archived. It can no longer be added to new trips."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error occurred while updating status."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="store-detail-heading">
        <div className="card-header">
          <div>
            <Link
              href="/stores"
              className="card-meta"
              style={{ display: "inline-block", marginBottom: "0.5rem" }}
            >
              ← Back to Store Directory
            </Link>
            <h1 id="store-detail-heading" style={{ margin: 0, fontSize: "1.5rem" }}>
              {store.name}
            </h1>
            <p className="card-meta">
              Store ID: <code>{store.id}</code> • Region: <strong>{store.region}</strong>
            </p>
          </div>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              backgroundColor: store.active
                ? "var(--color-success-subtle, #ecfdf5)"
                : "var(--color-danger-subtle, #fef2f2)",
              color: store.active
                ? "var(--color-success-text, #065f46)"
                : "var(--color-danger-text, #991b1b)",
            }}
          >
            {store.active ? "Active" : "Archived"}
          </span>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Store operation failed"
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
        <form
          onSubmit={handleSave}
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Location Details</h2>

          <div>
            <label
              htmlFor="edit-name"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Store Name
            </label>
            <input
              id="edit-name"
              type="text"
              required
              disabled={!canWrite}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div className="card-grid">
            <div>
              <label
                htmlFor="edit-region"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Region / Territory
              </label>
              <input
                id="edit-region"
                type="text"
                required
                disabled={!canWrite}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
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
                htmlFor="edit-city"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                City
              </label>
              <input
                id="edit-city"
                type="text"
                required
                disabled={!canWrite}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-address"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Street Address
            </label>
            <input
              id="edit-address"
              type="text"
              required
              disabled={!canWrite}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <div className="card-grid">
            <div>
              <label
                htmlFor="edit-state"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                State / Province
              </label>
              <input
                id="edit-state"
                type="text"
                disabled={!canWrite}
                value={stateProvince}
                onChange={(e) => setStateProvince(e.target.value)}
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
                htmlFor="edit-postal"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Postal Code
              </label>
              <input
                id="edit-postal"
                type="text"
                disabled={!canWrite}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
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
                htmlFor="edit-lat"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Latitude
              </label>
              <input
                id="edit-lat"
                type="text"
                disabled={!canWrite}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
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
                htmlFor="edit-lng"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Longitude
              </label>
              <input
                id="edit-lng"
                type="text"
                disabled={!canWrite}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>
          </div>

          {canWrite ? (
            <div style={{ marginTop: "0.5rem" }}>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                {isSubmitting ? "Saving Changes…" : "Save Changes"}
              </button>
            </div>
          ) : null}
        </form>

        <section className="card" aria-labelledby="status-actions-heading">
          <h2
            id="status-actions-heading"
            style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}
          >
            Lifecycle &amp; Status
          </h2>
          <p className="card-meta">
            Archived stores remain linked to historical trips and audit trails, but cannot
            be selected for new trip planning.
          </p>

          {canWrite ? (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isSubmitting}
                className={`btn ${store.active ? "btn-secondary" : "btn-primary"}`}
                style={{ width: "100%" }}
              >
                {store.active ? "Archive Store" : "Restore Store"}
              </button>
            </div>
          ) : (
            <p className="card-meta" style={{ marginTop: "1rem" }}>
              Only managers and admins can change store status.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
