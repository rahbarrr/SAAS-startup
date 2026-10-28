import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StripeRuntimeConfig } from "@/lib/env/server";
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
  type StripeBillingClient,
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

    // Admin can update seats when >= active + invited members and <= plan max
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
        // 1. Verify AI quota sync when subscription is upgraded to Pro (50 drafts/day)
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

        // 2. Verify store limit enforcement (set max_stores to 1, below current active store count)
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

        // 3. Verify seat limit enforcement (set seat_count to 2, below current active member count = 3)
        await db.query(`
          update public.organization_subscriptions
             set seat_count = 2
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

        // 4. Verify read-only lock when subscription status is 'canceled' or trial is expired
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
      } finally {
        await db.exec("rollback;");
      }
    });
  });
});
