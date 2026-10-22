import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { createInvitationForOrg } from "@/modules/tenancy/service";

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
    const repository = new SupabaseTenancyRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(
        "VALIDATION_ERROR",
        "Request body must be valid JSON",
        400
      );
    }

    const result = await createInvitationForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      repository,
    });

    return jsonSuccess(result, 201);
  } catch (error) {
    return jsonError(error);
  }
}
