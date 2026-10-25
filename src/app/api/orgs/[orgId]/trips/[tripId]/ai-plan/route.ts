import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import {
  applyTripPlanRecommendationForOrg,
  generateTripPlanAssistantForOrg,
} from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { SupabaseTripsRepository } from "@/modules/trips/repository";

interface RouteContext {
  params: Promise<{ orgId: string; tripId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, tripId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    const summary = await generateTripPlanAssistantForOrg({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      tenancyRepository,
      tripsRepository,
      storesRepository,
      auditRepository,
    });

    return jsonSuccess(summary, 200);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, tripId } = await context.params;
    let body: { action?: "generate" | "apply"; [key: string]: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // Body is optional for generate request
    }

    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    if (body.action === "apply") {
      const updatedTrip = await applyTripPlanRecommendationForOrg({
        user,
        candidateOrgId: orgId,
        candidateTripId: tripId,
        rawInput: body,
        tenancyRepository,
        tripsRepository,
        storesRepository,
        auditRepository,
      });
      return jsonSuccess(updatedTrip, 200);
    }

    const summary = await generateTripPlanAssistantForOrg({
      user,
      candidateOrgId: orgId,
      candidateTripId: tripId,
      tenancyRepository,
      tripsRepository,
      storesRepository,
      auditRepository,
    });

    return jsonSuccess(summary, 200);
  } catch (error) {
    return jsonError(error);
  }
}
