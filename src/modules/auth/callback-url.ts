import { sanitizeRedirectPath } from "./schemas";

export class AuthRedirectConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRedirectConfigurationError";
  }
}

export interface AuthCallbackDeploymentInfo {
  vercelEnvironment?: string;
  vercelUrl?: string;
  vercelProjectProductionUrl?: string;
}

function normalizeOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid origin");
    }
    return url.origin;
  } catch {
    throw new AuthRedirectConfigurationError(
      `${label} must be a valid application origin. Check the deployment URL configuration.`
    );
  }
}

function originFromVercelDomain(domain: string, label: string): string {
  const candidate = domain.startsWith("http") ? domain : `https://${domain}`;
  const origin = normalizeOrigin(candidate, label);
  if (!origin.startsWith("https://")) {
    throw new AuthRedirectConfigurationError(`${label} must use HTTPS.`);
  }
  return origin;
}

/**
 * Returns a same-path redirect to the canonical production origin when a
 * production page was opened through a deployment-specific or alternate URL.
 * Keeping pathname, query, and hash preserves invite tokens and recovery state.
 */
export function getCanonicalProductionRedirectUrl(
  configuredAppUrl: string | undefined,
  currentHref: string,
  vercelEnvironment: string | undefined
): URL | null {
  if (vercelEnvironment?.trim() !== "production" || !configuredAppUrl?.trim()) {
    return null;
  }

  const canonicalOrigin = normalizeOrigin(configuredAppUrl.trim(), "NEXT_PUBLIC_APP_URL");
  const currentUrl = new URL(currentHref);
  if (currentUrl.origin === canonicalOrigin) {
    return null;
  }

  return new URL(
    `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    canonicalOrigin
  );
}

/**
 * Builds the OAuth return URL on the same host that served the sign-in page.
 * Production uses Vercel's project Production domain (never VERCEL_URL, which
 * points at a deployment). A mismatch fails before leaving FieldTrack because
 * Supabase cookies cannot move between hosts after the code exchange.
 */
export function createAuthCallbackUrl(
  configuredAppUrl: string | undefined,
  currentOrigin: string,
  nextPath: string,
  deployment: AuthCallbackDeploymentInfo = {}
): URL {
  const currentAppOrigin = normalizeOrigin(currentOrigin, "Current application URL");
  const configuredOrigin = configuredAppUrl?.trim()
    ? normalizeOrigin(configuredAppUrl.trim(), "NEXT_PUBLIC_APP_URL")
    : null;
  const environment = deployment.vercelEnvironment?.trim();

  let appOrigin = configuredOrigin ?? currentAppOrigin;

  if (environment === "production") {
    // NEXT_PUBLIC_APP_URL is the explicitly configured public canonical URL.
    // Vercel's system production URL may point at another valid alias for the
    // same deployment; that alias must not override the host the user opened.
    const productionOrigin =
      configuredOrigin ??
      (deployment.vercelProjectProductionUrl?.trim()
        ? originFromVercelDomain(
            deployment.vercelProjectProductionUrl.trim(),
            "VERCEL_PROJECT_PRODUCTION_URL"
          )
        : null);
    if (!productionOrigin) {
      throw new AuthRedirectConfigurationError(
        "Production sign-in is not configured. Set NEXT_PUBLIC_APP_URL to the public Production domain."
      );
    }
    if (currentAppOrigin !== productionOrigin) {
      throw new AuthRedirectConfigurationError(
        "Open FieldTrack at its public Production URL before signing in. This deployment URL cannot receive the Production session."
      );
    }
    appOrigin = productionOrigin;
  } else if (environment === "preview" && !configuredOrigin) {
    if (deployment.vercelUrl?.trim()) {
      const previewOrigin = originFromVercelDomain(
        deployment.vercelUrl.trim(),
        "VERCEL_URL"
      );
      if (!new URL(previewOrigin).hostname.endsWith(".vercel.app")) {
        throw new AuthRedirectConfigurationError(
          "VERCEL_URL must be a Vercel Preview hostname."
        );
      }
      appOrigin = previewOrigin;
    }
  }

  if (currentAppOrigin !== appOrigin) {
    throw new AuthRedirectConfigurationError(
      "The configured sign-in URL does not match this page. Open FieldTrack at its configured application URL and try again."
    );
  }

  const callbackUrl = new URL("/auth/callback", appOrigin);
  callbackUrl.searchParams.set("next", sanitizeRedirectPath(nextPath, "/onboarding"));
  return callbackUrl;
}
