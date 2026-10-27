"use client";

import type { ReactNode } from "react";
import type { GoogleMapsStatus } from "./useGoogleMaps";

export interface MapsUnavailableNoticeProps {
  status: GoogleMapsStatus;
  errorMessage?: string | null;
  featureName?: string;
}

export function MapsUnavailableNotice({
  status,
  errorMessage,
  featureName = "Interactive map and location search",
}: MapsUnavailableNoticeProps): ReactNode {
  if (status === "ready") return null;

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "1rem",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--bg-subtle, #f9fafb)",
          border: "1px dashed var(--border-strong, #cbd5e1)",
          color: "var(--text-muted, #64748b)",
          fontSize: "0.875rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "1rem",
            height: "1rem",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>Loading Google Maps…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        style={{
          padding: "0.875rem 1rem",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--status-danger-bg, #fef2f2)",
          border: "1px solid var(--status-danger-border, #fecaca)",
          color: "var(--status-danger-text, #991b1b)",
          fontSize: "0.875rem",
        }}
      >
        <strong>Google Maps failed to load:</strong>{" "}
        {errorMessage || "Check network connection or API key configuration."}
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", opacity: 0.9 }}>
          You can still enter store coordinates manually below.
        </p>
      </div>
    );
  }

  // unconfigured
  return (
    <div
      role="status"
      style={{
        padding: "0.875rem 1rem",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-subtle, #f8fafc)",
        border: "1px dashed var(--border-strong, #cbd5e1)",
        color: "var(--text-secondary, #475569)",
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.25rem",
        }}
      >
        <span style={{ fontSize: "1rem" }}>🗺️</span>
        <strong>{featureName} is unconfigured</strong>
      </div>
      <p
        style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted, #64748b)" }}
      >
        To enable Google Maps and Places autocomplete, set{" "}
        <code
          style={{
            fontSize: "0.75rem",
            padding: "0.1rem 0.3rem",
            borderRadius: "4px",
            backgroundColor: "#e2e8f0",
          }}
        >
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        in your environment. Manual coordinate entry remains fully supported.
      </p>
    </div>
  );
}
