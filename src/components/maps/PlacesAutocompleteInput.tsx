"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useGoogleMaps } from "./useGoogleMaps";

export interface PlaceSelectionResult {
  name: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PlacesAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceSelectionResult) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Google Places Autocomplete input for searching retail addresses.
 * Gracefully acts as a standard text input when Google Maps is not configured.
 */
export function PlacesAutocompleteInput({
  id = "places-autocomplete",
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search store name or street address…",
  disabled = false,
  required = false,
}: PlacesAutocompleteInputProps): ReactNode {
  const { status, google } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (status !== "ready" || !google || !inputRef.current) return undefined;

    let listener: google.maps.MapsEventListener | null = null;

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ["address_components", "geometry", "name", "formatted_address"],
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place) return;

        let streetNumber = "";
        let route = "";
        let city = "";
        let stateProvince = "";
        let postalCode = "";
        let countryCode = "US";

        if (place.address_components) {
          for (const component of place.address_components) {
            const types = component.types;
            if (types.includes("street_number")) {
              streetNumber = component.long_name;
            } else if (types.includes("route")) {
              route = component.long_name;
            } else if (
              types.includes("locality") ||
              types.includes("sublocality_level_1") ||
              types.includes("postal_town")
            ) {
              if (!city) city = component.long_name;
            } else if (types.includes("administrative_area_level_1")) {
              stateProvince = component.short_name || component.long_name;
            } else if (types.includes("postal_code")) {
              postalCode = component.long_name;
            } else if (types.includes("country")) {
              countryCode = component.short_name?.toUpperCase() || "US";
            }
          }
        }

        const addressLine1 = streetNumber
          ? `${streetNumber} ${route}`.trim()
          : route || place.name || "";

        const lat = place.geometry?.location ? place.geometry.location.lat() : null;
        const lng = place.geometry?.location ? place.geometry.location.lng() : null;

        onPlaceSelect({
          name: place.name || addressLine1 || "Store",
          formattedAddress: place.formatted_address || addressLine1,
          addressLine1,
          city: city || stateProvince || "City",
          stateProvince: stateProvince || null,
          postalCode: postalCode || null,
          countryCode: countryCode.length === 2 ? countryCode : "US",
          latitude: lat !== null ? Number(lat.toFixed(6)) : null,
          longitude: lng !== null ? Number(lng.toFixed(6)) : null,
        });
      });

      autocompleteRef.current = autocomplete;
    } catch {
      // Degrades gracefully to standard text input
    }

    return () => {
      if (google.maps.event && listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [status, google, onPlaceSelect]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        style={{
          width: "100%",
          padding: "0.5rem 0.75rem",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-strong)",
          backgroundColor: "var(--bg-surface)",
        }}
      />
      {status === "ready" ? (
        <span
          style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
          title="Powered by Google Places"
        >
          📍 Places
        </span>
      ) : null}
    </div>
  );
}
