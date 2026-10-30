import { sanitizeRedirectPath } from "./schemas";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === "string" && selected.length > 0 ? selected : null;
}

function isSafeAuthorizationCode(code: string): boolean {
  return code.length <= 4096 && !/[\\u0000-\\u001f\\u007f]/.test(code);
}

/**
 * Supabase may use the configured Site URL when a redirect target is not
 * accepted. If that Site URL is "/", forward its authorization response to
 * the real callback handler without leaving the host that owns the PKCE cookie.
 */
export function buildRootOAuthCallbackRedirect(
  searchParams: SearchParams
): string | null {
  const code = firstValue(searchParams.code);
  const providerError = firstValue(searchParams.error);
  const errorCode = firstValue(searchParams.error_code);

  if (!code && !providerError) {
    return null;
  }

  if (code && !isSafeAuthorizationCode(code)) {
    return null;
  }

  const invitationToken =
    firstValue(searchParams.invite_token) ?? firstValue(searchParams.token);
  const isValidInvitationToken =
    invitationToken && /^[A-Za-z0-9_-]{16,256}$/.test(invitationToken);
  const invitationNext = isValidInvitationToken
    ? `/onboarding?token=${encodeURIComponent(invitationToken)}`
    : "/dashboard";
  const nextPath = sanitizeRedirectPath(
    firstValue(searchParams.next),
    invitationNext
  );

  const callbackParams = new URLSearchParams();
  if (code) callbackParams.set("code", code);
  if (providerError) callbackParams.set("error", providerError.slice(0, 128));
  if (errorCode) callbackParams.set("error_code", errorCode.slice(0, 128));
  callbackParams.set("next", nextPath);

  return `/auth/callback?${callbackParams.toString()}`;
}
