"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import type { Store } from "@/modules/stores/domain";

export default function StoresPage(): ReactNode {
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!name.trim() || !region.trim() || !addressLine1.trim() || !city.trim()) {
      setError("Name, region, street address, and city are required.");
      return;
    }

    const hasLat = latitude.trim().length > 0;
    const hasLng = longitude.trim().length > 0;
    if (hasLat !== hasLng) {
      setError(
        "Latitude and longitude must both be provided together or both left blank."
      );
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

    const now = new Date().toISOString();
    const created: Store = {
      id: crypto.randomUUID(),
      orgId: "active-org",
      name: name.trim(),
      region: region.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: null,
      city: city.trim(),
      stateProvince: stateProvince.trim() || null,
      postalCode: postalCode.trim() || null,
      countryCode: "US",
      latitude: parsedLat,
      longitude: parsedLng,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    setStores((prev) => [created, ...prev]);
    setName("");
    setRegion("");
    setAddressLine1("");
    setCity("");
    setStateProvince("");
    setPostalCode("");
    setLatitude("");
    setLongitude("");
    setConfirmation(`Store "${created.name}" created in your organization.`);
  }

  const visibleStores = stores.filter((store) => {
    if (!showArchived && !store.active) return false;
    if (
      regionFilter.trim() &&
      store.region.toLowerCase() !== regionFilter.trim().toLowerCase()
    ) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        store.name.toLowerCase().includes(q) ||
        store.city.toLowerCase().includes(q) ||
        store.region.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (isLoading) {
    return <LoadingState label="Loading organization stores…" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="stores-heading">
        <h1 id="stores-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Organization Store Directory
        </h1>
        <p className="card-meta">
          Manage active retail and FMCG locations scoped to your organization.
        </p>
      </section>

      {error ? (
        <ErrorState
          title="Store validation error"
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

      <section className="card" aria-labelledby="filter-stores-heading">
        <h2 id="filter-stores-heading" className="card-title">
          Search &amp; Filter Stores
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
            gap: "0.75rem",
            alignItems: "end",
          }}
        >
          <div>
            <label
              htmlFor="store-search"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Search by Name, City, or Region
            </label>
            <input
              id="store-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Downtown Fresh Mart"
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
              htmlFor="store-region-filter"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Region Filter
            </label>
            <input
              id="store-region-filter"
              type="text"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              placeholder="e.g. North-Central"
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              minHeight: "var(--touch-target-min)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ width: "1.25rem", height: "1.25rem" }}
            />
            <span>Include archived stores</span>
          </label>
        </div>
      </section>

      {visibleStores.length === 0 ? (
        <EmptyState
          title="No stores match the current filter"
          description="Add a retail store below or adjust your search criteria. Archived stores cannot be selected for new trips."
        />
      ) : (
        <section className="card-grid" aria-label="Organization stores">
          {visibleStores.map((store) => (
            <article key={store.id} className="card">
              <div className="card-header">
                <h3 className="card-title">{store.name}</h3>
                <span
                  className={`status-badge ${
                    store.active ? "status-badge--success" : "status-badge--neutral"
                  }`}
                >
                  {store.active ? "✓ Active" : "Archived"}
                </span>
              </div>
              <p className="card-meta">
                <strong>Region:</strong> {store.region} • {store.addressLine1},{" "}
                {store.city}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginTop: "0.5rem",
                }}
              >
                <Link href={`/stores/${store.id}`} className="btn btn-secondary">
                  View / Edit Store
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="card" aria-labelledby="add-store-heading">
        <h2 id="add-store-heading" className="card-title">
          Add Organization Store
        </h2>
        <form
          onSubmit={handleCreateStore}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="card-grid">
            <div>
              <label
                htmlFor="new-store-name"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Store Name *
              </label>
              <input
                id="new-store-name"
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
                htmlFor="new-store-region"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Region *
              </label>
              <input
                id="new-store-region"
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
                htmlFor="new-store-address"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Street Address *
              </label>
              <input
                id="new-store-address"
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
                htmlFor="new-store-city"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                City *
              </label>
              <input
                id="new-store-city"
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
                htmlFor="new-store-lat"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Latitude (optional, -90 to 90)
              </label>
              <input
                id="new-store-lat"
                type="text"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="41.8837"
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
                htmlFor="new-store-lng"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Longitude (optional, -180 to 180)
              </label>
              <input
                id="new-store-lng"
                type="text"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-87.6324"
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

          <div>
            <button type="submit" className="btn btn-primary">
              Create Store
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
