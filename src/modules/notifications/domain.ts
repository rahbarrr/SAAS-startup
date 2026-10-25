import {
  formatCalendarDateOnlyUtc,
  formatUtcTimestamp,
  truncateDisplayLabel,
} from "@/lib/ux/formatting-and-resilience";
import type { OrgRole } from "@/modules/tenancy/domain";
import type { Trip, TripAuditEvent, TripStatus } from "@/modules/trips/domain";

export const NOTIFICATION_EVENT_TYPES = [
  "trip_submitted",
  "trip_resubmitted",
  "trip_approved",
  "trip_changes_requested",
  "trip_rejected",
  "trip_started",
  "trip_completed",
] as const;

export type NotificationAuditEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export type InAppNotificationCategory =
  | "submission_awaiting_approval"
  | "approval_decision"
  | "workflow_event";

export interface ExternalProviderStatus {
  email: false;
  sms: false;
  push: false;
}

export interface InAppNotification {
  /** Deterministic ID derived from the committed `trip_audit_events.id` (`notif:<auditEventId>`) */
  id: string;
  auditEventId: string;
  orgId: string;
  tripId: string;
  tripTitle: string;
  tripTitleTruncated: string;
  tripDateRangeUtcLabel: string;
  tripStatus: TripStatus;
  eventType: NotificationAuditEventType;
  category: InAppNotificationCategory;
  recipientUserId: string;
  actorUserId: string;
  title: string;
  message: string;
  actionHref: string;
  createdAt: string;
  createdAtUtcLabel: string;
  isRead: boolean;
  readAt: string | null;
  deliveryChannel: "in_app_only";
  externalProvidersConfigured: ExternalProviderStatus;
  externalDeliveryDisclaimer: string;
}

export interface NotificationReadReceipt {
  orgId: string;
  auditEventId: string;
  userId: string;
  readAt: string;
}

export interface InAppNotificationsOverview {
  items: readonly InAppNotification[];
  unreadCount: number;
  totalCount: number;
  deliveryChannel: "in_app_only";
  externalProvidersConfigured: ExternalProviderStatus;
  externalDeliveryDisclaimer: string;
}

export const EXTERNAL_DELIVERY_DISCLAIMER =
  "In-app notification only (derived from committed database audit events). Email, SMS, and push providers are not configured, so no external messages were sent.";

export function isNotificationAuditEventType(
  eventType: string
): eventType is NotificationAuditEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(eventType);
}

/**
 * Pure, deterministic derivation of in-app notifications from committed `trip_audit_events` rows,
 * parent `trips`, and per-user `in_app_notification_reads` receipts.
 *
 * Guarantees idempotency:
 *   - Deduplicates by `auditEvent.id` so repeated calls or retried fetches never produce duplicates.
 *   - Routes `trip_submitted` / `trip_resubmitted` to active `manager` / `admin` members (excluding
 *     the trip owner, who cannot approve their own trip).
 *   - Routes `trip_approved` / `trip_changes_requested` / `trip_rejected` to the trip's `ownerUserId`.
 */
