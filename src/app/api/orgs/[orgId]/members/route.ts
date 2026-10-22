import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { addMemberToOrg, listMembersForOrg } from "@/modules/tenancy/service";

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
    const repository = new SupabaseTenancyRepository(supabase);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };

    const result = await listMembersForOrg({
      user,
      candidateOrgId: orgId,
      rawQuery,
      repository,
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
    const repository = new SupabaseTenancyRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const membership = await addMemberToOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      repository,
    });

    return jsonSuccess(membership, 201);
  } catch (error) {
    return jsonError(error);
  }
}
