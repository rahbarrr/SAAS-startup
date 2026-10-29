/**
 * Builds the OAuth return URL on the same canonical host used by the callback
 * handler. Supabase session cookies are host-scoped, so switching hosts after
 * code exchange would make the new session appear to be missing.
 */
export function createAuthCallbackUrl(
  configuredAppUrl: string | undefined,
  currentOrigin: string,
  nextPath: string
): URL {
  const appOrigin = configuredAppUrl?.trim() || currentOrigin;
  const callbackUrl = new URL("/auth/callback", appOrigin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl;
}
