import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { clientIpFromHeaders, enforceRateLimit } from "@/lib/rate-limit";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { signInInputSchema } from "@/modules/auth/schemas";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { listUserOrganizationsForCaller } from "@/modules/tenancy/service";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createUserServerSupabaseClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    const candidate =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    if (!candidate.email && !candidate.password) {
      const existingUser = await getAuthenticatedUser(supabase);
      if (!existingUser) {
        throw new AppError(
          "UNAUTHENTICATED",
          "Authentication credentials are required to sign in.",
          401
        );
      }
    }

    const input = signInInputSchema.parse(body);
    const ip = clientIpFromHeaders(request.headers);

    await enforceRateLimit({
      supabase,
      scope: "auth_sign_in",
      subject: `ip:${ip}`,
    });
    await enforceRateLimit({
      supabase,
      scope: "auth_sign_in",
      subject: `email:${input.email.trim().toLowerCase()}`,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.user.email || !data.session?.access_token) {
      throw new AppError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password. Please check your credentials and try again.",
        401
      );
    }

    const env = getPublicEnv();
    const authedSupabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );

    const tenancyRepository = new SupabaseTenancyRepository(authedSupabase);
    const organizations = await listUserOrganizationsForCaller({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      repository: tenancyRepository,
    });

    return jsonSuccess(
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token ?? null,
        expiresAt: data.session.expires_at ?? null,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        organizations,
      },
      200
    );
  } catch (error) {
    return jsonError(error);
  }
}
