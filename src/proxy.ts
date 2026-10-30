import { type NextRequest, NextResponse } from "next/server";
import { updateSessionAndEnforceAuth } from "@/lib/supabase/middleware";
import { getCanonicalProductionRedirectUrl } from "@/modules/auth/callback-url";

const AUTH_ENTRY_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Enforce the canonical Production origin before the auth page or its client
  // bundle can start OAuth. A client-only useEffect redirect leaves a race in
  // which a fast click (or cached page) can create the PKCE verifier on an
  // alias host and receive the callback on a different host.
  if (AUTH_ENTRY_PATHS.has(request.nextUrl.pathname)) {
    try {
      const canonicalUrl = getCanonicalProductionRedirectUrl(
        process.env.NEXT_PUBLIC_APP_URL,
        request.url,
        process.env.NEXT_PUBLIC_VERCEL_ENV
      );

      if (canonicalUrl) {
        return NextResponse.redirect(canonicalUrl, 307);
      }
    } catch {
      // Keep the request on its current host; GoogleAuthButton validates the
      // same configuration and displays a safe, actionable sign-in error.
    }
  }

  return updateSessionAndEnforceAuth(request);
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
