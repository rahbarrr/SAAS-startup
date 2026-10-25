"use client";

import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import {
  type ClassifiedFailureFeedback,
  classifyRequestFailure,
  createInFlightActionGuard,
} from "@/lib/ux/formatting-and-resilience";
import type { InAppNotification } from "@/modules/notifications/domain";

export interface InAppNotificationsListProps {
  orgId: string | null;
  initialItems: readonly InAppNotification[];
  externalDeliveryDisclaimer: string;
}

export function InAppNotificationsList({
  orgId,
  initialItems,
  externalDeliveryDisclaimer,
}: InAppNotificationsListProps): ReactNode {
  const [items, setItems] = useState<readonly InAppNotification[]>(initialItems);
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [markingEventId, setMarkingEventId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);
  const [failureFeedback, setFailureFeedback] =
    useState<ClassifiedFailureFeedback | null>(null);
  const [lastFailedEventId, setLastFailedEventId] = useState<string | null>(null);

  const inFlightGuardRef = useRef(createInFlightActionGuard());

  const unreadCount = items.filter((item) => !item.isRead).length;
  const visibleItems =
    filterMode === "unread" ? items.filter((item) => !item.isRead) : items;
  const paginatedItems = visibleItems.slice(0, displayLimit);

  async function handleMarkAllAsRead(): Promise<void> {
    if (!orgId || unreadCount === 0) return;
    if (!inFlightGuardRef.current.tryAcquire()) return;

    setIsMarkingAllRead(true);
    setFailureFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/notifications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_all_read" }),
        }
      );

      const envelope = (await response.json()) as {
        data: { readAt: string } | null;
        error: { code?: string; message?: string } | null;
      };

      if (!response.ok || !envelope.data) {
        setFailureFeedback(
          classifyRequestFailure({
            status: response.status,
            errorCode: envelope.error?.code ?? null,
            errorMessage: envelope.error?.message ?? null,
          })
        );
        return;
      }

      const readAt = envelope.data.readAt;
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? readAt,
        }))
      );
      setLiveAnnouncement("All notifications marked as read.");
    } catch (networkError) {
      setFailureFeedback(classifyRequestFailure({ networkError }));
    } finally {
      inFlightGuardRef.current.release();
      setIsMarkingAllRead(false);
    }
  }

  async function handleMarkAsRead(auditEventId: string): Promise<void> {
    if (!orgId) {
      return;
    }

    // Synchronous double-click / multi-tap guard
    if (!inFlightGuardRef.current.tryAcquire()) {
      return;
    }

    setMarkingEventId(auditEventId);
    setFailureFeedback(null);
    setLastFailedEventId(null);

    try {
      const response = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/notifications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auditEventId }),
        }
      );

      const envelope = (await response.json()) as {
        data: { readAt: string } | null;
        error: { code?: string; message?: string } | null;
      };

      if (!response.ok || !envelope.data) {
        setLastFailedEventId(auditEventId);
        setFailureFeedback(
          classifyRequestFailure({
            status: response.status,
            errorCode: envelope.error?.code ?? null,
            errorMessage: envelope.error?.message ?? null,
          })
        );
        return;
      }

      const readAt = envelope.data.readAt;
      setItems((prev) =>
        prev.map((item) =>
          item.auditEventId === auditEventId ? { ...item, isRead: true, readAt } : item
        )
      );
      setLiveAnnouncement("Notification marked as read.");
    } catch (networkError) {
      setLastFailedEventId(auditEventId);
      setFailureFeedback(
        classifyRequestFailure({
          networkError,
        })
      );
    } finally {
      inFlightGuardRef.current.release();
      setMarkingEventId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        role="note"
        aria-label="Notification delivery channel disclosure"
        className="card"
        style={{
          padding: "0.75rem 1rem",
          backgroundColor: "var(--bg-subtle)",
          fontSize: "0.875rem",
        }}
      >
        <strong>Delivery Channel Disclosure:</strong> {externalDeliveryDisclaimer}
      </div>

      <section className="card" aria-labelledby="notifications-filter-heading">
        <div className="card-header" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 id="notifications-filter-heading" className="card-title">
              Committed Workflow Events ({unreadCount} Unread of {items.length})
            </h2>
            <p className="card-meta">
              Derived deterministically from committed <code>trip_audit_events</code>{" "}
              rows. Retries never create duplicate notifications.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter notifications by read state"
            style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}
          >
            <button
              type="button"
              className={filterMode === "all" ? "btn btn-primary" : "btn btn-secondary"}
              aria-pressed={filterMode === "all"}
              onClick={() => setFilterMode("all")}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              className={
                filterMode === "unread" ? "btn btn-primary" : "btn btn-secondary"
              }
              aria-pressed={filterMode === "unread"}
              onClick={() => setFilterMode("unread")}
            >
              Unread Only ({unreadCount})
            </button>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="btn btn-outline"
                disabled={isMarkingAllRead}
                onClick={() => {
                  void handleMarkAllAsRead();
                }}
              >
                {isMarkingAllRead ? "Marking All…" : "Mark All as Read"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {liveAnnouncement ? (
        <div
          role="status"
          aria-live="polite"
          className="sr-only-live"
          style={{
            padding: "0.625rem 0.875rem",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--status-success-bg)",
            color: "var(--status-success-text)",
            border: "1px solid var(--status-success-border)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {liveAnnouncement}
        </div>
      ) : null}

      {failureFeedback ? (
        <div>
          <ErrorState
            title={failureFeedback.title}
            message={failureFeedback.userMessage}
            onRetry={
              failureFeedback.canRetrySafely && lastFailedEventId
                ? () => {
                    void handleMarkAsRead(lastFailedEventId);
                  }
                : undefined
            }
          />
          {failureFeedback.requiresReauth ? (
            <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
              <Link href="/login" className="btn btn-primary">
                Sign In Again
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <EmptyState
          title={
            filterMode === "unread"
              ? "No unread in-app notifications"
              : "No committed submission or decision notifications yet"
          }
          description="When a field employee submits a trip or a manager approves, requests changes, or rejects a trip, the committed database event appears here automatically."
          actionLabel="View Field Trips"
          actionHref="/trips"
        />
      ) : (
        <>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            {paginatedItems.map((item) => (
              <li key={item.id} className="card">
                <div className="card-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3
                      className="card-title break-long-words"
                      title={item.tripTitle}
                      style={{ margin: "0 0 0.25rem" }}
                    >
                      {item.title}
                    </h3>
                    <p className="card-meta">
                      Event Timestamp: <code>{item.createdAtUtcLabel}</code> · Event ID:{" "}
                      <code>{item.auditEventId.slice(0, 8)}</code> · Channel:{" "}
                      <strong>In-App Only</strong>
                    </p>
                  </div>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(item.tripStatus)} />
                </div>

                <p className="break-long-words" style={{ margin: "0.25rem 0" }}>
                  {item.message}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Link href={item.actionHref} className="btn btn-secondary">
                    Open Trip / Review
                  </Link>

                  {item.isRead ? (
                    <span className="card-meta" aria-label="Notification read status">
                      ✓ Read {item.readAt ? `(${item.readAt.slice(0, 16)} UTC)` : ""}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={markingEventId === item.auditEventId}
                      onClick={() => {
                        void handleMarkAsRead(item.auditEventId);
                      }}
                    >
                      {markingEventId === item.auditEventId
                        ? "Saving Read State…"
                        : "Mark as Read"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {visibleItems.length > displayLimit ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDisplayLimit((prev) => prev + 10)}
              >
                Load More Notifications ({visibleItems.length - displayLimit} remaining)
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
