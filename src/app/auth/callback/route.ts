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
  const providerError = searchParams.get("error");
  const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/onboarding");

  const originResolution = resolveAuthAppOrigin();
  if (!originResolution.origin) {
    return NextResponse.json(
      { error: "Authentication callback is not configured safely." },
      { status: 503 }
    );
  }
  const canonicalOrigin = originResolution.origin;

  if (code && !providerError) {
    try {
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
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData.user) {
              logger.warn("OAuth session exchange returned no authenticated user", {
                errorCode: userError?.code ?? "MISSING_USER",
              });
              return NextResponse.redirect(new URL("/login", canonicalOrigin));
            }
            const repository = new SupabaseTenancyRepository(supabase);
            const memberships = await repository.listUserOrganizations(userData.user.id);
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
          } catch {
            logger.error(
              "Could not check organization memberships during OAuth callback",
              {
                errorCode: "MEMBERSHIP_LOOKUP_FAILED",
              }
            );
            // The session is valid, but we cannot safely conclude that the user is
            // new. Send them to the authenticated app shell instead of provisioning
            // a duplicate organization or triggering the onboarding guard.
            destination = "/dashboard";
          }
        }

        return NextResponse.redirect(new URL(destination, canonicalOrigin));
      } else {
        logger.error("OAuth code exchange failed", {
          errorCode: error.code,
        });
      }
    } catch {
      logger.error("OAuth callback failed before session establishment", {
        errorCode: "CALLBACK_PROCESSING_FAILED",
      });
    }
  }

  if (providerError) {
    logger.warn("OAuth provider returned an authentication error", {
      errorCode: "PROVIDER_AUTHENTICATION_FAILED",
    });
  } else if (!code) {
    logger.warn("OAuth callback did not contain an authorization code", {
      errorCode: "MISSING_AUTHORIZATION_CODE",
    });
  }

  // Keep an invitation or intended destination available if the user retries sign-in.
  return NextResponse.redirect(createAuthCallbackFailureUrl(canonicalOrigin, nextPath));
}
