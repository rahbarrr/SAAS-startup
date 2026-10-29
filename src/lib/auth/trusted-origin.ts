import "server-only";

export interface TrustedOriginResolution {
  origin: string | null;
  error: string | null;
}

function parseOrigin(value: string, label: string): TrustedOriginResolution {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { origin: null, error: `${label} must use HTTP or HTTPS.` };
    }
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      return {
        origin: null,
        error: `${label} must contain only a trusted application origin.`,
      };
    }
    return { origin: url.origin, error: null };
  } catch {
    return { origin: null, error: `${label} must be a valid application URL.` };
  }
}

/**
 * Resolves the application origin from explicit deployment configuration only.
 * Request Host and forwarded-host headers are intentionally never consulted.
 */
export function resolveTrustedAppOrigin(
  envSource: Record<string, string | undefined> = process.env
): TrustedOriginResolution {
  const appUrl = envSource.NEXT_PUBLIC_APP_URL?.trim();
  const vercelEnvironment = envSource.VERCEL_ENV?.trim();

  if (vercelEnvironment === "preview") {
    const vercelUrl = envSource.VERCEL_URL?.trim();
    if (vercelUrl) {
      const candidate = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
      const parsed = parseOrigin(candidate, "VERCEL_URL");
      if (!parsed.origin) return parsed;
      if (!new URL(parsed.origin).hostname.endsWith(".vercel.app")) {
        return {
          origin: null,
          error: "VERCEL_URL must be a trusted Vercel Preview hostname.",
        };
      }
      return parsed;
    }
  }

  if (!appUrl) {
    return {
      origin: null,
      error:
        "The application URL is not configured. Set NEXT_PUBLIC_APP_URL or provide VERCEL_URL for Preview.",
    };
  }

  return parseOrigin(appUrl, "NEXT_PUBLIC_APP_URL");
}

/**
 * Resolves the host used for authentication callbacks and verification emails.
 * An explicit Preview app URL must win here so the OAuth callback and the host
 * that created its session cookie remain the same. Other Preview links retain
 * resolveTrustedAppOrigin's deployment-specific VERCEL_URL behavior.
 */
export function resolveAuthAppOrigin(
  envSource: Record<string, string | undefined> = process.env
): TrustedOriginResolution {
  const vercelEnvironment = envSource.VERCEL_ENV?.trim();

  // Vercel provides this project-level Production domain separately from
  // VERCEL_URL, which is deployment-specific. Never let a Production auth
  // callback follow a generated deployment URL.
  if (vercelEnvironment === "production") {
    const projectProductionUrl = envSource.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (projectProductionUrl) {
      const candidate = projectProductionUrl.startsWith("http")
        ? projectProductionUrl
        : `https://${projectProductionUrl}`;
      const productionOrigin = parseOrigin(candidate, "VERCEL_PROJECT_PRODUCTION_URL");
      if (!productionOrigin.origin) return productionOrigin;
      if (!productionOrigin.origin.startsWith("https://")) {
        return {
          origin: null,
          error: "The Vercel Production application URL must use HTTPS.",
        };
      }

      const appUrl = envSource.NEXT_PUBLIC_APP_URL?.trim();
      if (appUrl) {
        const configuredOrigin = parseOrigin(appUrl, "NEXT_PUBLIC_APP_URL");
        if (!configuredOrigin.origin) return configuredOrigin;
        if (configuredOrigin.origin !== productionOrigin.origin) {
          return {
            origin: null,
            error:
              "NEXT_PUBLIC_APP_URL must match VERCEL_PROJECT_PRODUCTION_URL in Production.",
          };
        }
      }

      return productionOrigin;
    }
  }

  if (vercelEnvironment === "preview" && envSource.NEXT_PUBLIC_APP_URL?.trim()) {
    return parseOrigin(envSource.NEXT_PUBLIC_APP_URL.trim(), "NEXT_PUBLIC_APP_URL");
  }

  return resolveTrustedAppOrigin(envSource);
}
