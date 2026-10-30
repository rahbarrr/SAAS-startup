import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { upsertStoreGeofenceConfiguration } from "@/modules/location/service";
import { resolveTenantContext } from "@/modules/tenancy/authorization";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const locationRepository = new SupabaseLocationRepository(supabase);

    await resolveTenantContext({
      user,
      candidateOrgId: orgId,
      repository: tenancyRepository,
    });

    const geofences = await locationRepository.listStoreGeofencesForOrg(orgId);
    return jsonSuccess(geofences, 200);
  } catch (error) {
    return jsonError(error);
  }
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
    const locationRepository = new SupabaseLocationRepository(supabase);

    const body = (await request.json()) as unknown;

    const result = await upsertStoreGeofenceConfiguration({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      locationRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
