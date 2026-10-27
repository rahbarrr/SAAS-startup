"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import {
  LocationPickerMap,
  type PlaceSelectionResult,
  PlacesAutocompleteInput,
} from "@/components/maps";
import { createInFlightActionGuard } from "@/lib/ux/formatting-and-resilience";
import type { Store } from "@/modules/stores/domain";

export interface StoresDirectoryClientProps {
  activeOrgId: string;
  canWrite: boolean;
  initialStores: readonly Store[];
}

export function StoresDirectoryClient({
  activeOrgId,
  canWrite,
  initialStores,
}: StoresDirectoryClientProps): ReactNode {
  const [stores, setStores] = useState<Store[]>([...initialStores]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const dynamicClusters = useMemo(() => {
    const clusterMap = new Map<string, number>();
    for (const store of stores) {
      if (store.region) {
        clusterMap.set(store.region, (clusterMap.get(store.region) ?? 0) + 1);
      }
    }
    const colors = [
      "var(--brand-primary)",
      "var(--brand-dark)",
      "var(--brand-accent)",
      "var(--success-green)",
      "#8B5CF6",
      "#F59E0B",
    ];
    return Array.from(clusterMap.entries()).map(([clusterName, doors], idx) => ({
      name: clusterName,
      doors,
      color: colors[idx % colors.length],
    }));
  }, [stores]);

  // Form fields
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [placesSearch, setPlacesSearch] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const actionGuard = createInFlightActionGuard();

  function handlePlaceSelect(place: PlaceSelectionResult) {
    if (place.name && (!name || name === "Store")) setName(place.name);
    if (place.addressLine1) setAddressLine1(place.addressLine1);
    if (place.city) setCity(place.city);
    if (place.stateProvince) setStateProvince(place.stateProvince);
    if (place.postalCode) setPostalCode(place.postalCode);
    if (place.countryCode) setCountryCode(place.countryCode);
    if (place.latitude !== null) setLatitude(place.latitude.toString());
    if (place.longitude !== null) setLongitude(place.longitude.toString());
    setPlacesSearch(place.formattedAddress);
    setConfirmation(`Location selected from Google Places: ${place.formattedAddress}`);
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!name.trim() || !region.trim() || !addressLine1.trim() || !city.trim()) {
      setError("Name, region, street address, and city are required.");
      return;
    }

    const cleanCountry = countryCode.trim().toUpperCase() || "US";
    if (!/^[A-Z]{2}$/.test(cleanCountry)) {
      setError("Country code must be a 2-letter ISO code (e.g. US, CA, GB).");
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

    if (!actionGuard.tryAcquire()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          region: region.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: null,
          city: city.trim(),
          stateProvince: stateProvince.trim() || null,
          postalCode: postalCode.trim() || null,
          countryCode: cleanCountry,
          latitude: parsedLat,
          longitude: parsedLng,
        }),
      });

      const payload = (await res.json()) as {
        data?: Store;
        error?: { message: string };
      };

      if (!res.ok || payload.error || !payload.data) {
        throw new Error(
          payload.error?.message || "Failed to create store in your organization."
        );
      }

      const newStore = payload.data;
      setStores((prev) => [newStore, ...prev]);
      setName("");
      setRegion("");
      setAddressLine1("");
      setCity("");
      setStateProvince("");
      setPostalCode("");
      setCountryCode("US");
      setLatitude("");
      setLongitude("");
      setPlacesSearch("");
      setShowCreateForm(false);
      setConfirmation(`Store "${newStore.name}" successfully created.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error occurred while creating store."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
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

  const availableRegions = Array.from(new Set(stores.map((s) => s.region))).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="stores-heading">
        <div className="card-header">
          <div>
            <h1 id="stores-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
              Organization Store Directory
            </h1>
            <p className="card-meta">
              Manage active retail and FMCG locations scoped to your organization.
            </p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="btn btn-primary"
            >
              {showCreateForm ? "Cancel" : "+ Add Store"}
            </button>
          ) : null}
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

      {showCreateForm && canWrite ? (
        <section aria-labelledby="create-store-heading" className="card">
          <h2
            id="create-store-heading"
            style={{ margin: "0 0 1rem", fontSize: "1.25rem" }}
          >
            Add New Store Location
          </h2>
          <form
            onSubmit={handleCreateStore}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                htmlFor="places-search"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Search Address via Google Places
              </label>
              <PlacesAutocompleteInput
                id="places-search"
                value={placesSearch}
                onChange={setPlacesSearch}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search supermarket, retail chain, or street address…"
              />
              <span
                className="card-meta"
                style={{ fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}
              >
                Selecting a place automatically populates name, address, country, and
                coordinates.
              </span>
            </div>

            <div className="card-grid">
              <div>
                <label
                  htmlFor="store-name"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Store Name *
                </label>
                <input
                  id="store-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Downtown Supercenter #101"
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
                  htmlFor="store-region"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Region / Territory *
                </label>
                <input
                  id="store-region"
                  type="text"
                  required
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. North-Central"
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
                  htmlFor="store-address"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Street Address *
                </label>
                <input
                  id="store-address"
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. 100 Main St"
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
                  htmlFor="store-city"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  City *
                </label>
                <input
                  id="store-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Chicago"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
              </div>
            </div>

            <div
              className="card-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
            >
              <div>
                <label
                  htmlFor="store-state"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  State / Province
                </label>
                <input
                  id="store-state"
                  type="text"
                  value={stateProvince}
                  onChange={(e) => setStateProvince(e.target.value)}
                  placeholder="e.g. IL"
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
                  htmlFor="store-postal"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Postal Code
                </label>
                <input
                  id="store-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 60601"
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
                  htmlFor="store-country"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Country (ISO) *
                </label>
                <input
                  id="store-country"
                  type="text"
                  required
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="US"
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
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Interactive Location Picker
              </label>
              <LocationPickerMap
                latitude={
                  latitude.trim() && !Number.isNaN(Number(latitude))
                    ? Number(latitude)
                    : null
                }
                longitude={
                  longitude.trim() && !Number.isNaN(Number(longitude))
                    ? Number(longitude)
                    : null
                }
                onChange={(coords) => {
                  if (coords) {
                    setLatitude(coords.latitude.toString());
                    setLongitude(coords.longitude.toString());
                  } else {
                    setLatitude("");
                    setLongitude("");
                  }
                }}
              />
            </div>

            <div className="card-grid">
              <div>
                <label
                  htmlFor="store-lat"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Latitude (-90 to 90)
                </label>
                <input
                  id="store-lat"
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. 41.8837"
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
                  htmlFor="store-lng"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Longitude (-180 to 180)
                </label>
                <input
                  id="store-lng"
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. -87.6324"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                {isSubmitting ? "Saving Store…" : "Save Store"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card" aria-label="Store filters and search">
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}
        >
          <div style={{ flex: "1 1 12rem" }}>
            <label
              htmlFor="store-search"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Search Stores
            </label>
            <input
              id="store-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, city, or region…"
              style={{
                width: "100%",
                padding: "0.375rem 0.75rem",
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
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Region
            </label>
            <select
              id="store-region-filter"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <option value="">All Regions</option>
              {availableRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "1.25rem",
            }}
          >
            <input
              id="show-archived"
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <label htmlFor="show-archived" style={{ fontSize: "0.875rem" }}>
              Include Archived
            </label>
          </div>
        </div>
      </section>

      {/* Interactive Territory Clusters Schematic */}
      <section
        className="card"
        style={{
          padding: "1rem 1.25rem",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F9FAFF 100%)",
        }}
        aria-label="Territory Clusters Overview"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "var(--brand-dark)",
                margin: "0 0 0.2rem",
              }}
            >
              Regional Territory Clusters
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0 }}>
              Select a cluster to filter retail doors or view coverage health
            </p>
          </div>
          {regionFilter ? (
            <button
              type="button"
              onClick={() => setRegionFilter("")}
              style={{
                background: "none",
                border: "none",
                color: "var(--brand-primary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear Filter ({regionFilter})
            </button>
          ) : null}
        </div>

        {dynamicClusters.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>
            No territory clusters established yet. Add stores with regional identifiers to
            group them.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {dynamicClusters.map((cluster) => {
              const isSelected = regionFilter === cluster.name;
              return (
                <button
                  key={cluster.name}
                  type="button"
                  onClick={() => setRegionFilter(isSelected ? "" : cluster.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: isSelected
                      ? "2px solid var(--brand-primary)"
                      : "1px solid var(--border-subtle)",
                    background: isSelected ? "rgba(27, 53, 128, 0.06)" : "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: cluster.color,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--brand-dark)",
                        }}
                      >
                        {cluster.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {cluster.doors} {cluster.doors === 1 ? "door" : "doors"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {visibleStores.length === 0 ? (
        <EmptyState
          title="No stores found"
          description={
            canWrite
              ? "No stores match your current filters. Add a new store to your organization to get started."
              : "No stores match your current filters in this organization."
          }
        />
      ) : (
        <div className="card-grid">
          {visibleStores.map((store) => {
            return (
              <article
                key={store.id}
                className="card"
                style={{ opacity: store.active ? 1 : 0.65 }}
              >
                <div className="card-header">
                  <div>
                    <h2 className="card-title" style={{ fontSize: "1.125rem" }}>
                      <Link
                        href={`/stores/${store.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        {store.name}
                      </Link>
                    </h2>
                    <p className="card-meta">
                      {store.city}
                      {store.stateProvince ? `, ${store.stateProvince}` : ""} •{" "}
                      <strong>{store.region}</strong>
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.5rem",
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

                <p className="card-meta">{store.addressLine1}</p>

                {/* Regional Territory Tag */}
                <div style={{ margin: "0.375rem 0" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(27, 53, 128, 0.08)",
                      color: "var(--brand-primary)",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Territory: {store.region}
                  </span>
                </div>

                {store.latitude !== null && store.longitude !== null ? (
                  <p className="card-meta" style={{ fontSize: "0.75rem" }}>
                    📍 {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                  </p>
                ) : null}

                <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
                  <Link
                    href={`/stores/${store.id}`}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                  >
                    View Store Details →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
