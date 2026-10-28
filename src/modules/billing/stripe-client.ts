import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/http/envelope";
import type { PlanTier } from "./domain";

export interface CreateStripeCheckoutParams {
  secretKey: string;
  apiBaseUrl: string;
  priceId: string;
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  existingCustomerId?: string | null;
  planTier: PlanTier;
  seatCount: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateStripePortalParams {
  secretKey: string;
  apiBaseUrl: string;
  customerId: string;
  returnUrl: string;
}

export interface StripeSignatureVerificationOptions {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/**
 * Cryptographically verifies Stripe's `Stripe-Signature` header (`t=<timestamp>,v1=<hmac>`)
 * using HMAC-SHA256 and constant-time comparison (`timingSafeEqual`).
 */
export function verifyStripeWebhookSignature(
  options: StripeSignatureVerificationOptions
): { timestamp: number } {
  const {
    rawBody,
    signatureHeader,
    webhookSecret,
    toleranceSeconds = 300,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = options;

  if (!signatureHeader || !signatureHeader.trim()) {
    throw new AppError(
      "BILLING_WEBHOOK_SIGNATURE_MISSING",
      "Missing Stripe-Signature header.",
      400
    );
  }

  if (!webhookSecret || !webhookSecret.trim()) {
    throw new AppError(
      "BILLING_NOT_CONFIGURED",
      "STRIPE_WEBHOOK_SECRET is not configured on the server.",
      503
    );
  }

  const parts = signatureHeader.split(",").map((part) => part.trim());
  let timestampStr: string | null = null;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) {
      timestampStr = value;
    } else if (key === "v1" && value) {
      v1Signatures.push(value);
    }
  }

  const timestamp = timestampStr ? Number(timestampStr) : Number.NaN;
  if (!Number.isInteger(timestamp) || timestamp <= 0 || v1Signatures.length === 0) {
    throw new AppError(
      "BILLING_WEBHOOK_SIGNATURE_INVALID",
      "Malformed Stripe-Signature header.",
      400
    );
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new AppError(
      "BILLING_WEBHOOK_TIMESTAMP_EXPIRED",
      "Stripe webhook timestamp is outside the allowed replay tolerance window.",
      400
    );
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "utf8");

  const matched = v1Signatures.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (candidateBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(candidateBuf, expectedBuf);
  });

  if (!matched) {
    throw new AppError(
      "BILLING_WEBHOOK_SIGNATURE_INVALID",
      "Stripe webhook cryptographic signature verification failed.",
      400
    );
  }

  return { timestamp };
}

/**
 * Helper to generate a valid `Stripe-Signature` header for automated tests.
 */
export function createStripeWebhookSignatureHeader(params: {
  rawBody: string;
  webhookSecret: string;
  timestampSeconds?: number;
}): string {
  const t = params.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", params.webhookSecret)
    .update(`${t}.${params.rawBody}`, "utf8")
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

export class StripeBillingClient {
  async createCheckoutSession(
    params: CreateStripeCheckoutParams
  ): Promise<{ id: string; url: string }> {
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("client_reference_id", params.organizationId);
    form.set("success_url", params.successUrl);
    form.set("cancel_url", params.cancelUrl);
    form.set("line_items[0][price]", params.priceId);
    form.set("line_items[0][quantity]", String(params.seatCount));
    form.set("metadata[organization_id]", params.organizationId);
    form.set("metadata[organization_name]", params.organizationName);
    form.set("metadata[plan_tier]", params.planTier);
    form.set("metadata[seat_count]", String(params.seatCount));
    form.set("subscription_data[metadata][organization_id]", params.organizationId);
    form.set("subscription_data[metadata][plan_tier]", params.planTier);
    form.set("subscription_data[metadata][seat_count]", String(params.seatCount));

    if (params.existingCustomerId) {
      form.set("customer", params.existingCustomerId);
    } else {
      form.set("customer_email", params.customerEmail);
    }

    const baseUrl = params.apiBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const body = (await response.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !body.id || !body.url) {
      throw new AppError(
        "BILLING_PROVIDER_ERROR",
        body.error?.message ??
          `Stripe Checkout session creation failed (HTTP ${response.status}).`,
        502
      );
    }

    return {
      id: body.id,
      url: body.url,
    };
  }

  async createBillingPortalSession(
    params: CreateStripePortalParams
  ): Promise<{ id: string; url: string }> {
    const form = new URLSearchParams();
    form.set("customer", params.customerId);
    form.set("return_url", params.returnUrl);

    const baseUrl = params.apiBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/billing_portal/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const body = (await response.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !body.id || !body.url) {
      throw new AppError(
        "BILLING_PROVIDER_ERROR",
        body.error?.message ??
          `Stripe Billing Portal session creation failed (HTTP ${response.status}).`,
        502
      );
    }

    return {
      id: body.id,
      url: body.url,
    };
  }
}
