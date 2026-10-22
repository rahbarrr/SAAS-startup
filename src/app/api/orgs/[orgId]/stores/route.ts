import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { createStoreForOrg, listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const tenancyRepository = new SupabaseTenancyRepository(supabase);
    const storesRepository = new SupabaseStoresRepository(supabase);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      region: searchParams.get("region") ?? undefined,
      active: searchParams.get("active") ?? undefined,
    };

    const result = await listStoresForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      tenancyRepository,
      storesRepository,
    });

    return jsonSuccess(result.items, 200, {
      pagination: result.pagination,
    });
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
    const storesRepository = new SupabaseStoresRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const store = await createStoreForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      tenancyRepository,
      storesRepository,
    });

    return jsonSuccess(store, 201);
  } catch (error) {
    return jsonError(error);
  }
}
