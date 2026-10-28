import "server-only";
import type { StripeRuntimeConfig } from "@/lib/env/server";
import { AppError } from "@/lib/http/envelope";
import type { AuditRepository } from "@/modules/audit/repository";
import { recordAuditEventForOrg } from "@/modules/audit/service";
import { requireAnyOrgRole } from "@/modules/tenancy/authorization";
import type { TenantContext } from "@/modules/tenancy/domain";
import {
  evaluateSubscriptionAccess,
  getDefaultEntitlementsForTier,
  type OrganizationBillingSummary,
  type OrganizationSubscription,
  PAYMENT_FAILURE_GRACE_PERIOD_DAYS,
  PLAN_CATALOG,
  type PlanTier,
  type SubscriptionStatus,
} from "./domain";
import { type BillingRepository, buildDefaultPilotSubscription } from "./repository";
import { type BillingActionRequestInput, stripeWebhookEventSchema } from "./schemas";
import { StripeBillingClient, verifyStripeWebhookSignature } from "./stripe-client";

async function safeRecordBillingAudit(
  auditRepository: AuditRepository | undefined,
  input: Parameters<typeof recordAuditEventForOrg>[0]["input"]
): Promise<void> {
  if (!auditRepository) return;
  try {
    await recordAuditEventForOrg({
      input,
      auditRepository,
    });
  } catch {
    // Non-blocking audit logging
  }
}

export async function getOrganizationBillingSummaryForCaller(params: {
  context: TenantContext;
  repository: BillingRepository;
  stripeConfig: StripeRuntimeConfig;
  now?: Date;
}): Promise<OrganizationBillingSummary> {
  const { context, repository, stripeConfig, now = new Date() } = params;
  const orgId = context.orgId;

  const [existingSub, usage] = await Promise.all([
    repository.getSubscriptionByOrgId(orgId),
    repository.getUsageMetrics(orgId, now),
  ]);

  const subscription = existingSub ?? buildDefaultPilotSubscription(orgId, now);
  const access = evaluateSubscriptionAccess(subscription, now);

  return {
    subscription,
    usage,
    access,
    catalog: [PLAN_CATALOG.pilot, PLAN_CATALOG.pro, PLAN_CATALOG.enterprise],
    stripeConfigured: stripeConfig.configured,
    portalAvailable: Boolean(stripeConfig.secretKey && subscription.providerCustomerId),
  };
}

export async function handleOrganizationBillingAction(params: {
  context: TenantContext;
  organizationName: string;
  appBaseUrl: string;
  input: BillingActionRequestInput;
  repository: BillingRepository;
  auditRepository?: AuditRepository;
  stripeConfig: StripeRuntimeConfig;
  stripeClient?: StripeBillingClient;
  now?: Date;
}): Promise<
  | {
      action: "checkout";
      sessionId: string;
      checkoutUrl: string;
      planTier: PlanTier;
      seatCount: number;
    }
  | {
      action: "portal";
      sessionId: string;
      portalUrl: string;
    }
  | {
      action: "update_seats";
      subscription: OrganizationSubscription;
    }
