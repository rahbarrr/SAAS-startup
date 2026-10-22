"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";

export default function StoreDetailPage(): ReactNode {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;

  const [name, setName] = useState("Downtown Fresh Mart #101");
  const [region, setRegion] = useState("North-Central");
  const [addressLine1, setAddressLine1] = useState("120 Main St");
  const [city, setCity] = useState("Chicago");
  const [latitude, setLatitude] = useState("41.8837");
  const [longitude, setLongitude] = useState("-87.6324");
  const [active, setActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleSave(event: FormEvent<HTMLFormElement>) {
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

    setConfirmation("Store details updated.");
  }

  function handleToggleArchive() {
    setError(null);
    const nextActive = !active;
    setActive(nextActive);
    setConfirmation(
      nextActive
        ? "Store restored to active status."
        : "Store archived. It can no longer be added to new trips."
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="store-detail-heading">
        <div className="card-header">
          <div>
            <h1
              id="store-detail-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              {name}
            </h1>
            <p className="card-meta">Store ID: {storeId}</p>
          </div>
          <span
            className={`status-badge ${
              active ? "status-badge--success" : "status-badge--neutral"
            }`}
          >
            {active ? "✓ Active Store" : "Archived Store"}
          </span>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Store update failed"
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

      <section className="card" aria-labelledby="edit-store-heading">
        <h2 id="edit-store-heading" className="card-title">
          Edit Store Details
        </h2>
        <form
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="card-grid">
            <div>
              <label
                htmlFor="edit-store-name"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Store Name *
              </label>
              <input
                id="edit-store-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                htmlFor="edit-store-region"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Region *
              </label>
              <input
                id="edit-store-region"
                type="text"
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
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
                htmlFor="edit-store-address"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Street Address *
              </label>
              <input
                id="edit-store-address"
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
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
                htmlFor="edit-store-city"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                City *
              </label>
              <input
                id="edit-store-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
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
                htmlFor="edit-store-lat"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Latitude
              </label>
              <input
                id="edit-store-lat"
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
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
                htmlFor="edit-store-lng"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Longitude
              </label>
              <input
                id="edit-store-lng"
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleToggleArchive}
              className="btn btn-secondary"
            >
              {active ? "Archive Store" : "Restore Store"}
            </button>
            <Link href="/stores" className="btn btn-secondary">
              Back to Store List
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
