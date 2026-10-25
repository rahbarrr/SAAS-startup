"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { QueuedOfflineOperation } from "@/lib/offline/sync-queue";

export function PwaOfflineSyncIndicator(): ReactNode {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  function refreshQueueStats() {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }

    try {
      let pending = 0;
      let conflicts = 0;

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("ft_sync_queue_")) {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const ops = JSON.parse(raw) as QueuedOfflineOperation[];
            if (Array.isArray(ops)) {
              for (const op of ops) {
                if (op.status === "pending" || op.status === "failed") {
                  pending++;
                } else if (op.status === "conflict") {
                  conflicts++;
                }
              }
            }
          }
        }
      }

      setPendingCount(pending);
      setConflictCount(conflicts);
    } catch {
      // Ignore local storage parse issues
    }
  }

  useEffect(() => {
    // 1. Initial offline state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setWasOffline(true);
    }

    refreshQueueStats();

    // 2. Connectivity event handlers
    function handleOnline() {
      setIsOffline(false);
      refreshQueueStats();
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
      refreshQueueStats();
    }

    function handleQueueChanged() {
      refreshQueueStats();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleQueueChanged);
    window.addEventListener("ft_offline_queue_changed", handleQueueChanged);

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
          console.debug("[SW] Registration skipped or unavailable:", err);
        });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleQueueChanged);
      window.removeEventListener("ft_offline_queue_changed", handleQueueChanged);
    };
  }, [wasOffline]);

  async function handleTriggerSync() {
    setIsSyncing(true);
    try {
      // Notify components to process local queues
      window.dispatchEvent(new CustomEvent("ft_process_sync_request"));
      await new Promise((r) => setTimeout(r, 1200));
      refreshQueueStats();
    } finally {
      setIsSyncing(false);
    }
  }

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
            <strong>Offline Mode:</strong> Network disconnected. Checklist answers and
            captured evidence are saved locally on device.
            {pendingCount > 0 ? (
              <span style={{ marginLeft: "0.35rem", fontWeight: 700 }}>
                ({pendingCount} mutation{pendingCount === 1 ? "" : "s"} queued for sync)
              </span>
            ) : null}
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
          Local Storage Only
        </span>
      </aside>
    );
  }

  if (conflictCount > 0) {
    return (
      <aside
        role="status"
        aria-live="assertive"
        style={{
          backgroundColor: "#fef2f2",
          color: "#991b1b",
          borderBottom: "1px solid #fecaca",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>Sync Conflict Detected:</strong> {conflictCount} queued record(s) were
            modified concurrently on the server. Please review before overwriting.
          </span>
        </div>
        <button
          type="button"
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
        >
          {isSyncing ? "Reviewing…" : "Review Conflicts"}
        </button>
      </aside>
    );
  }

  if (pendingCount > 0) {
    return (
      <aside
        role="status"
        aria-live="polite"
        style={{
          backgroundColor: "#eff6ff",
          color: "#1e40af",
          borderBottom: "1px solid #bfdbfe",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span aria-hidden="true">🔄</span>
          <span>
            <strong>Pending Synchronization:</strong> You have {pendingCount} offline
            change{pendingCount === 1 ? "" : "s"} waiting to sync to the server.
          </span>
        </div>
        <button
          type="button"
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="btn btn-primary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
        >
          {isSyncing ? "Syncing…" : "Sync Now"}
        </button>
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
