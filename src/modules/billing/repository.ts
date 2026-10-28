import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import {
  DEFAULT_PILOT_TRIAL_DAYS,
  getDefaultEntitlementsForTier,
  type OrganizationSubscription,
  type OrganizationUsageMetrics,
  type PlanEntitlements,
  type PlanTier,
  type SubscriptionStatus,
  type WebhookEventStatus,
} from "./domain";

interface DbOrganizationSubscriptionRow {
  organization_id: string;
  billing_provider: "stripe" | "manual";
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_tier: PlanTier;
  status: SubscriptionStatus;
  seat_count: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_start: string | null;
  trial_end: string | null;
  grace_period_ends_at: string | null;
  entitlements: PlanEntitlements;
  created_at: string;
  updated_at: string;
}

export interface UpsertSubscriptionInput {
  organizationId: string;
  billingProvider?: "stripe" | "manual";
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  planTier?: PlanTier;
  status?: SubscriptionStatus;
  seatCount?: number;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialStart?: string | null;
  trialEnd?: string | null;
  gracePeriodEndsAt?: string | null;
  entitlements?: PlanEntitlements;
  updatedAt?: string;
}

export interface RecordWebhookEventInput {
  provider: "stripe" | "manual";
  eventId: string;
  eventType: string;
  organizationId: string | null;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  errorMessage?: string | null;
  providerCreatedAt: string;
}

export interface BillingRepository {
  getSubscriptionByOrgId(orgId: string): Promise<OrganizationSubscription | null>;
  findSubscriptionByCustomerId(
    customerId: string
  ): Promise<OrganizationSubscription | null>;
  findSubscriptionByProviderSubscriptionId(
    providerSubscriptionId: string
  ): Promise<OrganizationSubscription | null>;
  upsertSubscription(input: UpsertSubscriptionInput): Promise<OrganizationSubscription>;
  getUsageMetrics(orgId: string, now?: Date): Promise<OrganizationUsageMetrics>;
  hasProcessedWebhookEvent(
    provider: "stripe" | "manual",
    eventId: string
  ): Promise<boolean>;
  recordWebhookEvent(input: RecordWebhookEventInput): Promise<void>;
}

