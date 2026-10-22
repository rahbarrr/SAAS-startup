import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { getStoreForOrg, updateStoreForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string; storeId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, storeId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);

    const store = await getStoreForOrg({
      user,
      candidateOrgId: orgId,
      candidateStoreId: storeId,
      tenancyRepository,
      storesRepository,
    });

    return jsonSuccess(store, 200);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, storeId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const updated = await updateStoreForOrg({
      user,
      candidateOrgId: orgId,
      candidateStoreId: storeId,
      rawInput: body,
      tenancyRepository,
      storesRepository,
    });

    return jsonSuccess(updated, 200);
  } catch (error) {
    return jsonError(error);
  }
}
