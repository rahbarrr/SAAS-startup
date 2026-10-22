import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseNotificationsRepository } from "@/modules/notifications/repository";
import {
  listInAppNotificationsForOrg,
  markInAppNotificationReadForOrg,
} from "@/modules/notifications/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

/**
 * GET /api/orgs/[orgId]/notifications
 * Returns in-app notifications derived deterministically from committed `trip_audit_events`.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const notificationsRepository = new SupabaseNotificationsRepository(supabase);

    const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
    const overview = await listInAppNotificationsForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      notificationsRepository,
    });

    return jsonSuccess(overview, 200);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * POST /api/orgs/[orgId]/notifications
 * Idempotently marks an event-derived notification as read (`ON CONFLICT DO NOTHING`).
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const notificationsRepository = new SupabaseNotificationsRepository(supabase);

    const receipt = await markInAppNotificationReadForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      notificationsRepository,
    });

    return jsonSuccess(receipt, 200);
  } catch (err) {
    return jsonError(err);
  }
}
