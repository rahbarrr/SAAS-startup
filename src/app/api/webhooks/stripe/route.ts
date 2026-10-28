import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getStripeRuntimeConfig } from "@/lib/env/server";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import {
  createAdminServerSupabaseClient,
  createUserServerSupabaseClient,
} from "@/lib/supabase/server";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseBillingRepository } from "@/modules/billing/repository";
import { processStripeWebhookPayload } from "@/modules/billing/service";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const signatureHeader = request.headers.get("stripe-signature") ?? "";

    // If no Stripe cryptographic signature is provided, enforce standard authentication
    // so unauthenticated probes are rejected with 401 UNAUTHENTICATED and zero DB writes.
    if (!signatureHeader.trim()) {
      const userSupabase = await createUserServerSupabaseClient();
      const user = await getAuthenticatedUser(userSupabase);
      if (!user) {
        throw new AppError(
          "UNAUTHENTICATED",
          "Missing Stripe-Signature webhook header.",
          401
        );
      }
      throw new AppError(
        "BILLING_WEBHOOK_SIGNATURE_MISSING",
        "Missing Stripe-Signature header.",
        400
      );
    }

    const rawBody = await request.text();
    const stripeConfig = getStripeRuntimeConfig();
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminServerSupabaseClient()
      : await createUserServerSupabaseClient();

    const billingRepository = new SupabaseBillingRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    const result = await processStripeWebhookPayload({
      rawBody,
      signatureHeader,
      stripeConfig,
      repository: billingRepository,
      auditRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
