import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";

async function getRequestBearerToken(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const authHeader =
      headerStore.get("authorization") ?? headerStore.get("Authorization");
    if (authHeader && /^Bearer\s+(.+)$/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      return token.length > 0 ? token : null;
    }
  } catch {
    // headers() may throw when called outside a Next.js request scope in unit tests
  }
  return null;
}

/**
 * Verifies the caller's identity with Supabase Auth (`auth.getUser()`).
 * Supports both cookie-authenticated web sessions and `Authorization: Bearer <jwt>`
 * tokens from the FieldTrack native mobile client.
 * Never uses `getSession()` alone on the server, since session tokens must be re-verified.
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthenticatedUser | null> {
  const bearerToken = await getRequestBearerToken();

  const {
    data: { user },
    error,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}
