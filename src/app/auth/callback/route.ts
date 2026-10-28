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
      const hasInvitationToken =
        nextUrl.pathname === "/onboarding" && nextUrl.searchParams.has("token");

      // Invitation tokens always go through onboarding. Everyone else must have an
      // active workspace before the callback can take them to a workspace-only page.
      if (!hasInvitationToken) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const repository = new SupabaseTenancyRepository(supabase);
          const memberships = userData.user
            ? await repository.listUserOrganizations(userData.user.id)
            : [];
          const hasActiveMembership = memberships.some(
            (entry) =>
              entry.membership.status === "active" &&
              entry.organization.status === "active"
          );

          destination = hasActiveMembership
            ? nextUrl.pathname === "/onboarding"
              ? "/"
              : nextPath
            : "/onboarding";
        } catch {
          destination = "/onboarding";
        }
      }

      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Unable+to+verify+authentication+link`
  );
}
