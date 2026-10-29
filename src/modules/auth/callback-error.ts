import { sanitizeRedirectPath } from "@/modules/auth/schemas";

/**
 * Converts the callback's deliberately coarse error code into a useful login message.
 * Provider error text is never reflected into the page.
 */
export function getAuthCallbackErrorMessage(error: string | null): string | null {
  if (!error) return null;

  if (error === "Unable to verify authentication link") {
    return "We couldn't verify that sign-in or confirmation link. It may have expired; please try signing in again.";
  }

  return "Sign-in could not be completed. Please try again or use email sign-in.";
}

export function createAuthCallbackFailureUrl(
  canonicalOrigin: string,
  nextPath: string
): URL {
  const loginUrl = new URL("/login", canonicalOrigin);
  loginUrl.searchParams.set("error", "Unable to verify authentication link");
  loginUrl.searchParams.set("next", sanitizeRedirectPath(nextPath, "/onboarding"));
  return loginUrl;
}
