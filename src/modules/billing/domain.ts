export const BILLING_PROVIDERS = ["stripe", "manual"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const PLAN_TIERS = ["pilot", "pro", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const WEBHOOK_EVENT_STATUSES = [
  "processed",
  "ignored_outdated",
  "failed",
] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export interface PlanEntitlements {
  max_stores: number;
  max_members: number;
  max_monthly_visits: number;
  ai_daily_draft_quota: number;
  storage_limit_bytes: number;
}

export interface PlanCatalogEntry {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyBasePriceUsd: number | null;
  monthlySeatPriceUsd: number | null;
  includedSeats: number;
  entitlements: PlanEntitlements;
  features: string[];
}

export const PLAN_CATALOG: Record<PlanTier, PlanCatalogEntry> = {
  pilot: {
    tier: "pilot",
    name: "Pilot Trial",
    tagline: "14-day full-featured evaluation for regional field teams",
    monthlyBasePriceUsd: 0,
    monthlySeatPriceUsd: 0,
    includedSeats: 5,
    entitlements: {
      max_stores: 25,
      max_members: 5,
      max_monthly_visits: 250,
      ai_daily_draft_quota: 25,
      storage_limit_bytes: 1_073_741_824, // 1 GB
    },
    features: [
      "Up to 5 team members & 25 stores",
      "250 store visits per month",
      "Google Maps route optimization & native geofencing",
      "25 AI visit report drafts per day",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Production multi-territory field operations & analytics",
    monthlyBasePriceUsd: 149,
    monthlySeatPriceUsd: 19,
    includedSeats: 15,
    entitlements: {
      max_stores: 500,
      max_members: 50,
      max_monthly_visits: 5000,
      ai_daily_draft_quota: 250,
      storage_limit_bytes: 26_843_545_600, // 25 GB
    },
    features: [
      "Up to 50 team members & 500 stores",
      "5,000 store visits per month",
      "Territory analytics, CSV audit exports & manager briefings",
      "250 AI visit report drafts per day",
    ],
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "High-scale national retail & franchise operations",
    monthlyBasePriceUsd: 499,
    monthlySeatPriceUsd: 15,
    includedSeats: 50,
    entitlements: {
      max_stores: 10000,
      max_members: 1000,
      max_monthly_visits: 100000,
      ai_daily_draft_quota: 2000,
      storage_limit_bytes: 268_435_456_000, // 250 GB
    },
    features: [
      "Up to 1,000 team members & 10,000 stores",
      "100,000 store visits per month",
      "Priority SLA, custom retention & dedicated onboarding",
      "2,000 AI visit report drafts per day",
    ],
  },
};

export const PAYMENT_FAILURE_GRACE_PERIOD_DAYS = 7;
export const DEFAULT_PILOT_TRIAL_DAYS = 14;

export interface OrganizationSubscription {
  organizationId: string;
  billingProvider: BillingProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  planTier: PlanTier;
  status: SubscriptionStatus;
  seatCount: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  gracePeriodEndsAt: string | null;
  entitlements: PlanEntitlements;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationUsageMetrics {
  activeStores: number;
  activeAndInvitedMembers: number;
  monthlyVisits: number;
}

export interface SubscriptionAccessEvaluation {
  writeAllowed: boolean;
  readAllowed: true;
  inTrial: boolean;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  inGracePeriod: boolean;
  graceDaysRemaining: number | null;
  reasonCode:
    | "ACTIVE"
    | "TRIALING"
    | "TRIAL_EXPIRED"
    | "PAST_DUE_GRACE_PERIOD"
    | "PAST_DUE_LOCKED"
    | "SUBSCRIPTION_INACTIVE";
  message: string;
}

export interface OrganizationBillingSummary {
  subscription: OrganizationSubscription;
  usage: OrganizationUsageMetrics;
  access: SubscriptionAccessEvaluation;
  catalog: PlanCatalogEntry[];
  stripeConfigured: boolean;
  portalAvailable: boolean;
}

export function getDefaultEntitlementsForTier(
  tier: PlanTier,
  seatCount?: number
): PlanEntitlements {
  const base = PLAN_CATALOG[tier].entitlements;
  return {
    ...base,
    max_members:
      seatCount && seatCount > 0
        ? Math.max(seatCount, base.max_members)
        : base.max_members,
  };
}

export function evaluateSubscriptionAccess(
  subscription: Pick<
    OrganizationSubscription,
    "status" | "trialEnd" | "gracePeriodEndsAt" | "planTier"
  >,
  now: Date = new Date()
): SubscriptionAccessEvaluation {
  const nowMs = now.getTime();

  if (subscription.status === "active") {
    return {
      writeAllowed: true,
      readAllowed: true,
      inTrial: false,
      trialDaysRemaining: null,
      trialExpired: false,
      inGracePeriod: false,
      graceDaysRemaining: null,
      reasonCode: "ACTIVE",
      message: "Subscription is active and in good standing.",
    };
  }

  if (subscription.status === "trialing") {
    if (subscription.trialEnd) {
      const trialEndMs = Date.parse(subscription.trialEnd);
      if (!Number.isNaN(trialEndMs)) {
        const diffMs = trialEndMs - nowMs;
        if (diffMs <= 0) {
          return {
            writeAllowed: false,
            readAllowed: true,
            inTrial: false,
            trialDaysRemaining: 0,
            trialExpired: true,
            inGracePeriod: false,
            graceDaysRemaining: null,
            reasonCode: "TRIAL_EXPIRED",
            message:
              "Your 14-day Pilot trial has expired. Workspace data remains readable, but new mutations require an active subscription.",
          };
        }
        const daysRemaining = Math.max(1, Math.ceil(diffMs / 86_400_000));
        return {
          writeAllowed: true,
          readAllowed: true,
          inTrial: true,
          trialDaysRemaining: daysRemaining,
          trialExpired: false,
          inGracePeriod: false,
          graceDaysRemaining: null,
          reasonCode: "TRIALING",
          message: `Pilot trial active (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).`,
        };
      }
    }

    return {
      writeAllowed: true,
      readAllowed: true,
      inTrial: true,
      trialDaysRemaining: DEFAULT_PILOT_TRIAL_DAYS,
      trialExpired: false,
      inGracePeriod: false,
      graceDaysRemaining: null,
      reasonCode: "TRIALING",
      message: "Pilot trial active.",
    };
  }

  if (subscription.status === "past_due") {
    if (subscription.gracePeriodEndsAt) {
      const graceEndMs = Date.parse(subscription.gracePeriodEndsAt);
      if (!Number.isNaN(graceEndMs) && graceEndMs > nowMs) {
        const graceDaysRemaining = Math.max(
          1,
          Math.ceil((graceEndMs - nowMs) / 86_400_000)
        );
        return {
          writeAllowed: true,
          readAllowed: true,
          inTrial: false,
          trialDaysRemaining: null,
          trialExpired: false,
          inGracePeriod: true,
          graceDaysRemaining,
          reasonCode: "PAST_DUE_GRACE_PERIOD",
          message: `Payment is past due. Workspace remains active during the ${graceDaysRemaining}-day grace period while Stripe retries payment.`,
        };
      }
    }

    return {
      writeAllowed: false,
      readAllowed: true,
      inTrial: false,
      trialDaysRemaining: null,
      trialExpired: false,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      reasonCode: "PAST_DUE_LOCKED",
      message:
        "Payment grace period has expired. Workspace is in read-only mode until payment method is updated in the Billing Portal.",
    };
  }

  return {
    writeAllowed: false,
    readAllowed: true,
    inTrial: false,
    trialDaysRemaining: null,
    trialExpired: false,
    inGracePeriod: false,
    graceDaysRemaining: null,
    reasonCode: "SUBSCRIPTION_INACTIVE",
    message: `Subscription status is '${subscription.status}'. Workspace is in read-only mode until an active plan is restored.`,
  };
}