> {
  const {
    context,
    organizationName,
    appBaseUrl,
    input,
    repository,
    auditRepository,
    stripeConfig,
    stripeClient = new StripeBillingClient(),
    now = new Date(),
  } = params;

  // All billing actions are restricted to active organization admins
  requireAnyOrgRole(context, ["admin"]);
  const orgId = context.orgId;

  const [existingSub, usage] = await Promise.all([
    repository.getSubscriptionByOrgId(orgId),
    repository.getUsageMetrics(orgId, now),
  ]);
  const currentSub = existingSub ?? buildDefaultPilotSubscription(orgId, now);

  if (input.action === "update_seats") {
    if (input.seatCount < usage.activeAndInvitedMembers) {
      throw new AppError(
        "BILLING_SEAT_LIMIT_EXCEEDED",
        `Cannot reduce seat count to ${input.seatCount} while ${usage.activeAndInvitedMembers} active or invited members exist in the workspace.`,
        422
      );
    }

    const nextTier = input.planTier ?? currentSub.planTier;
    const maxPlanMembers = PLAN_CATALOG[nextTier].entitlements.max_members;
    if (input.seatCount > maxPlanMembers) {
      throw new AppError(
        "BILLING_SEAT_LIMIT_EXCEEDED",
        `Plan '${PLAN_CATALOG[nextTier].name}' supports up to ${maxPlanMembers} seats. Upgrade to a higher tier to provision ${input.seatCount} seats.`,
        422
      );
    }

    const updated = await repository.upsertSubscription({
      organizationId: orgId,
      planTier: nextTier,
      seatCount: input.seatCount,
      entitlements: getDefaultEntitlementsForTier(nextTier, input.seatCount),
    });

    await safeRecordBillingAudit(auditRepository, {
      orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "billing.subscription_updated",
      entityType: "subscription",
      entityId: orgId,
      metadata: {
        planTier: updated.planTier,
        seatCount: updated.seatCount,
      },
    });

    return {
      action: "update_seats",
      subscription: updated,
    };
  }

  if (input.action === "checkout") {
    if (input.seatCount < usage.activeAndInvitedMembers) {
      throw new AppError(
        "BILLING_SEAT_LIMIT_EXCEEDED",
        `Requested seat count (${input.seatCount}) cannot be less than current active + invited members (${usage.activeAndInvitedMembers}).`,
        422
      );
    }

    const priceId =
      input.planTier === "enterprise"
        ? stripeConfig.priceIdEnterpriseMonthly
        : stripeConfig.priceIdProMonthly;

    if (!stripeConfig.secretKey || !priceId) {
      throw new AppError(
        "BILLING_NOT_CONFIGURED",
        `Stripe Checkout is not configured in this environment. Set STRIPE_SECRET_KEY and ${
          input.planTier === "enterprise"
            ? "STRIPE_PRICE_ID_ENTERPRISE_MONTHLY"
            : "STRIPE_PRICE_ID_PRO_MONTHLY"
        } on the server.`,
        503
      );
    }

    const cleanBase = appBaseUrl.replace(/\/+$/, "");
    const successUrl = `${cleanBase}${
      input.successPath ?? "/settings?tab=billing&billing=success"
    }`;
    const cancelUrl = `${cleanBase}${
      input.cancelPath ?? "/settings?tab=billing&billing=cancelled"
    }`;

    const session = await stripeClient.createCheckoutSession({
      secretKey: stripeConfig.secretKey,
      apiBaseUrl: stripeConfig.apiBaseUrl,
      priceId,
      organizationId: orgId,
      organizationName,
      customerEmail: context.user.email,
      existingCustomerId: currentSub.providerCustomerId,
      planTier: input.planTier,
      seatCount: input.seatCount,
      successUrl,
      cancelUrl,
    });

    await safeRecordBillingAudit(auditRepository, {
      orgId,
      actorUserId: context.user.id,
      actorRole: context.role,
      actionType: "billing.checkout_created",
      entityType: "subscription",
      entityId: orgId,
      metadata: {
        sessionId: session.id,
        planTier: input.planTier,
        seatCount: input.seatCount,
      },
    });

    return {
      action: "checkout",
      sessionId: session.id,
      checkoutUrl: session.url,
      planTier: input.planTier,
      seatCount: input.seatCount,
    };
  }

  // input.action === "portal"
  if (!stripeConfig.secretKey) {
    throw new AppError(
      "BILLING_NOT_CONFIGURED",
      "Stripe Billing Portal is not configured in this environment. Set STRIPE_SECRET_KEY on the server.",
      503
    );
  }

  if (!currentSub.providerCustomerId) {
    throw new AppError(
      "BILLING_CUSTOMER_NOT_FOUND",
      "This workspace does not have an active Stripe customer record yet. Complete a plan upgrade via Stripe Checkout first.",
      409
    );
  }

  const cleanBase = appBaseUrl.replace(/\/+$/, "");
  const returnUrl = `${cleanBase}${input.returnPath ?? "/settings?tab=billing"}`;

  const portal = await stripeClient.createBillingPortalSession({
    secretKey: stripeConfig.secretKey,
    apiBaseUrl: stripeConfig.apiBaseUrl,
    customerId: currentSub.providerCustomerId,
    returnUrl,
  });

  await safeRecordBillingAudit(auditRepository, {
    orgId,
    actorUserId: context.user.id,
    actorRole: context.role,
    actionType: "billing.portal_created",
    entityType: "subscription",
    entityId: orgId,
    metadata: {
      sessionId: portal.id,
    },
  });

  return {
    action: "portal",
    sessionId: portal.id,
    portalUrl: portal.url,
  };
}

function normalizePlanTier(raw: unknown): PlanTier {
  if (raw === "enterprise" || raw === "pro" || raw === "pilot") {
    return raw;
  }
  return "pro";
}

