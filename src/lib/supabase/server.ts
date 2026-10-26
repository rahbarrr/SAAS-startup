import "server-only";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env/public";

export async function createUserServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot mutate cookies directly during render; middleware/route handlers can.
          }
        },
      },
    }
  );
}

/**
 * Creates an admin / service-role Supabase client for backend cron schedulers
 * and unattended tasks where no interactive user session or cookies exist.
 */
export function createAdminServerSupabaseClient(): SupabaseClient {
  const env = getPublicEnv();
  const serviceRoleKey =
    typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to create an admin server client."
    );
  }

  // Use createServerClient without cookies for unauthenticated service operations
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
