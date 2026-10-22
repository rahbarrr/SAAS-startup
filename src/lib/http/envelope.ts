import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { captureException } from "@/lib/observability/error-reporting";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "AUTH_INVALID_CREDENTIALS"
  | "FORBIDDEN_ORG_ACCESS"
  | "FORBIDDEN_INSUFFICIENT_ROLE"
  | "FORBIDDEN_RESOURCE_ACCESS"
  | "UNAUTHORIZED_SOURCE_RECORD"
  | "MEMBERSHIP_INACTIVE"
  | "INVITATION_INVALID"
  | "INVITATION_EXPIRED"
  | "INVITATION_EMAIL_MISMATCH"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_FEATURE_NOT_CONFIGURED"
  | "AI_FEATURE_DISABLED_FOR_ORG"
  | "AI_QUOTA_EXCEEDED"
  | "AI_COST_LIMIT_EXCEEDED"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_ERROR"
  | "AI_MALFORMED_OUTPUT"
  | "AI_POLICY_VIOLATION"
  | "INTERNAL_ERROR";

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ApiMeta {
  requestId?: string;
  pagination?: CursorPaginationMeta;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiErrorPayload | null;
  meta: ApiMeta;
}

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export interface CursorPayload {
  createdAt: string;
  id: string;
}

const cursorPayloadSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    return cursorPayloadSchema.parse(parsed);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
  }
}

export function buildSuccessEnvelope<T>(data: T, meta: ApiMeta = {}): ApiEnvelope<T> {
  return {
    data,
    error: null,
    meta,
  };
}

const SENSITIVE_PATTERN =
  /\b(select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|row-level security|sqlstate|pgrst\d+|eyJ[A-Za-z0-9_-]{10,}|[0-9a-f]{64}|supabase_service_role_key)\b/i;

/**
 * Redacts any accidental SQL fragments, JWTs, or 64-char token hashes from user-facing messages.
 */
export function sanitizeErrorMessage(
  message: string,
  fallback = "The request could not be completed. Please check your input and try again."
): string {
  const trimmed = message.trim();
  if (!trimmed || SENSITIVE_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function buildErrorEnvelope(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  meta: ApiMeta = {}
): ApiEnvelope<null> {
  return {
    data: null,
    error: {
      code,
      message: sanitizeErrorMessage(message),
      ...(details !== undefined ? { details } : {}),
    },
    meta,
  };
}

export function jsonSuccess<T>(
  data: T,
  status = 200,
  meta: ApiMeta = {}
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(buildSuccessEnvelope(data, meta), { status });
}

export function jsonError(
  error: unknown,
  meta: ApiMeta = {}
): NextResponse<ApiEnvelope<null>> {
  if (error instanceof AppError) {
    return NextResponse.json(
      buildErrorEnvelope(error.code, error.message, error.details, meta),
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      buildErrorEnvelope(
        "VALIDATION_ERROR",
        "Request validation failed",
        error.flatten(),
        meta
      ),
      { status: 400 }
    );
  }

  captureException(error, { source: "jsonError" });
  return NextResponse.json(
    buildErrorEnvelope("INTERNAL_ERROR", "An unexpected error occurred", undefined, meta),
    { status: 500 }
  );
}

/**
 * Strips characters that carry meaning inside PostgREST `.or()` filter strings
 * (`,` `(` `)` `"` `\` `:` `*`) and LIKE wildcards, so user search text can never
 * inject additional filter conditions.
 */
export function sanitizePostgrestSearchTerm(raw: string): string {
  return raw.replace(/[%_,()"'\\:*]/g, "").trim();
}

/**
 * CSRF defence-in-depth for cookie-authenticated API mutations: when a browser sends an
 * `Origin` header on a state-changing request it must match the request host.
 */
export function isSameOriginMutation(params: {
  method: string;
  originHeader: string | null;
  host: string | null;
}): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(params.method.toUpperCase())) {
    return true;
  }
  if (!params.originHeader) {
    return true; // non-browser clients (no Origin) rely on bearer/cookie SameSite protections
  }
  try {
    return new URL(params.originHeader).host === params.host;
  } catch {
    return false;
  }
}
