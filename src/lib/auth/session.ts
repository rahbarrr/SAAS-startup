import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";

/**
 * Verifies the caller's identity with Supabase Auth (`auth.getUser()`).
 * Never uses `getSession()` alone on the server, since session cookies must be re-verified.
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthenticatedUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}
