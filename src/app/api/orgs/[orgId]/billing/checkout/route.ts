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
import { billingActionRequestSchema } from "@/modules/billing/schemas";
import { handleOrganizationBillingAction } from "@/modules/billing/service";
import { resolveTenantContext } from "@/modules/tenancy/authorization";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);

    const orgContext = await resolveTenantContext({
      user,
      candidateOrgId: orgId,
      repository: tenancyRepository,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const candidate =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const input = billingActionRequestSchema.parse({
      ...candidate,
      action: "checkout",
    });

    const billingSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminServerSupabaseClient()
      : supabase;
    const billingRepository = new SupabaseBillingRepository(billingSupabase);
    const auditRepository = new SupabaseAuditRepository(supabase);
    const stripeConfig = getStripeRuntimeConfig();
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.nextUrl.origin ||
      "http://localhost:3000";

    const orgs = await tenancyRepository.listUserOrganizations(orgContext.user.id);
    const matchedOrg = orgs.find((item) => item.organization.id === orgId);

    const result = await handleOrganizationBillingAction({
      context: orgContext,
      organizationName: matchedOrg?.organization.name ?? "FieldTrack Workspace",
      appBaseUrl,
      input,
      repository: billingRepository,
      auditRepository,
      stripeConfig,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
