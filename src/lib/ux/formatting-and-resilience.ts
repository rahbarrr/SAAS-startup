export interface TruncatedLabel {
  displayText: string;
  fullText: string;
  isTruncated: boolean;
}

const MONTH_ABBREVS_UTC = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats an ISO-8601 calendar date-only string (`YYYY-MM-DD`, such as `trips.start_date` or `trips.end_date`)
 * strictly as a calendar date without converting through the browser's local timezone offset.
 * Prevents the common bug where `new Date("2026-10-25")` shifts to `Oct 24` in negative UTC offsets.
 */
export function formatCalendarDateOnlyUtc(dateOnly: string | null | undefined): string {
  if (!dateOnly) {
    return "—";
  }

  const trimmed = dateOnly.trim();
  const match = ISO_DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    return trimmed;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MONTH_ABBREVS_UTC[monthIndex];

  if (!monthName || day < 1 || day > 31) {
    return trimmed;
  }

  return `${monthName} ${String(day).padStart(2, "0")}, ${year} (UTC)`;
}

/**
 * Formats an ISO-8601 server timestamp (`timestamptz`, such as `checked_in_at`, `submitted_at`, `decided_at`)
 * into a deterministic UTC timestamp string (`YYYY-MM-DD HH:mm UTC`).
 */
export function formatUtcTimestamp(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) {
    return "—";
  }

  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  const iso = parsed.toISOString();
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return `${datePart} ${timePart} UTC`;
}

/**
 * Safely truncates long names (store names, trip titles, user emails) for narrow mobile layouts
 * while preserving the complete string for `title` / `aria-label`.
 */
export function truncateDisplayLabel(rawText: string, maxChars = 48): TruncatedLabel {
  const normalized = rawText.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxChars) {
    return {
      displayText: normalized,
      fullText: normalized,
      isTruncated: false,
    };
  }

  const safeLimit = Math.max(4, maxChars - 1);
  return {
    displayText: `${normalized.slice(0, safeLimit).trimEnd()}…`,
    fullText: normalized,
    isTruncated: true,
  };
}

export type FailureCategory =
  | "expired_session"
  | "slow_network_or_timeout"
  | "rate_limited_or_conflict"
  | "validation_or_permission"
  | "server_error";

export interface ClassifiedFailureFeedback {
  category: FailureCategory;
  title: string;
  userMessage: string;
  canRetrySafely: boolean;
  requiresReauth: boolean;
}

/**
 * Classifies HTTP/network errors into actionable, accessible feedback for field employees
 * and managers (handling expired sessions, slow networks/timeouts, rate limits, and conflicts).
 */
export function classifyRequestFailure(params: {
  status?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  networkError?: unknown;
}): ClassifiedFailureFeedback {
  if (params.status === 401 || params.errorCode === "UNAUTHENTICATED") {
    return {
      category: "expired_session",
      title: "Session Expired — Sign In Required",
      userMessage:
        "Your authentication session has expired. Please sign in again to continue without losing your organization workspace.",
      canRetrySafely: false,
      requiresReauth: true,
    };
  }

  const isTimeoutError =
    params.status === 504 ||
    params.errorCode === "AI_PROVIDER_TIMEOUT" ||
    (params.networkError instanceof Error &&
      (params.networkError.name === "AbortError" ||
        params.networkError.name === "TimeoutError" ||
        /network|fetch|timeout/i.test(params.networkError.message)));

  if (isTimeoutError) {
    return {
      category: "slow_network_or_timeout",
      title: "Slow Network or Request Timed Out",
      userMessage:
        params.errorMessage ??
        "The request took too long over the current connection. You can safely retry; idempotency keys prevent duplicate records.",
      canRetrySafely: true,
      requiresReauth: false,
    };
  }

  if (
    params.status === 429 ||
    params.status === 409 ||
    params.errorCode === "CONFLICT" ||
    params.errorCode === "RATE_LIMITED" ||
    params.errorCode === "AI_PROVIDER_RATE_LIMITED" ||
    params.errorCode === "AI_QUOTA_EXCEEDED"
  ) {
    return {
      category: "rate_limited_or_conflict",
      title:
        params.status === 409
          ? "Concurrent Update Detected"
          : "Rate Limit or Quota Reached",
      userMessage:
        params.errorMessage ??
        "This record was updated concurrently or a rate limit was reached. Refresh and try again.",
      canRetrySafely: params.status !== 409,
      requiresReauth: false,
    };
  }

  if (params.status === 400 || params.status === 403 || params.status === 404) {
    return {
      category: "validation_or_permission",
      title: "Action Could Not Be Completed",
      userMessage:
        params.errorMessage ??
        "Please check the form inputs and your organization permissions.",
      canRetrySafely: false,
      requiresReauth: false,
    };
  }

  return {
    category: "server_error",
    title: "Temporary Service Error",
    userMessage:
      params.errorMessage ??
      "A temporary server error occurred. You can safely retry this action.",
    canRetrySafely: true,
    requiresReauth: false,
  };
}

export interface InFlightActionGuard {
  tryAcquire(): boolean;
  release(): void;
  isInFlight(): boolean;
}

/**
 * Synchronous lock preventing double-clicks / rapid multi-taps from triggering
 * concurrent duplicate form submissions before React state updates complete.
 */
export function createInFlightActionGuard(): InFlightActionGuard {
  let locked = false;
  return {
    tryAcquire(): boolean {
      if (locked) {
        return false;
      }
      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
    isInFlight(): boolean {
      return locked;
    },
  };
}

export interface CapturedDeviceLocationPayload {
  status: "captured_unverified" | "permission_denied" | "unavailable";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

/**
 * Captures device location on-demand with explicit user consent via browser Geolocation API.
 * Requests a single, point-in-time fix strictly for visit check-in or check-out telemetry.
 * Continuous background employee tracking is strictly NOT implemented.
 */
export async function captureDeviceLocationWithConsent(): Promise<CapturedDeviceLocationPayload> {
  const nav =
    typeof navigator !== "undefined"
      ? navigator
      : typeof window !== "undefined"
        ? window.navigator
        : undefined;

  if (!nav || !("geolocation" in nav) || !nav.geolocation) {
    return { status: "unavailable" };
  }

  return new Promise<CapturedDeviceLocationPayload>((resolve) => {
    try {
      nav.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            status: "captured_unverified",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve({ status: "permission_denied" });
          } else {
            resolve({ status: "unavailable" });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 10000,
        }
      );
    } catch {
      resolve({ status: "unavailable" });
    }
  });
}
