import type { NextRequest } from "next/server";
import { setActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { switchActiveOrganizationForCaller } from "@/modules/tenancy/service";

export async function POST(request: NextRequest): Promise<Response> {
  try {
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

    const selected = await switchActiveOrganizationForCaller({
      user,
      rawInput: body,
      repository,
    });

    await setActiveOrgCookie(selected.organization.id);

    return jsonSuccess(selected, 200);
  } catch (error) {
    return jsonError(error);
  }
}
