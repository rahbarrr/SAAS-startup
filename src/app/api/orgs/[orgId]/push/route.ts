import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import {
  registerWebPushSubscriptionForOrg,
  revokeWebPushSubscriptionForOrg,
  type WebPushSubscriptionInput,
} from "@/modules/notifications/push";
import { SupabaseWebPushRepository } from "@/modules/notifications/push-repository";
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
    const pushRepository = new SupabaseWebPushRepository(supabase);

    // Enforce tenant authorization check first
    await resolveTenantContext({
      user,
      candidateOrgId: orgId,
      repository: tenancyRepository,
    });

    let body: WebPushSubscriptionInput;
    try {
      body = (await request.json()) as WebPushSubscriptionInput;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const created = await registerWebPushSubscriptionForOrg({
      user,
      candidateOrgId: orgId,
      input: body,
      tenancyRepository,
      pushRepository,
    });

    return jsonSuccess(created, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const pushRepository = new SupabaseWebPushRepository(supabase);

    // Enforce tenant authorization check first
    await resolveTenantContext({
      user,
      candidateOrgId: orgId,
      repository: tenancyRepository,
    });

    let body: { endpoint: string };
    try {
      body = (await request.json()) as { endpoint: string };
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    if (!body?.endpoint) {
      throw new AppError("VALIDATION_ERROR", "endpoint is required to unsubscribe", 400);
    }

    const revoked = await revokeWebPushSubscriptionForOrg({
      user,
      candidateOrgId: orgId,
      endpoint: body.endpoint,
      tenancyRepository,
      pushRepository,
    });

    return jsonSuccess({ revoked }, 200);
  } catch (error) {
    return jsonError(error);
  }
}
