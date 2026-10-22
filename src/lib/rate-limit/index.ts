import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";

export type RateLimitScope =
  "auth_sign_in" | "auth_sign_up" | "auth_recovery" | "ai_draft" | "upload";

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

/** Conservative defaults; tune per environment after observing real traffic. */
export const RATE_LIMIT_POLICIES: Record<RateLimitScope, RateLimitPolicy> = {
  auth_sign_in: { limit: 10, windowSeconds: 300 },
  auth_sign_up: { limit: 5, windowSeconds: 3600 },
  auth_recovery: { limit: 5, windowSeconds: 3600 },
  ai_draft: { limit: 10, windowSeconds: 3600 },
  upload: { limit: 60, windowSeconds: 3600 },
};

/**
 * Consumes one hit from the Postgres rate limiter and throws `RATE_LIMITED` (429) when exceeded.
 * Fails CLOSED: if the limiter itself is unavailable the request is rejected, because the
 * protected operations are credential-guessing and paid-provider calls.
 */
export async function enforceRateLimit(params: {
  supabase: Pick<SupabaseClient, "rpc">;
  scope: RateLimitScope;
  subject: string;
  policy?: RateLimitPolicy;
}): Promise<void> {
  const policy = params.policy ?? RATE_LIMIT_POLICIES[params.scope];
  const { data, error } = await params.supabase.rpc("consume_rate_limit", {
    p_scope: params.scope,
    p_subject: params.subject.slice(0, 256),
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });

  if (error) {
    throw new AppError(
      "RATE_LIMITED",
      "This action is temporarily unavailable. Please try again shortly.",
      429
    );
  }

  if (data !== true) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please wait a few minutes and try again.",
      429
    );
  }
}

/** Best-effort client IP from proxy headers (platform-set; treated as a throttling hint only). */
export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}
