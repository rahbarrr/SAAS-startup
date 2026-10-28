import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StripeRuntimeConfig } from "@/lib/env/server";
import { throwIfBillingEntitlementError } from "@/lib/http/envelope";
import type { TenantContext } from "@/modules/tenancy/domain";
import {
  evaluateSubscriptionAccess,
  type OrganizationSubscription,
  type OrganizationUsageMetrics,
  PLAN_CATALOG,
} from "../domain";
import {
  type BillingRepository,
  buildDefaultPilotSubscription,
  type RecordWebhookEventInput,
  type UpsertSubscriptionInput,
} from "../repository";
import {
  assertOrganizationMutationEntitlement,
  getOrganizationBillingSummaryForCaller,
  handleOrganizationBillingAction,
  processStripeWebhookPayload,
} from "../service";
import {
  createStripeWebhookSignatureHeader,
  StripeBillingClient,
  verifyStripeWebhookSignature,
} from "../stripe-client";

class InMemoryBillingRepository implements BillingRepository {
  public subscriptions = new Map<string, OrganizationSubscription>();
  public webhookEvents = new Map<string, RecordWebhookEventInput>();
  public usage: OrganizationUsageMetrics = {
    activeStores: 8,
    activeAndInvitedMembers: 4,
    monthlyVisits: 42,
  };

  async getSubscriptionByOrgId(orgId: string): Promise<OrganizationSubscription | null> {
    return this.subscriptions.get(orgId) ?? null;
  }

  async findSubscriptionByCustomerId(
    customerId: string
  ): Promise<OrganizationSubscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.providerCustomerId === customerId) return sub;
    }
    return null;
  }

  async findSubscriptionByProviderSubscriptionId(
    providerSubscriptionId: string
  ): Promise<OrganizationSubscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.providerSubscriptionId === providerSubscriptionId) return sub;
    }
    return null;
  }

  async upsertSubscription(
    input: UpsertSubscriptionInput
  ): Promise<OrganizationSubscription> {
    const existing =
      this.subscriptions.get(input.organizationId) ??
      buildDefaultPilotSubscription(input.organizationId);
    const nextTier = input.planTier ?? existing.planTier;
    const nextSeats = input.seatCount ?? existing.seatCount;
    const updated: OrganizationSubscription = {
      ...existing,
      billingProvider: input.billingProvider ?? existing.billingProvider,
      providerCustomerId:
        input.providerCustomerId !== undefined
          ? input.providerCustomerId
          : existing.providerCustomerId,
      providerSubscriptionId:
        input.providerSubscriptionId !== undefined
          ? input.providerSubscriptionId
          : existing.providerSubscriptionId,
      planTier: nextTier,
      status: input.status ?? existing.status,
      seatCount: nextSeats,
      currentPeriodStart:
        input.currentPeriodStart !== undefined
          ? input.currentPeriodStart
          : existing.currentPeriodStart,
      currentPeriodEnd:
        input.currentPeriodEnd !== undefined
          ? input.currentPeriodEnd
          : existing.currentPeriodEnd,
      cancelAtPeriodEnd:
        input.cancelAtPeriodEnd !== undefined
          ? input.cancelAtPeriodEnd
          : existing.cancelAtPeriodEnd,
      trialStart: input.trialStart !== undefined ? input.trialStart : existing.trialStart,
      trialEnd: input.trialEnd !== undefined ? input.trialEnd : existing.trialEnd,
      gracePeriodEndsAt:
        input.gracePeriodEndsAt !== undefined
          ? input.gracePeriodEndsAt
          : existing.gracePeriodEndsAt,
      entitlements: input.entitlements ?? PLAN_CATALOG[nextTier].entitlements,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    };
    this.subscriptions.set(input.organizationId, updated);
    return updated;
  }

  async getUsageMetrics(): Promise<OrganizationUsageMetrics> {
    return this.usage;
  }

  async hasProcessedWebhookEvent(
    provider: "stripe" | "manual",
    eventId: string
  ): Promise<boolean> {
    return this.webhookEvents.has(`${provider}:${eventId}`);
  }

  async recordWebhookEvent(input: RecordWebhookEventInput): Promise<void> {
    this.webhookEvents.set(`${input.provider}:${input.eventId}`, input);
  }
}

const TEST_ORG_ID = "10000000-0000-4000-8000-000000000001";

function buildContext(role: "admin" | "manager" | "field_employee"): TenantContext {
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@fieldtrack.io",
    },
    orgId: TEST_ORG_ID,
    membershipId: "20000000-0000-4000-8000-000000000001",
    role,
    status: "active",
  };
}

const TEST_WEBHOOK_SECRET = "whsec_test_fixture_secret_key_for_hmac_verification";