export function deriveInAppNotificationsFromCommittedEvents(params: {
  orgId: string;
  recipientUserId: string;
  recipientRole: OrgRole;
  trips: readonly Trip[];
  auditEvents: readonly TripAuditEvent[];
  readReceipts: readonly NotificationReadReceipt[];
  onlyUnread?: boolean;
}): InAppNotificationsOverview {
  const tripsById = new Map<string, Trip>();
  for (const trip of params.trips) {
    if (trip.orgId === params.orgId) {
      tripsById.set(trip.id, trip);
    }
  }

  const readAtByEventId = new Map<string, string>();
  for (const receipt of params.readReceipts) {
    if (receipt.orgId === params.orgId && receipt.userId === params.recipientUserId) {
      readAtByEventId.set(receipt.auditEventId, receipt.readAt);
    }
  }

  const canReviewSubmissions =
    params.recipientRole === "admin" || params.recipientRole === "manager";

  const deduplicatedByEventId = new Map<string, InAppNotification>();

  for (const event of params.auditEvents) {
    if (event.orgId !== params.orgId) {
      continue;
    }
    if (!isNotificationAuditEventType(event.eventType)) {
      continue;
    }
    if (deduplicatedByEventId.has(event.id)) {
      continue;
    }

    const trip = tripsById.get(event.tripId);
    if (!trip) {
      continue;
    }

    const isSubmissionEvent =
      event.eventType === "trip_submitted" || event.eventType === "trip_resubmitted";
    const isDecisionEvent =
      event.eventType === "trip_approved" ||
      event.eventType === "trip_changes_requested" ||
      event.eventType === "trip_rejected";
    const isWorkflowLifecycleEvent =
      event.eventType === "trip_started" || event.eventType === "trip_completed";

    // Route submission events to managers/admins who are NOT the trip owner
    const shouldDeliverSubmissionToManager =
      isSubmissionEvent &&
      canReviewSubmissions &&
      trip.ownerUserId !== params.recipientUserId;

    // Route decision events to the trip owner
    const shouldDeliverDecisionToOwner =
      isDecisionEvent && trip.ownerUserId === params.recipientUserId;

    // Route workflow lifecycle events (started, completed) to managers/admins or the trip owner
    const shouldDeliverWorkflowEvent =
      isWorkflowLifecycleEvent &&
      (canReviewSubmissions || trip.ownerUserId === params.recipientUserId);

    if (
      !shouldDeliverSubmissionToManager &&
      !shouldDeliverDecisionToOwner &&
      !shouldDeliverWorkflowEvent
    ) {
      continue;
    }

    const truncatedTitle = truncateDisplayLabel(trip.title, 56);
    const dateRangeLabel = `${formatCalendarDateOnlyUtc(trip.startDate)} – ${formatCalendarDateOnlyUtc(trip.endDate)}`;
    const readAt = readAtByEventId.get(event.id) ?? null;

    let title = "";
    let message = "";
    let category: InAppNotificationCategory = "approval_decision";
    let actionHref = `/trips/${trip.id}`;

    if (event.eventType === "trip_submitted") {
      category = "submission_awaiting_approval";
      title = `Trip Submitted for Approval: ${truncatedTitle.displayText}`;
      message = `Submitted for ${dateRangeLabel}. Open the approval inbox to review planned stops.`;
      actionHref = `/approvals`;
    } else if (event.eventType === "trip_resubmitted") {
      category = "submission_awaiting_approval";
      title = `Trip Resubmitted After Changes: ${truncatedTitle.displayText}`;
      message = `Updated and resubmitted for ${dateRangeLabel}.${event.note ? ` Note: "${truncateDisplayLabel(event.note, 100).displayText}"` : ""}`;
      actionHref = `/approvals`;
    } else if (event.eventType === "trip_approved") {
      category = "approval_decision";
      title = `Trip Approved: ${truncatedTitle.displayText}`;
      message = `Your trip (${dateRangeLabel}) was approved.${event.note ? ` Reviewer note: "${truncateDisplayLabel(event.note, 100).displayText}"` : ""}`;
      actionHref = `/trips/${trip.id}`;
    } else if (event.eventType === "trip_changes_requested") {
      category = "approval_decision";
      title = `Changes Requested on Trip: ${truncatedTitle.displayText}`;
      message = `A manager requested changes for ${dateRangeLabel}.${event.note ? ` Explanation: "${truncateDisplayLabel(event.note, 120).displayText}"` : ""}`;
      actionHref = `/trips/${trip.id}`;
    } else if (event.eventType === "trip_started") {
      category = "workflow_event";
      title = `Trip Execution Started: ${truncatedTitle.displayText}`;
      message = `Field activity has begun for ${dateRangeLabel}. First stop has been checked in.`;
      actionHref = `/trips/${trip.id}`;
    } else if (event.eventType === "trip_completed") {
      category = "workflow_event";
      title = `Trip Completed: ${truncatedTitle.displayText}`;
      message = `All planned store visits for ${dateRangeLabel} have been completed and checked out.`;
      actionHref = `/trips/${trip.id}`;
    } else {
      category = "approval_decision";
      title = `Trip Rejected: ${truncatedTitle.displayText}`;
      message = `Your trip (${dateRangeLabel}) was rejected.${event.note ? ` Explanation: "${truncateDisplayLabel(event.note, 120).displayText}"` : ""}`;
      actionHref = `/trips/${trip.id}`;
    }

    deduplicatedByEventId.set(event.id, {
      id: `notif:${event.id}`,
      auditEventId: event.id,
      orgId: params.orgId,
      tripId: trip.id,
      tripTitle: trip.title,
      tripTitleTruncated: truncatedTitle.displayText,
      tripDateRangeUtcLabel: dateRangeLabel,
      tripStatus: trip.status,
      eventType: event.eventType,
      category,
      recipientUserId: params.recipientUserId,
      actorUserId: event.actorUserId,
      title,
      message,
      actionHref,
      createdAt: event.createdAt,
      createdAtUtcLabel: formatUtcTimestamp(event.createdAt),
      isRead: readAt !== null,
      readAt,
      deliveryChannel: "in_app_only",
      externalProvidersConfigured: {
        email: false,
        sms: false,
        push: false,
      },
      externalDeliveryDisclaimer: EXTERNAL_DELIVERY_DISCLAIMER,
    });
  }

  const sortedAll = Array.from(deduplicatedByEventId.values()).sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt > b.createdAt ? -1 : 1;
    }
    return a.auditEventId > b.auditEventId ? -1 : 1;
  });

  const unreadCount = sortedAll.filter((item) => !item.isRead).length;
  const filteredItems = params.onlyUnread
    ? sortedAll.filter((item) => !item.isRead)
    : sortedAll;

  return {
    items: filteredItems,
    unreadCount,
    totalCount: sortedAll.length,
    deliveryChannel: "in_app_only",
    externalProvidersConfigured: {
      email: false,
      sms: false,
      push: false,
    },
    externalDeliveryDisclaimer: EXTERNAL_DELIVERY_DISCLAIMER,
  };
}
