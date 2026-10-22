import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import {
  createOrganizationForCaller,
  listUserOrganizationsForCaller,
} from "@/modules/tenancy/service";

export async function GET(): Promise<Response> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    const organizations = await listUserOrganizationsForCaller({
      user,
      repository,
    });

    return jsonSuccess(organizations, 200);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const organization = await createOrganizationForCaller({
      user,
      rawInput: body,
      repository,
    });

    return jsonSuccess(organization, 201);
  } catch (error) {
    return jsonError(error);
  }
}
