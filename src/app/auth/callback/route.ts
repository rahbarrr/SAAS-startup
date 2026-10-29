import { type NextRequest, NextResponse } from "next/server";
import { createAuthCallbackFailureUrl } from "@/modules/auth/callback-error";
import { resolveAuthAppOrigin } from "@/lib/auth/trusted-origin";
import { logger } from "@/lib/observability/logger";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/modules/auth/schemas";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/onboarding");

  const originResolution = resolveAuthAppOrigin();
  if (!originResolution.origin) {
    return NextResponse.json(
      { error: "Authentication callback is not configured safely." },
      { status: 503 }
    );
  }
  const canonicalOrigin = originResolution.origin;

  if (code) {
    const supabase = await createUserServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = nextPath;
      const nextUrl = new URL(nextPath, canonicalOrigin);
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
            ? nextUrl.pathname === "/onboarding" || nextPath === "/"
              ? "/dashboard"
              : nextPath
            : "/onboarding";
        } catch (err) {
          logger.warn("Could not check organization memberships during OAuth callback", {
            error: err instanceof Error ? err.message : String(err),
          });
          destination = "/onboarding";
        }
      }

      return NextResponse.redirect(new URL(destination, canonicalOrigin));
    } else {
      logger.error("OAuth code exchange failed", {
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
  }

  // Keep an invitation or intended destination available if the user retries sign-in.
  return NextResponse.redirect(createAuthCallbackFailureUrl(canonicalOrigin, nextPath));
}
