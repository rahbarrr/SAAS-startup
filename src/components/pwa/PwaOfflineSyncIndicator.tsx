"use client";

import { useEffect, useState, type ReactNode } from "react";

export function PwaOfflineSyncIndicator(): ReactNode {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);

  useEffect(() => {
    // 1. Initial offline state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setWasOffline(true);
    }

    // 2. Connectivity event handlers
    function handleOnline() {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnectedBanner(true);
        setTimeout(() => {
          setShowReconnectedBanner(false);
          setWasOffline(false);
        }, 4000);
      }
    }

    function handleOffline() {
      setIsOffline(true);
      setWasOffline(true);
      setShowReconnectedBanner(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 3. Register Service Worker for offline shell caching
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (
                  installing.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New content is available; will activate on next reload
                }
              });
            }
          });
        })
        .catch((err) => {
          // SW registration is non-fatal for primary browsing
          console.debug("[SW] Registration skipped or unavailable:", err);
        });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  if (isOffline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        style={{
          backgroundColor: "var(--color-warning-subtle, #fef3c7)",
          color: "var(--color-warning-text, #92400e)",
          borderBottom: "1px solid var(--color-warning-border, #fcd34d)",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span aria-hidden="true">📡</span>
          <span>
            <strong>Offline Mode:</strong> No internet connection detected. Changes and
            checklist answers are saved locally on your device and will sync when
            reconnected.
          </span>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor: "#f59e0b",
            color: "#ffffff",
            padding: "0.15rem 0.5rem",
            borderRadius: "9999px",
            fontWeight: 700,
          }}
        >
          Local Only
        </span>
      </aside>
    );
  }

  if (showReconnectedBanner) {
    return (
      <aside
        role="status"
        aria-live="polite"
        style={{
          backgroundColor: "var(--color-success-subtle, #d1fae5)",
          color: "var(--color-success-text, #065f46)",
          borderBottom: "1px solid var(--color-success-border, #6ee7b7)",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span aria-hidden="true">✓</span>
        <span>
          <strong>Back Online:</strong> Internet connection restored. Ready to sync with
          server.
        </span>
      </aside>
    );
  }

  return null;
}
