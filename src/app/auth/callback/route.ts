import { type NextRequest, NextResponse } from "next/server";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/modules/auth/schemas";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/onboarding");

  if (code) {
    const supabase = await createUserServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = nextPath;
      const nextUrl = new URL(nextPath, origin);
      // OAuth sign-in should return existing members to the workspace, while new
      // accounts must complete company setup. Invitation tokens always go through onboarding.
      if (nextUrl.pathname === "/onboarding" && !nextUrl.searchParams.has("token")) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const repository = new SupabaseTenancyRepository(supabase);
            const memberships = await repository.listUserOrganizations(userData.user.id);
            if (memberships.some((entry) => entry.membership.status === "active" && entry.organization.status === "active")) {
              destination = "/";
            }
          }
        } catch {
          // Fail closed into onboarding if membership resolution is temporarily unavailable.
        }
      }
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Unable+to+verify+authentication+link`
  );
}
