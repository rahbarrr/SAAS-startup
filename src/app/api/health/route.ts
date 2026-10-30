import { NextResponse } from "next/server";
import {
  createAdminServerSupabaseClient,
  createUserServerSupabaseClient,
} from "@/lib/supabase/server";
import { resolveRouteDistanceProvider } from "@/modules/routing/provider";

export const dynamic = "force-dynamic";

export interface HealthCheckResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: {
      status: "connected" | "disconnected";
      latencyMs?: number;
      error?: string;
    };
    routing: {
      provider: string;
    };
    pushNotifications: {
      configured: boolean;
    };
    emailDelivery: {
      configured: boolean;
    };
    schedulerAuth: {
      configured: boolean;
    };
    aiReports: {
      configured: boolean;
    };
    billing: {
      configured: boolean;
    };
  };
}

const processStartTime = Date.now();

export async function GET(request?: Request): Promise<NextResponse<HealthCheckResponse>> {
  const correlationId =
    request?.headers?.get("x-correlation-id") ||
    request?.headers?.get("x-request-id") ||
    crypto.randomUUID();
  const startDbCheck = Date.now();
  let dbStatus: "connected" | "disconnected" = "connected";
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminServerSupabaseClient()
      : await createUserServerSupabaseClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);

    dbLatencyMs = Date.now() - startDbCheck;
    if (error) {
      dbStatus = "disconnected";
      dbError = "Database query returned error status";
    }
  } catch (err) {
    dbStatus = "disconnected";
    dbLatencyMs = Date.now() - startDbCheck;
    dbError = err instanceof Error ? err.message : "Database connection failed";
  }

  const routingProvider = resolveRouteDistanceProvider().providerName;
  const isPushConfigured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
  const emailProvider = process.env.INVITATION_EMAIL_PROVIDER ?? "mailtrap";
  const isEmailConfigured =
    emailProvider === "mailtrap"
      ? Boolean(process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS)
      : emailProvider === "resend" &&
        Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  const isSchedulerAuthConfigured = Boolean(process.env.CRON_SECRET);
  const isAiReportsConfigured = Boolean(
    process.env.OPENAI_API_KEY && process.env.OPENAI_REPORT_MODEL
  );
  const isBillingConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    (process.env.STRIPE_PRICE_ID_PRO_MONTHLY ||
      process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY)
  );

  const isHealthy = dbStatus === "connected";

  const responseBody: HealthCheckResponse = {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
    environment: process.env.NODE_ENV ?? "development",
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      routing: {
        provider: routingProvider,
      },
      pushNotifications: {
        configured: isPushConfigured,
      },
      emailDelivery: {
        configured: isEmailConfigured,
      },
      schedulerAuth: {
        configured: isSchedulerAuthConfigured,
      },
      aiReports: {
        configured: isAiReportsConfigured,
      },
      billing: {
        configured: isBillingConfigured,
      },
    },
  };

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "x-correlation-id": correlationId,
    },
  });
}
