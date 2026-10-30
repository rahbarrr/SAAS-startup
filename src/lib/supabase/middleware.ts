import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { isSameOriginMutation } from "@/lib/http/envelope";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/logger";
import { resolveAuthenticatedDestination } from "@/modules/auth/authenticated-destination";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/stores",
  "/trips",
  "/visits",
  "/approvals",
  "/team",
  "/onboarding",
  "/notifications",
  "/reports",
  "/ai-insights",
  "/settings",
  "/audit",
  "/reset-password",
] as const;

const AUTH_PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthPublicRoute(pathname: string): boolean {
  return AUTH_PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Assigns/propagates a correlation ID: forwarded to route handlers/server code via the request
 * header and echoed to the client on every response (including redirects and 403s).
 */
export async function updateSessionAndEnforceAuth(
  request: NextRequest
): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  request.headers.set(REQUEST_ID_HEADER, requestId);
  const response = await enforceSessionAndAuth(request);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function isDeployedRuntime(): boolean {
  const appEnv = process.env.APP_ENV;
  if (appEnv === "staging" || appEnv === "production") return true;
  return process.env.NODE_ENV === "production";
}

async function enforceSessionAndAuth(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Never serve a deployed environment without session enforcement. Local development keeps
    // working without Supabase configured so the UI can still be previewed.
    if (isDeployedRuntime()) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "INTERNAL_ERROR",
            message: "Service is temporarily unavailable",
          },
          meta: {},
        },
        { status: 503 }
      );
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({
          request,
        });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Always call getUser() to verify and refresh the auth token with Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    !isSameOriginMutation({
      method: request.method,
      originHeader: request.headers.get("origin"),
      host: request.headers.get("host"),
    })
  ) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "FORBIDDEN", message: "Cross-origin request rejected" },
        meta: {},
      },
      { status: 403 }
    );
  }

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      sanitizeRedirectPath(`${pathname}${request.nextUrl.search}`, "/")
    );
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/") {
    // OAuth providers can fall back to the configured Site URL. Never show the
    // marketing landing page after a valid session has been established.
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    dashboardUrl.hash = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (user && isAuthPublicRoute(pathname)) {
    const destination = resolveAuthenticatedDestination(
      pathname,
      request.nextUrl.searchParams
    );
    const destinationUrl = new URL(destination, request.nextUrl.origin);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destinationUrl.pathname;
    redirectUrl.search = destinationUrl.search;
    redirectUrl.hash = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