function normalizeSubscriptionStatus(raw: unknown): SubscriptionStatus {
  if (
    raw === "trialing" ||
    raw === "active" ||
    raw === "past_due" ||
    raw === "canceled" ||
    raw === "unpaid" ||
    raw === "incomplete"
  ) {
    return raw;
  }
  return "active";
}

/**
 * Processes an incoming Stripe webhook payload with:
 * 1. Cryptographic `Stripe-Signature` HMAC-SHA256 verification.
 * 2. Idempotency check against `billing_webhook_events` (`provider = 'stripe'`, `event_id`).
 * 3. Out-of-order timestamp protection (`provider_created_at < subscription.updated_at`).
 * 4. 7-day payment failure grace period handling on `invoice.payment_failed`.
 */
export async function processStripeWebhookPayload(params: {
  rawBody: string;
  signatureHeader: string;
  stripeConfig: StripeRuntimeConfig;
  repository: BillingRepository;
  auditRepository?: AuditRepository;
  now?: Date;
}): Promise<{
  eventId: string;
  eventType: string;
  status: "processed" | "duplicate" | "ignored_outdated";
  organizationId: string | null;
}> {
  const {
    rawBody,
    signatureHeader,
    stripeConfig,
    repository,
    auditRepository,
    now = new Date(),
  } = params;

  verifyStripeWebhookSignature({
    rawBody,
    signatureHeader,
    webhookSecret: stripeConfig.webhookSecret ?? "",
    nowSeconds: Math.floor(now.getTime() / 1000),
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Webhook body must be valid JSON", 400);
  }

  const event = stripeWebhookEventSchema.parse(parsedJson);
  const alreadyProcessed = await repository.hasProcessedWebhookEvent("stripe", event.id);
  if (alreadyProcessed) {
    return {
      eventId: event.id,
      eventType: event.type,
      status: "duplicate",
      organizationId: null,
    };
  }

  const providerCreatedAtIso = new Date(event.created * 1000).toISOString();
  const obj = event.data.object;
  const metadata =
    obj.metadata && typeof obj.metadata === "object"
      ? (obj.metadata as Record<string, unknown>)
      : {};

  let organizationId: string | null =
    (typeof metadata.organization_id === "string" && metadata.organization_id) ||
    (typeof obj.client_reference_id === "string" && obj.client_reference_id) ||
    null;

  const customerId = typeof obj.customer === "string" ? obj.customer : null;
  const subscriptionId =
    typeof obj.subscription === "string"
      ? obj.subscription
      : event.type.startsWith("customer.subscription.") && typeof obj.id === "string"
        ? obj.id
        : null;

  let existingSub: OrganizationSubscription | null = null;
  if (organizationId) {
    existingSub = await repository.getSubscriptionByOrgId(organizationId);
  }
  if (!existingSub && subscriptionId) {
    existingSub =
      await repository.findSubscriptionByProviderSubscriptionId(subscriptionId);
    if (existingSub) {
      organizationId = existingSub.organizationId;
    }
  }
  if (!existingSub && customerId) {
    existingSub = await repository.findSubscriptionByCustomerId(customerId);
    if (existingSub) {
      organizationId = existingSub.organizationId;
    }
  }

  // Out-of-order protection: if we already have a subscription updated MORE recently than the
  // event's provider timestamp, record the event as ignored_outdated without overwriting state.
  if (existingSub) {
    const existingUpdatedSeconds = Math.floor(Date.parse(existingSub.updatedAt) / 1000);
    if (!Number.isNaN(existingUpdatedSeconds) && event.created < existingUpdatedSeconds) {
      await repository.recordWebhookEvent({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        organizationId,
        payload: parsedJson as Record<string, unknown>,
        status: "ignored_outdated",
        providerCreatedAt: providerCreatedAtIso,
      });

      return {
        eventId: event.id,
        eventType: event.type,
        status: "ignored_outdated",
        organizationId,
      };
    }
  }

  if (organizationId) {
    const planTier = normalizePlanTier(
      metadata.plan_tier ?? existingSub?.planTier ?? "pro"
    );
    const rawSeats = Number(metadata.seat_count ?? existingSub?.seatCount ?? 15);
    const seatCount = Number.isInteger(rawSeats) && rawSeats >= 1 ? rawSeats : 15;

    if (event.type === "checkout.session.completed") {
      await repository.upsertSubscription({
        organizationId,
        billingProvider: "stripe",
        providerCustomerId: customerId ?? existingSub?.providerCustomerId ?? null,
        providerSubscriptionId:
          subscriptionId ?? existingSub?.providerSubscriptionId ?? null,
        planTier,
        status: "active",
        seatCount,
        gracePeriodEndsAt: null,
        entitlements: getDefaultEntitlementsForTier(planTier, seatCount),
        updatedAt: providerCreatedAtIso,
      });

      await safeRecordBillingAudit(auditRepository, {
        orgId: organizationId,
        actorUserId: null,
        actorRole: null,
        actionType: "billing.subscription_updated",
        entityType: "subscription",
        entityId: organizationId,
        metadata: {
          webhookEventId: event.id,
          webhookEventType: event.type,
          planTier,
          seatCount,
          status: "active",
        },
      });
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const nextStatus = normalizeSubscriptionStatus(obj.status);
      const periodStart =
        typeof obj.current_period_start === "number"
          ? new Date(obj.current_period_start * 1000).toISOString()
          : (existingSub?.currentPeriodStart ?? null);
      const periodEnd =
        typeof obj.current_period_end === "number"
          ? new Date(obj.current_period_end * 1000).toISOString()
          : (existingSub?.currentPeriodEnd ?? null);
      const cancelAtPeriodEnd =
        typeof obj.cancel_at_period_end === "boolean"
          ? obj.cancel_at_period_end
          : (existingSub?.cancelAtPeriodEnd ?? false);

      await repository.upsertSubscription({
        organizationId,
        billingProvider: "stripe",
        providerCustomerId: customerId ?? existingSub?.providerCustomerId ?? null,
        providerSubscriptionId:
          subscriptionId ?? existingSub?.providerSubscriptionId ?? null,
        planTier,
        status: nextStatus,
        seatCount,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        gracePeriodEndsAt:
          nextStatus === "active" ? null : (existingSub?.gracePeriodEndsAt ?? null),
        entitlements: getDefaultEntitlementsForTier(planTier, seatCount),
        updatedAt: providerCreatedAtIso,
      });

      await safeRecordBillingAudit(auditRepository, {
        orgId: organizationId,
        actorUserId: null,
        actorRole: null,
        actionType: "billing.subscription_updated",
        entityType: "subscription",
        entityId: organizationId,
        metadata: {
          webhookEventId: event.id,
          webhookEventType: event.type,
          planTier,
          seatCount,
          status: nextStatus,
        },
      });
    } else if (event.type === "customer.subscription.deleted") {
      await repository.upsertSubscription({
        organizationId,
        status: "canceled",
        cancelAtPeriodEnd: false,
        gracePeriodEndsAt: null,
        updatedAt: providerCreatedAtIso,
      });

      await safeRecordBillingAudit(auditRepository, {
        orgId: organizationId,
        actorUserId: null,
        actorRole: null,
        actionType: "billing.subscription_updated",
        entityType: "subscription",
        entityId: organizationId,
        metadata: {
          webhookEventId: event.id,
          webhookEventType: event.type,
          status: "canceled",
        },
      });
    } else if (event.type === "invoice.payment_failed") {
      const graceEndsIso = new Date(
        now.getTime() + PAYMENT_FAILURE_GRACE_PERIOD_DAYS * 86_400_000
      ).toISOString();

      await repository.upsertSubscription({
        organizationId,
        status: "past_due",
        gracePeriodEndsAt: graceEndsIso,
        updatedAt: providerCreatedAtIso,
      });

      await safeRecordBillingAudit(auditRepository, {
        orgId: organizationId,
        actorUserId: null,
        actorRole: null,
        actionType: "billing.payment_failed",
        entityType: "subscription",
        entityId: organizationId,
        metadata: {
          webhookEventId: event.id,
          gracePeriodEndsAt: graceEndsIso,
        },
      });
    } else if (event.type === "invoice.paid") {
      await repository.upsertSubscription({
        organizationId,
        status: "active",
        gracePeriodEndsAt: null,
        updatedAt: providerCreatedAtIso,
      });

      await safeRecordBillingAudit(auditRepository, {
        orgId: organizationId,
        actorUserId: null,
        actorRole: null,
        actionType: "billing.payment_recovered",
        entityType: "subscription",
        entityId: organizationId,
        metadata: {
          webhookEventId: event.id,
          status: "active",
        },
      });
    }
  }

  await repository.recordWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    organizationId,
    payload: parsedJson as Record<string, unknown>,
    status: "processed",
    providerCreatedAt: providerCreatedAtIso,
  });

  return {
    eventId: event.id,
    eventType: event.type,
    status: "processed",
    organizationId,
  };
}
