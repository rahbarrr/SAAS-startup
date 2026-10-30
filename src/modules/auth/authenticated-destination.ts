import { sanitizeRedirectPath } from "./schemas";

const AUTH_ENTRY_PATHS = new Set(["/login", "/signup", "/forgot-password"]);
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Chooses where an already-authenticated user should go when they open an
 * authentication page. Workspace routes perform their own membership checks.
 */
export function resolveAuthenticatedDestination(
  pathname: string,
  searchParams: URLSearchParams
): string {
  const invitationToken = searchParams.get("invite_token");
  if (invitationToken && INVITATION_TOKEN_PATTERN.test(invitationToken)) {
    return `/onboarding?token=${encodeURIComponent(invitationToken)}`;
  }

  const fallback = pathname === "/signup" ? "/onboarding" : "/dashboard";
  const destination = sanitizeRedirectPath(searchParams.get("next"), fallback);
  const destinationPathname = new URL(destination, "https://fieldtrack.invalid").pathname;

  if (destinationPathname === "/" || AUTH_ENTRY_PATHS.has(destinationPathname)) {
    return fallback;
  }

  return destination;
}