function mapSubscriptionRow(
  row: DbOrganizationSubscriptionRow
): OrganizationSubscription {
  return {
    organizationId: row.organization_id,
    billingProvider: row.billing_provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    planTier: row.plan_tier,
    status: row.status,
    seatCount: row.seat_count ?? 5,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    trialStart: row.trial_start,
    trialEnd: row.trial_end,
    gracePeriodEndsAt: row.grace_period_ends_at,
    entitlements:
      row.entitlements ?? getDefaultEntitlementsForTier(row.plan_tier, row.seat_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildDefaultPilotSubscription(
  orgId: string,
  now: Date = new Date()
): OrganizationSubscription {
  const trialStart = now.toISOString();
  const trialEnd = new Date(
    now.getTime() + DEFAULT_PILOT_TRIAL_DAYS * 86_400_000
  ).toISOString();
  return {
    organizationId: orgId,
    billingProvider: "stripe",
    providerCustomerId: null,
    providerSubscriptionId: null,
    planTier: "pilot",
    status: "trialing",
    seatCount: 5,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialStart,
    trialEnd,
    gracePeriodEndsAt: null,
    entitlements: getDefaultEntitlementsForTier("pilot", 5),
    createdAt: trialStart,
    updatedAt: trialStart,
  };
}

export class SupabaseBillingRepository implements BillingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSubscriptionByOrgId(orgId: string): Promise<OrganizationSubscription | null> {
    const { data, error } = await this.supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle<DbOrganizationSubscriptionRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load organization subscription",
        500
      );
    }

    return data ? mapSubscriptionRow(data) : null;
  }

  async findSubscriptionByCustomerId(
    customerId: string
  ): Promise<OrganizationSubscription | null> {
    const { data, error } = await this.supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("provider_customer_id", customerId)
      .maybeSingle<DbOrganizationSubscriptionRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to look up subscription by customer ID",
        500
      );
    }

    return data ? mapSubscriptionRow(data) : null;
  }

  async findSubscriptionByProviderSubscriptionId(
    providerSubscriptionId: string
  ): Promise<OrganizationSubscription | null> {
    const { data, error } = await this.supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("provider_subscription_id", providerSubscriptionId)
      .maybeSingle<DbOrganizationSubscriptionRow>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to look up subscription by provider subscription ID",
        500
      );
    }

    return data ? mapSubscriptionRow(data) : null;
  }

  async upsertSubscription(
    input: UpsertSubscriptionInput
  ): Promise<OrganizationSubscription> {
    const existing = await this.getSubscriptionByOrgId(input.organizationId);
    const planTier = input.planTier ?? existing?.planTier ?? "pilot";
    const seatCount = input.seatCount ?? existing?.seatCount ?? 5;
    const entitlements =
      input.entitlements ?? getDefaultEntitlementsForTier(planTier, seatCount);

    const payload = {
      organization_id: input.organizationId,
      billing_provider: input.billingProvider ?? existing?.billingProvider ?? "stripe",
      provider_customer_id:
        input.providerCustomerId !== undefined
          ? input.providerCustomerId
          : (existing?.providerCustomerId ?? null),
      provider_subscription_id:
        input.providerSubscriptionId !== undefined
          ? input.providerSubscriptionId
          : (existing?.providerSubscriptionId ?? null),
      plan_tier: planTier,
      status: input.status ?? existing?.status ?? "trialing",
      seat_count: seatCount,
      current_period_start:
        input.currentPeriodStart !== undefined
          ? input.currentPeriodStart
          : (existing?.currentPeriodStart ?? null),
      current_period_end:
        input.currentPeriodEnd !== undefined
          ? input.currentPeriodEnd
          : (existing?.currentPeriodEnd ?? null),
      cancel_at_period_end:
        input.cancelAtPeriodEnd !== undefined
          ? input.cancelAtPeriodEnd
          : (existing?.cancelAtPeriodEnd ?? false),
      trial_start:
        input.trialStart !== undefined
          ? input.trialStart
          : (existing?.trialStart ?? new Date().toISOString()),
      trial_end:
        input.trialEnd !== undefined
          ? input.trialEnd
          : (existing?.trialEnd ??
            new Date(Date.now() + DEFAULT_PILOT_TRIAL_DAYS * 86_400_000).toISOString()),
      grace_period_ends_at:
        input.gracePeriodEndsAt !== undefined
          ? input.gracePeriodEndsAt
          : (existing?.gracePeriodEndsAt ?? null),
      entitlements,
      ...(input.updatedAt ? { updated_at: input.updatedAt } : {}),
    };

    const { data, error } = await this.supabase
      .from("organization_subscriptions")
      .upsert(payload, { onConflict: "organization_id" })
      .select("*")
      .single<DbOrganizationSubscriptionRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to update organization subscription",
        500
      );
    }

    return mapSubscriptionRow(data);
  }

  async getUsageMetrics(
    orgId: string,
    now: Date = new Date()
  ): Promise<OrganizationUsageMetrics> {
    const startOfMonthIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    ).toISOString();

    const [storesRes, membersRes, visitsRes] = await Promise.all([
      this.supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("active", true),
      this.supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["active", "invited"]),
      this.supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("checked_in_at", startOfMonthIso),
    ]);

    return {
      activeStores: storesRes.count ?? 0,
      activeAndInvitedMembers: membersRes.count ?? 1,
      monthlyVisits: visitsRes.count ?? 0,
    };
  }

  async hasProcessedWebhookEvent(
    provider: "stripe" | "manual",
    eventId: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("billing_webhook_events")
      .select("id")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to check billing webhook idempotency",
        500
      );
    }

    return Boolean(data?.id);
  }

  async recordWebhookEvent(input: RecordWebhookEventInput): Promise<void> {
    const { error } = await this.supabase.from("billing_webhook_events").insert({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType,
      organization_id: input.organizationId,
      payload: input.payload,
      status: input.status,
      error_message: input.errorMessage ?? null,
      provider_created_at: input.providerCreatedAt,
    });

    if (error && error.code !== "23505") {
      throw new AppError("INTERNAL_ERROR", "Failed to record billing webhook event", 500);
    }
  }
}
