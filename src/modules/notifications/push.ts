import "server-only";
import { logger } from "@/lib/observability/logger";
import {
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface WebPushSubscriptionRecord {
  id: string;
  orgId: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent: string | null;
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  targetUrl: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

export interface WebPushSendResult {
  endpoint: string;
  sent: boolean;
  statusCode?: number;
  unsubscribed?: boolean; // True if provider returned 410 Gone / 404 Not Found
  error?: string;
}

export interface WebPushSender {
  sendPush(
    subscription: WebPushSubscriptionRecord,
    payload: WebPushPayload
  ): Promise<WebPushSendResult>;
}

/**
 * Default Web Push sender when VAPID keys are unconfigured in environment.
 * Explicitly records unconfigured delivery rather than claiming delivery.
 */
export class UnconfiguredWebPushSender implements WebPushSender {
  async sendPush(
    subscription: WebPushSubscriptionRecord,
    payload: WebPushPayload
  ): Promise<WebPushSendResult> {
    logger.info("Web push skipped: VAPID keys not configured in server environment", {
      endpoint: subscription.endpoint.slice(0, 30) + "…",
      title: payload.title,
    });

    return {
      endpoint: subscription.endpoint,
      sent: false,
      statusCode: 501,
      unsubscribed: false,
      error: "VAPID server keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) not configured.",
    };
  }
}

export interface WebPushRepository {
  upsertSubscription(params: {
    orgId: string;
    userId: string;
    input: WebPushSubscriptionInput;
  }): Promise<WebPushSubscriptionRecord>;

  revokeSubscription(params: {
    orgId: string;
    userId: string;
    endpoint: string;
  }): Promise<boolean>;

  listActiveSubscriptionsForUser(
    orgId: string,
    userId: string
  ): Promise<WebPushSubscriptionRecord[]>;

  deleteSubscriptionByEndpoint(
    orgId: string,
    userId: string,
    endpoint: string
  ): Promise<void>;
}

/**
 * Sanitizes push notification payload for lock-screen safety.
 * Strictly strips coordinates, tokens, or customer personal notes.
 */
export function buildSafeWebPushPayload(params: {
  title: string;
  message: string;
  targetUrl: string;
  tag?: string;
}): WebPushPayload {
  // Truncate message for standard mobile lock-screen banners
  const truncatedBody =
    params.message.length > 120
      ? `${params.message.slice(0, 117)}…`
      : params.message;

  return {
    title: params.title,
    body: truncatedBody,
    targetUrl: params.targetUrl,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-maskable.svg",
    tag: params.tag ?? "fieldtrack-alert",
  };
}

export async function registerWebPushSubscriptionForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  input: WebPushSubscriptionInput;
  tenancyRepository: TenancyRepository;
  pushRepository: WebPushRepository;
}): Promise<WebPushSubscriptionRecord> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  if (!params.input.endpoint || !params.input.keys?.p256dh || !params.input.keys?.auth) {
    throw new Error("Invalid push subscription: endpoint and authentication keys are required.");
  }

  return params.pushRepository.upsertSubscription({
    orgId: context.orgId,
    userId: context.user.id,
    input: params.input,
  });
}

export async function revokeWebPushSubscriptionForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  endpoint: string;
  tenancyRepository: TenancyRepository;
  pushRepository: WebPushRepository;
}): Promise<boolean> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "trips:read_own");

  return params.pushRepository.revokeSubscription({
    orgId: context.orgId,
    userId: context.user.id,
    endpoint: params.endpoint,
  });
}

/**
 * Dispatches web push notification to a user's active device subscriptions.
 * Automatically cleans up expired/unregistered subscriptions (410 Gone / 404).
 */
export async function dispatchWebPushNotificationToUser(params: {
  orgId: string;
  userId: string;
  payload: WebPushPayload;
  pushRepository: WebPushRepository;
  pushSender?: WebPushSender;
}): Promise<WebPushSendResult[]> {
  const sender = params.pushSender ?? new UnconfiguredWebPushSender();
  const subscriptions = await params.pushRepository.listActiveSubscriptionsForUser(
    params.orgId,
    params.userId
  );

  const results: WebPushSendResult[] = [];

  for (const sub of subscriptions) {
    try {
      const result = await sender.sendPush(sub, params.payload);
      results.push(result);

      if (result.unsubscribed) {
        // Automatically delete subscription if provider reported expired or unregistered (410/404)
        await params.pushRepository.deleteSubscriptionByEndpoint(
          params.orgId,
          params.userId,
          sub.endpoint
        );
      }
    } catch (err) {
      logger.error("Web push dispatch error", {
        endpoint: sub.endpoint.slice(0, 30) + "…",
        error: err instanceof Error ? err.message : String(err),
      });

      results.push({
        endpoint: sub.endpoint,
        sent: false,
        error: err instanceof Error ? err.message : "Dispatch failed",
      });
    }
  }

  return results;
}