const TEST_STRIPE_CONFIG: StripeRuntimeConfig = {
  configured: true,
  webhookConfigured: true,
  secretKey: "sk_test_fixture_only_not_real",
  webhookSecret: TEST_WEBHOOK_SECRET,
  priceIdProMonthly: "price_test_pro_monthly",
  priceIdEnterpriseMonthly: "price_test_enterprise_monthly",
  apiBaseUrl: "https://api.stripe.com/v1",
};

describe("Phase 12 — Stripe Billing, Entitlements, Webhooks, and RLS", () => {
  it("evaluates 14-day trial, trial expiration, 7-day past_due grace period, and read-only locks", () => {
    const now = new Date("2026-10-28T12:00:00.000Z");

    const activeTrial = evaluateSubscriptionAccess(
      {
        planTier: "pilot",
        status: "trialing",
        trialEnd: "2026-11-04T12:00:00.000Z",
        gracePeriodEndsAt: null,
      },
      now
    );
    expect(activeTrial.writeAllowed).toBe(true);
    expect(activeTrial.inTrial).toBe(true);
    expect(activeTrial.trialDaysRemaining).toBe(7);

    const expiredTrial = evaluateSubscriptionAccess(
      {
        planTier: "pilot",
        status: "trialing",
        trialEnd: "2026-10-27T12:00:00.000Z",
        gracePeriodEndsAt: null,
      },
      now
    );
    expect(expiredTrial.writeAllowed).toBe(false);
    expect(expiredTrial.readAllowed).toBe(true);
    expect(expiredTrial.trialExpired).toBe(true);
    expect(expiredTrial.reasonCode).toBe("TRIAL_EXPIRED");

    const inGracePeriod = evaluateSubscriptionAccess(
      {
        planTier: "pro",
        status: "past_due",
        trialEnd: null,
        gracePeriodEndsAt: "2026-11-02T12:00:00.000Z",
      },
      now
    );
    expect(inGracePeriod.writeAllowed).toBe(true);
    expect(inGracePeriod.inGracePeriod).toBe(true);
    expect(inGracePeriod.graceDaysRemaining).toBe(5);
    expect(inGracePeriod.reasonCode).toBe("PAST_DUE_GRACE_PERIOD");

    const expiredGracePeriod = evaluateSubscriptionAccess(
      {
        planTier: "pro",
        status: "past_due",
        trialEnd: null,
        gracePeriodEndsAt: "2026-10-25T12:00:00.000Z",
      },
      now
    );
    expect(expiredGracePeriod.writeAllowed).toBe(false);
    expect(expiredGracePeriod.readAllowed).toBe(true);
    expect(expiredGracePeriod.reasonCode).toBe("PAST_DUE_LOCKED");
  });

  it("enforces admin-only RBAC and seat-limit invariants on checkout, portal, and seat updates", async () => {
    const repo = new InMemoryBillingRepository();
    repo.usage = {
      activeStores: 10,
      activeAndInvitedMembers: 8,
      monthlyVisits: 100,
    };

    const summary = await getOrganizationBillingSummaryForCaller({
      context: buildContext("field_employee"),
      repository: repo,
      stripeConfig: TEST_STRIPE_CONFIG,
    });
    expect(summary.subscription.planTier).toBe("pilot");
    expect(summary.usage.activeAndInvitedMembers).toBe(8);

    // Non-admin cannot initiate checkout or update seats
    await expect(
      handleOrganizationBillingAction({
        context: buildContext("manager"),
        organizationName: "Apex Retail",
        appBaseUrl: "https://fieldtrack.app",
        input: { action: "checkout", planTier: "pro", seatCount: 15 },
        repository: repo,
        stripeConfig: TEST_STRIPE_CONFIG,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // Admin on Pilot cannot self-upgrade planTier to Pro or Enterprise via update_seats without Stripe Checkout
    await expect(
      handleOrganizationBillingAction({
        context: buildContext("admin"),
        organizationName: "Apex Retail",
        appBaseUrl: "https://fieldtrack.app",
        input: { action: "update_seats", seatCount: 15, planTier: "pro" },
        repository: repo,
        stripeConfig: TEST_STRIPE_CONFIG,
      })
    ).rejects.toMatchObject({
      code: "BILLING_UPGRADE_REQUIRED",
      status: 402,
    });

    // Provision active Pro subscription, then verify seat update boundaries
    await repo.upsertSubscription({
      organizationId: TEST_ORG_ID,
      planTier: "pro",
      status: "active",
      seatCount: 15,
    });

    // Admin cannot reduce seats below current active + invited member count (8)
    await expect(
      handleOrganizationBillingAction({
        context: buildContext("admin"),
        organizationName: "Apex Retail",
        appBaseUrl: "https://fieldtrack.app",
        input: { action: "update_seats", seatCount: 5, planTier: "pro" },
        repository: repo,
        stripeConfig: TEST_STRIPE_CONFIG,
      })
    ).rejects.toMatchObject({
      code: "BILLING_SEAT_LIMIT_EXCEEDED",
      status: 422,
    });

    // Admin can update seats when >= active + invited members and <= plan max on current tier
    const seatRes = await handleOrganizationBillingAction({
      context: buildContext("admin"),
      organizationName: "Apex Retail",
      appBaseUrl: "https://fieldtrack.app",
      input: { action: "update_seats", seatCount: 20, planTier: "pro" },
      repository: repo,
      stripeConfig: TEST_STRIPE_CONFIG,
    });
    expect(seatRes.action).toBe("update_seats");
    if (seatRes.action === "update_seats") {
      expect(seatRes.subscription.seatCount).toBe(20);
      expect(seatRes.subscription.planTier).toBe("pro");
    }

    // Checkout session creation with mocked Stripe client
    const mockStripeClient: StripeBillingClient = {
      createCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_test_12345",
        url: "https://checkout.stripe.com/c/pay/cs_test_12345",
      }),
      createBillingPortalSession: vi.fn().mockResolvedValue({
        id: "bps_test_999",
        url: "https://billing.stripe.com/p/session/bps_test_999",
      }),
    };

    const checkoutRes = await handleOrganizationBillingAction({
      context: buildContext("admin"),
      organizationName: "Apex Retail",
      appBaseUrl: "https://fieldtrack.app",
      input: { action: "checkout", planTier: "pro", seatCount: 20 },
      repository: repo,
      stripeConfig: TEST_STRIPE_CONFIG,
      stripeClient: mockStripeClient,
    });
    expect(checkoutRes).toEqual({
      action: "checkout",
      sessionId: "cs_test_12345",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_12345",
      planTier: "pro",
      seatCount: 20,
    });

    // Unconfigured Stripe environment returns explicit 503 BILLING_NOT_CONFIGURED
    await expect(
      handleOrganizationBillingAction({
        context: buildContext("admin"),
        organizationName: "Apex Retail",
        appBaseUrl: "https://fieldtrack.app",
        input: { action: "checkout", planTier: "pro", seatCount: 20 },
        repository: repo,
        stripeConfig: {
          ...TEST_STRIPE_CONFIG,
          configured: false,
          secretKey: null,
        },
      })
    ).rejects.toMatchObject({
      code: "BILLING_NOT_CONFIGURED",
      status: 503,
    });

    // Server-side mutation entitlement checks enforce store, seat, visit, and subscription locks
    repo.usage = {
      activeStores: 150,
      activeAndInvitedMembers: 20,
      monthlyVisits: 1000,
    };
    await expect(
      assertOrganizationMutationEntitlement({
        orgId: TEST_ORG_ID,
        mutationType: "store",
        repository: repo,
      })
    ).rejects.toMatchObject({
      code: "BILLING_PLAN_LIMIT_EXCEEDED",
      status: 402,
    });
    await expect(
      assertOrganizationMutationEntitlement({
        orgId: TEST_ORG_ID,
        mutationType: "member",
        repository: repo,
      })
    ).rejects.toMatchObject({
      code: "BILLING_SEAT_LIMIT_EXCEEDED",
      status: 402,
    });
    await expect(
      assertOrganizationMutationEntitlement({
        orgId: TEST_ORG_ID,
        mutationType: "visit",
        repository: repo,
      })
    ).rejects.toMatchObject({
      code: "BILLING_PLAN_LIMIT_EXCEEDED",
      status: 402,
    });
  });

  it("verifies Stripe-Signature HMAC-SHA256 headers and rejects tampered or replay payloads", () => {
    const rawBody = JSON.stringify({ id: "evt_test_1", type: "invoice.paid" });
    const nowSeconds = 1_760_000_000;
    const validSig = createStripeWebhookSignatureHeader({
      rawBody,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds - 10,
    });

    const verified = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: validSig,
      webhookSecret: TEST_WEBHOOK_SECRET,
      nowSeconds,
    });
    expect(verified.timestamp).toBe(nowSeconds - 10);

    // Reject tampered payload
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: validSig,
        webhookSecret: TEST_WEBHOOK_SECRET,
        nowSeconds,
      })
    ).toThrow(/cryptographic signature verification failed/i);

    // Reject replay outside 300s tolerance window
    const expiredSig = createStripeWebhookSignatureHeader({
      rawBody,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds - 600,
    });
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: expiredSig,
        webhookSecret: TEST_WEBHOOK_SECRET,
        nowSeconds,
      })
    ).toThrow(/outside the allowed replay tolerance window/i);
  });

  it("processes Stripe webhooks idempotently, enforces out-of-order protection, and manages 7-day grace periods", async () => {
    const repo = new InMemoryBillingRepository();
    const now = new Date("2026-10-28T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);

    // 1. checkout.session.completed upgrades org to active Pro plan with 25 seats
    const checkoutPayload = JSON.stringify({
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      created: nowSeconds,
      data: {
        object: {
          id: "cs_test_1",
          client_reference_id: TEST_ORG_ID,
          customer: "cus_test_apex",
          subscription: "sub_test_apex",
          metadata: {
            organization_id: TEST_ORG_ID,
            plan_tier: "pro",
            seat_count: "25",
          },
        },
      },
    });
    const sig1 = createStripeWebhookSignatureHeader({
      rawBody: checkoutPayload,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds,
    });

    const firstResult = await processStripeWebhookPayload({
      rawBody: checkoutPayload,
      signatureHeader: sig1,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(firstResult.status).toBe("processed");

    const subAfterCheckout = await repo.getSubscriptionByOrgId(TEST_ORG_ID);
    expect(subAfterCheckout?.status).toBe("active");
    expect(subAfterCheckout?.planTier).toBe("pro");
    expect(subAfterCheckout?.seatCount).toBe(25);
    expect(subAfterCheckout?.providerCustomerId).toBe("cus_test_apex");

    // 2. Duplicate delivery of evt_checkout_1 is ignored idempotently
    const duplicateResult = await processStripeWebhookPayload({
      rawBody: checkoutPayload,
      signatureHeader: sig1,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(duplicateResult.status).toBe("duplicate");

    // 3. Out-of-order older webhook event is recorded as ignored_outdated without overwriting state
    const outdatedPayload = JSON.stringify({
      id: "evt_outdated_0",
      type: "customer.subscription.deleted",
      created: nowSeconds - 120,
      data: {
        object: {
          id: "sub_test_apex",
          customer: "cus_test_apex",
          status: "canceled",
        },
      },
    });
    const sigOutdated = createStripeWebhookSignatureHeader({
      rawBody: outdatedPayload,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds,
    });

    const outdatedResult = await processStripeWebhookPayload({
      rawBody: outdatedPayload,
      signatureHeader: sigOutdated,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(outdatedResult.status).toBe("ignored_outdated");
    expect((await repo.getSubscriptionByOrgId(TEST_ORG_ID))?.status).toBe("active");

    // 4. invoice.payment_failed transitions subscription to past_due with 7-day grace period
    const failedInvoicePayload = JSON.stringify({
      id: "evt_invoice_failed_2",
      type: "invoice.payment_failed",
      created: nowSeconds + 30,
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_test_apex",
          subscription: "sub_test_apex",
        },
      },
    });
    const sigFailed = createStripeWebhookSignatureHeader({
      rawBody: failedInvoicePayload,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds,
    });

    const failedResult = await processStripeWebhookPayload({
      rawBody: failedInvoicePayload,
      signatureHeader: sigFailed,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(failedResult.status).toBe("processed");

    const subPastDue = await repo.getSubscriptionByOrgId(TEST_ORG_ID);
    expect(subPastDue?.status).toBe("past_due");
    expect(subPastDue?.gracePeriodEndsAt).toBe("2026-11-04T12:00:00.000Z");

    // 5. invoice.paid recovers subscription to active and clears gracePeriodEndsAt
    const paidInvoicePayload = JSON.stringify({
      id: "evt_invoice_paid_3",
      type: "invoice.paid",
      created: nowSeconds + 60,
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_test_apex",
          subscription: "sub_test_apex",
        },
      },
    });
    const sigPaid = createStripeWebhookSignatureHeader({
      rawBody: paidInvoicePayload,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds,
    });
    const paidResult = await processStripeWebhookPayload({
      rawBody: paidInvoicePayload,
      signatureHeader: sigPaid,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(paidResult.status).toBe("processed");
    const subRecovered = await repo.getSubscriptionByOrgId(TEST_ORG_ID);
    expect(subRecovered?.status).toBe("active");
    expect(subRecovered?.gracePeriodEndsAt).toBeNull();

    // 6. customer.subscription.deleted transitions subscription to canceled
    const deletedSubPayload = JSON.stringify({
      id: "evt_sub_deleted_4",
      type: "customer.subscription.deleted",
      created: nowSeconds + 90,
      data: {
        object: {
          id: "sub_test_apex",
          customer: "cus_test_apex",
        },
      },
    });
    const sigDeleted = createStripeWebhookSignatureHeader({
      rawBody: deletedSubPayload,
      webhookSecret: TEST_WEBHOOK_SECRET,
      timestampSeconds: nowSeconds,
    });
    const deletedResult = await processStripeWebhookPayload({
      rawBody: deletedSubPayload,
      signatureHeader: sigDeleted,
      stripeConfig: TEST_STRIPE_CONFIG,
      repository: repo,
      now,
    });
    expect(deletedResult.status).toBe("processed");
    const subCanceled = await repo.getSubscriptionByOrgId(TEST_ORG_ID);
    expect(subCanceled?.status).toBe("canceled");
  });

  it("serializes Stripe Checkout & Billing Portal API requests and maps database trigger errors deterministically", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "cs_test_live_serial",
          url: "https://checkout.stripe.com/c/pay/cs_test_live_serial",
        }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const client = new StripeBillingClient();
      const checkout = await client.createCheckoutSession({
        secretKey: "sk_test_mock_key",
        apiBaseUrl: "https://api.stripe.com/v1/",
        priceId: "price_pro_monthly",
        organizationId: TEST_ORG_ID,
        organizationName: "Apex Retail",
        customerEmail: "admin@apex.example.com",
        planTier: "pro",
        seatCount: 18,
        successUrl: "https://fieldtrack.app/settings?tab=billing&billing=success",
        cancelUrl: "https://fieldtrack.app/settings?tab=billing&billing=cancelled",
      });
      expect(checkout.id).toBe("cs_test_live_serial");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe("https://api.stripe.com/v1/checkout/sessions");
      const bodyParams = new URLSearchParams(String(calledInit.body));
      expect(bodyParams.get("mode")).toBe("subscription");
      expect(bodyParams.get("line_items[0][price]")).toBe("price_pro_monthly");
      expect(bodyParams.get("line_items[0][quantity]")).toBe("18");
      expect(bodyParams.get("metadata[organization_id]")).toBe(TEST_ORG_ID);
      expect(bodyParams.get("subscription_data[metadata][plan_tier]")).toBe("pro");

      // Upstream Stripe error maps to 502 BILLING_PROVIDER_ERROR
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "No such price: 'price_invalid'" },
        }),
      });
      await expect(
        client.createBillingPortalSession({
          secretKey: "sk_test_mock_key",
          apiBaseUrl: "https://api.stripe.com/v1",
          customerId: "cus_test_123",
          returnUrl: "https://fieldtrack.app/settings",
        })
      ).rejects.toMatchObject({
        code: "BILLING_PROVIDER_ERROR",
        status: 502,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Verify deterministic DB trigger error mapping
    expect(() =>
      throwIfBillingEntitlementError({
        message:
          "Organization subscription is inactive or expired (status: canceled). Workspace is in read-only mode until billing is updated.",
      })
    ).toThrowError(
      expect.objectContaining({
        code: "BILLING_SUBSCRIPTION_INACTIVE",
        status: 402,
      })
    );

    expect(() =>
      throwIfBillingEntitlementError({
        message: "Workspace seat limit reached (5/5 seats used).",
      })
    ).toThrowError(
      expect.objectContaining({
        code: "BILLING_SEAT_LIMIT_EXCEEDED",
        status: 402,
      })
    );

    expect(() =>
      throwIfBillingEntitlementError({
        message: "Plan store limit reached (15/15 active stores).",
      })
    ).toThrowError(
      expect.objectContaining({
        code: "BILLING_PLAN_LIMIT_EXCEEDED",
        status: 402,
      })
    );

    expect(() =>
      throwIfBillingEntitlementError({
        message: "Daily AI report draft quota reached (5/5 drafts today).",
      })
    ).toThrowError(
      expect.objectContaining({
        code: "AI_QUOTA_EXCEEDED",
        status: 429,
      })
    );
  });

  describe("PGlite Database Migration & RLS Verification for Phase 12 Billing", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = new PGlite();
      await db.exec(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'service_role') then
            create role service_role nologin bypassrls;
          end if;
        end
        $$;

        create schema if not exists auth;
        grant usage on schema auth to public, anon, authenticated;
        grant usage on schema public to public, anon, authenticated, service_role;

        create table if not exists auth.users (id uuid primary key, email text not null);
        create or replace function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;
        grant execute on function auth.uid() to public, anon, authenticated;
      `);

      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
      }
      await db.exec(
        fs.readFileSync(path.resolve(process.cwd(), "supabase/seed.sql"), "utf8")
      );
    });

    afterAll(async () => {
      await db.close();
    });

    it("auto-provisions a 14-day Pilot trial subscription for seeded organizations and enforces RLS", async () => {
      // Seeded organization aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa has a subscription row
      // User 10000000-0000-4000-8000-000000000002 (Marcus Manager) is an active member of Org A only
      await db.exec("begin;");
      try {
        await db.exec("set local role authenticated;");
        await db.exec(
          "select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);"
        );

        const ownSub = await db.query<{
          organization_id: string;
          plan_tier: string;
          status: string;
          seat_count: number;
        }>(
          "select organization_id, plan_tier, status, seat_count from public.organization_subscriptions where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
        );
        expect(ownSub.rows).toHaveLength(1);
        expect(ownSub.rows[0]?.plan_tier).toBe("pilot");
        expect(ownSub.rows[0]?.status).toBe("trialing");
        expect(ownSub.rows[0]?.seat_count).toBe(5);

        // Cannot read another organization's subscription (Org B: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)
        const otherOrgSub = await db.query(
          "select * from public.organization_subscriptions where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"
        );
        expect(otherOrgSub.rows).toHaveLength(0);

        // Authenticated client cannot directly UPDATE organization_subscriptions
        await db.exec("savepoint sp_update_sub;");
        await expect(
          db.query(
            "update public.organization_subscriptions set plan_tier = 'enterprise' where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
          )
        ).rejects.toThrow(/permission denied/i);
        await db.exec("rollback to savepoint sp_update_sub;");

        // Authenticated client cannot read or write billing_webhook_events
        await db.exec("savepoint sp_read_webhooks;");
        await expect(
          db.query("select * from public.billing_webhook_events")
        ).rejects.toThrow(/permission denied/i);
        await db.exec("rollback to savepoint sp_read_webhooks;");
      } finally {
        await db.exec("rollback;");
      }
    });

    it("enforces database-level subscription read-only lock, store limits, seat limits, and AI quota sync", async () => {
      await db.exec("begin;");
      try {
        // 1. Verify AI quota sync when subscription is upgraded to Pro (50 drafts/day) and capped by tier ceiling
        await db.query(`
          update public.organization_subscriptions
             set plan_tier = 'pro',
                 status = 'active',
                 seat_count = 15,
                 entitlements = '{"max_stores": 150, "max_members": 30, "max_monthly_visits": 1000, "ai_daily_draft_quota": 50, "storage_limit_bytes": 53687091200}'::jsonb
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);

        const orgAiQuota = await db.query<{ ai_daily_draft_quota: number }>(`
          select ai_daily_draft_quota
            from public.organizations
           where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);
        expect(orgAiQuota.rows[0]?.ai_daily_draft_quota).toBe(50);

        // Attempting to set ai_daily_draft_quota above tier ceiling (e.g. 9999 on pilot) is capped to 10
        await db.query(`
          update public.organization_subscriptions
             set plan_tier = 'pilot',
                 entitlements = jsonb_set(entitlements, '{ai_daily_draft_quota}', '9999'::jsonb)
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);
        const cappedAiQuota = await db.query<{ ai_daily_draft_quota: number }>(`
          select ai_daily_draft_quota
            from public.organizations
           where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);
        expect(cappedAiQuota.rows[0]?.ai_daily_draft_quota).toBe(10);

        // Restore pro tier for subsequent checks
        await db.query(`
          update public.organization_subscriptions
             set plan_tier = 'pro',
                 status = 'active',
                 seat_count = 15,
                 entitlements = '{"max_stores": 150, "max_members": 30, "max_monthly_visits": 1000, "ai_daily_draft_quota": 50, "storage_limit_bytes": 53687091200}'::jsonb
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);

        // 2. Verify store limit enforcement on both INSERT and UPDATE (store reactivation active: false -> true)
        await db.query(`
          insert into public.stores (
            id, organization_id, name, region, address_line1, city, country_code, active
          ) values (
            '99999999-9999-4999-8999-999999999991',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'Inactive Store Candidate',
            'North',
            '2 Main St',
            'Delhi',
            'IN',
            false
          );
        `);

        await db.query(`
          update public.organization_subscriptions
             set entitlements = jsonb_set(entitlements, '{max_stores}', '1'::jsonb)
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);

        await db.exec("savepoint sp_store_limit;");
        await expect(
          db.query(`
            insert into public.stores (
              organization_id, name, region, address_line1, city, country_code, active
            ) values (
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Over Limit Store', 'North', '1 Main St', 'Delhi', 'IN', true
            );
          `)
        ).rejects.toThrow(/Plan store limit reached/i);
        await db.exec("rollback to savepoint sp_store_limit;");

        await db.exec("savepoint sp_store_reactivate_limit;");
        await expect(
          db.query(`
            update public.stores
               set active = true
             where id = '99999999-9999-4999-8999-999999999991';
          `)
        ).rejects.toThrow(/Plan store limit reached/i);
        await db.exec("rollback to savepoint sp_store_reactivate_limit;");

        // 3. Verify seat limit enforcement on INSERT and UPDATE (member activation)
        await db.query(`
          insert into public.organization_invitations (
            id, organization_id, invited_email, role, token_hash, invited_by, status, expires_at
          ) values (
            '99999999-9999-4999-8999-999999999992',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'pending-to-revoke@acme.local',
            'field_employee',
            repeat('f', 64),
            '10000000-0000-4000-8000-000000000001',
            'pending',
            now() + interval '7 days'
          );
        `);

        await db.query(`
          update public.organization_subscriptions
             set seat_count = 3
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);

        await db.exec("savepoint sp_seat_limit;");
        await expect(
          db.query(`
            insert into public.organization_invitations (
              organization_id, invited_email, role, token_hash, invited_by, status, expires_at
            ) values (
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              'overlimit@acme.local',
              'field_employee',
              repeat('e', 64),
              '10000000-0000-4000-8000-000000000001',
              'pending',
              now() + interval '7 days'
            );
          `)
        ).rejects.toThrow(/Workspace seat limit reached/i);
        await db.exec("rollback to savepoint sp_seat_limit;");

        // Activating the 4th (invited) member when seat_count was lowered to 3 is also blocked on UPDATE
        await db.exec("savepoint sp_member_activate_limit;");
        await expect(
          db.query(`
            update public.organization_members
               set status = 'active'
             where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
               and status = 'invited';
          `)
        ).rejects.toThrow(/Workspace seat limit reached/i);
        await db.exec("rollback to savepoint sp_member_activate_limit;");

        // 4. Verify read-only lock on INSERT and UPDATE when subscription status is 'canceled',
        //    while preserving permitted downsizing/cancellation operations.
        await db.query(`
          update public.organization_subscriptions
             set status = 'canceled'
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        `);

        await db.exec("savepoint sp_readonly_lock;");
        await expect(
          db.query(`
            insert into public.trips (
              organization_id, owner_user_id, title, start_date, end_date, purpose, status
            ) values (
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              '10000000-0000-4000-8000-000000000003',
              'Blocked Trip During Canceled Sub',
              current_date,
              current_date + 1,
              'Should fail read-only check',
              'draft'
            );
          `)
        ).rejects.toThrow(/Organization subscription is inactive or expired/i);
        await db.exec("rollback to savepoint sp_readonly_lock;");

        // UPDATE on trips (e.g. submitting or editing) is also blocked in read-only mode
        await db.exec("savepoint sp_readonly_trip_update;");
        await expect(
          db.query(`
            update public.trips
               set title = 'Attempted Edit During Read-Only Lock'
             where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
          `)
        ).rejects.toThrow(/Organization subscription is inactive or expired/i);
        await db.exec("rollback to savepoint sp_readonly_trip_update;");

        // UPDATE on stores (e.g. renaming or reactivating) is blocked in read-only mode
        await db.exec("savepoint sp_readonly_store_update;");
        await expect(
          db.query(`
            update public.stores
               set name = 'Attempted Store Rename During Lock'
             where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
               and active = true;
          `)
        ).rejects.toThrow(/Organization subscription is inactive or expired/i);
        await db.exec("rollback to savepoint sp_readonly_store_update;");

        // Permitted downsizing operations SUCCEED even during read-only mode:
        // (a) Deactivating an active store
        const deactivatedStore = await db.query<{ id: string; active: boolean }>(`
          update public.stores
             set active = false
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
             and active = true
          returning id, active;
        `);
        expect(deactivatedStore.rows[0]?.active).toBe(false);

        // (b) Revoking a pending invitation
        const revokedInvite = await db.query<{ status: string }>(`
          update public.organization_invitations
             set status = 'revoked'
           where id = '99999999-9999-4999-8999-999999999992'
          returning status;
        `);
        expect(revokedInvite.rows[0]?.status).toBe("revoked");

        // (c) Deactivating a non-admin member
        const deactivatedMember = await db.query<{ status: string }>(`
          update public.organization_members
             set status = 'deactivated'
           where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
             and user_id = '10000000-0000-4000-8000-000000000004'
          returning status;
        `);
        expect(deactivatedMember.rows[0]?.status).toBe("deactivated");
      } finally {
        await db.exec("rollback;");
      }
    });

    it("safely backfills pre-existing legacy organizations when Migration 16 is applied after prior migrations and is idempotent on rerun", async () => {
      const upgradeDb = new PGlite();
      try {
        await upgradeDb.exec(`
          do $$
          begin
            if not exists (select 1 from pg_roles where rolname = 'authenticated') then
              create role authenticated nologin;
            end if;
            if not exists (select 1 from pg_roles where rolname = 'anon') then
              create role anon nologin;
            end if;
            if not exists (select 1 from pg_roles where rolname = 'service_role') then
              create role service_role nologin bypassrls;
            end if;
          end
          $$;
          create schema if not exists auth;
          grant usage on schema auth to public, anon, authenticated;
          grant usage on schema public to public, anon, authenticated, service_role;
          create table if not exists auth.users (id uuid primary key, email text not null);
          create or replace function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
          $$;
          grant execute on function auth.uid() to public, anon, authenticated;
        `);

        const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
        const allFiles = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith(".sql"))
          .sort();
        const priorMigrations = allFiles.filter((f) => !f.includes("000016_"));
        const migration16File = allFiles.find((f) => f.includes("000016_"));
        if (!migration16File) {
          throw new Error("Migration 16 not found");
        }

        for (const file of priorMigrations) {
          await upgradeDb.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
        }

        // Seed existing organizations BEFORE Migration 16 runs, plus a legacy org created 90 days ago with 7 members
        await upgradeDb.exec(
          fs.readFileSync(path.resolve(process.cwd(), "supabase/seed.sql"), "utf8")
        );
        await upgradeDb.exec(`
          insert into public.organizations (id, name, slug, status, created_at, updated_at, ai_daily_draft_quota)
          values (
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            'Legacy 90-Day Org',
            'legacy-90-day-org',
            'active',
            now() - interval '90 days',
            now() - interval '90 days',
            8
          );
        `);

        for (let i = 1; i <= 7; i++) {
          const uid = `77000000-0000-4000-8000-00000000000${i}`;
          await upgradeDb.exec(`
            insert into auth.users (id, email) values ('${uid}', 'legacy${i}@example.com') on conflict (id) do nothing;
            insert into public.profiles (id, email, full_name) values ('${uid}', 'legacy${i}@example.com', 'Legacy User ${i}') on conflict (id) do nothing;
            insert into public.organization_members (organization_id, user_id, role, status)
            values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${uid}', '${i === 1 ? "admin" : "field_employee"}', '${i <= 6 ? "active" : "invited"}');
          `);
        }

        const migration16Sql = fs.readFileSync(
          path.join(migrationsDir, migration16File),
          "utf8"
        );

        // Apply Migration 16 for the first time
        await upgradeDb.exec(migration16Sql);
        // Apply Migration 16 a second time to verify idempotency
        await upgradeDb.exec(migration16Sql);

        const legacySub = await upgradeDb.query<{
          organization_id: string;
          plan_tier: string;
          status: string;
          seat_count: number;
          trial_days_ahead: number;
          entitlements: { max_members: number; ai_daily_draft_quota: number };
        }>(`
          select
            organization_id,
            plan_tier,
            status,
            seat_count,
            extract(day from (trial_end - now()))::integer as trial_days_ahead,
            entitlements
          from public.organization_subscriptions
          where organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
        `);

        expect(legacySub.rows).toHaveLength(1);
        expect(legacySub.rows[0]?.plan_tier).toBe("pilot");
        expect(legacySub.rows[0]?.status).toBe("trialing");
        // Preserves existing 7 active+invited members instead of locking them at 5
        expect(legacySub.rows[0]?.seat_count).toBe(7);
        expect(legacySub.rows[0]?.entitlements.max_members).toBe(7);
        expect(legacySub.rows[0]?.entitlements.ai_daily_draft_quota).toBe(8);
        // Trial is ~14 days in the future from migration execution, NOT expired from 90 days ago
        expect(legacySub.rows[0]?.trial_days_ahead).toBeGreaterThanOrEqual(13);

        // Verify RLS, FORCE RLS, and internal trigger function privilege revocations
        const rlsCheck = await upgradeDb.query<{
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>(`
          select relname, relrowsecurity, relforcerowsecurity
          from pg_class
          where relname in ('organization_subscriptions', 'billing_webhook_events')
          order by relname;
        `);
        expect(rlsCheck.rows).toEqual([
          {
            relname: "billing_webhook_events",
            relrowsecurity: true,
            relforcerowsecurity: true,
          },
          {
            relname: "organization_subscriptions",
            relrowsecurity: true,
            relforcerowsecurity: true,
          },
        ]);

        const fnPrivCheck = await upgradeDb.query<{
          proname: string;
          anon_exec: boolean;
          auth_exec: boolean;
        }>(`
          select
            p.proname,
            has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in (
              'provision_default_org_subscription',
              'sync_org_ai_quota_from_subscription',
              'enforce_organization_subscription_entitlements',
              'set_subscription_updated_at'
            );
        `);
        expect(fnPrivCheck.rows).toHaveLength(4);
        for (const row of fnPrivCheck.rows) {
          expect(row.anon_exec).toBe(false);
          expect(row.auth_exec).toBe(false);
        }
      } finally {
        await upgradeDb.close();
      }
    });
  });
});
