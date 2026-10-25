/**
 * Structured JSON logging with request/correlation IDs and conservative redaction.
 * Never log raw request bodies, notes, coordinates, emails or tokens. Prefer IDs.
 */

const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|api[-_]?key|apikey|service[-_]?role|jwt|session|email|phone|full[-_]?name|note|notes|caption|summary|lat|lng|latitude|longitude|accuracy|address|location|body|prompt|storage[-_]?path|signed[-_]?url)/i;

/** Credentials and tokens. Anything matching these must never reach logs or end users. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"]+/gi, // DB/connection URLs (may embed passwords)
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, // JWT
  /\bsb_secret_[A-Za-z0-9_-]{8,}/g, // Supabase secret keys
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, // Authorization header values
  /\b[0-9a-f]{64}\b/gi, // token hashes / hex secrets
  /\bsk-[A-Za-z0-9_-]{16,}\b/g, // OpenAI-style keys
];

/** Personal data that is redacted from logs but is legitimate in some user-facing messages. */
const PII_VALUE_PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // email addresses
];

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  ...SECRET_VALUE_PATTERNS,
  ...PII_VALUE_PATTERNS,
];

export type LogLevel = "debug" | "info" | "warn" | "error";

/** True when the text contains a credential/token (emails alone do not count). */
export function containsSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) =>
    new RegExp(pattern.source, pattern.flags.replace("g", "")).test(value)
  );
}

export function redactString(value: string): string {
  let out = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out.length > 500 ? `${out.slice(0, 500)}…` : out;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return REDACTED;
  if (Array.isArray(value))
    return value.slice(0, 20).map((v) => redactValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

export function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: redactString(error.message) };
  }
  return { name: "NonError", message: REDACTED };
}

export function buildLogLine(params: {
  level: LogLevel;
  event: string;
  requestId?: string | null;
  fields?: Record<string, unknown>;
  now?: Date;
}): string {
  return JSON.stringify({
    ts: (params.now ?? new Date()).toISOString(),
    level: params.level,
    event: params.event,
    requestId: params.requestId ?? null,
    ...(params.fields ? (redactValue(params.fields) as Record<string, unknown>) : {}),
  });
}

export function log(
  level: LogLevel,
  event: string,
  fields?: Record<string, unknown>,
  requestId?: string | null
): void {
  const line = buildLogLine({ level, event, requestId, fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Accepts a well-formed inbound request id, otherwise generates a fresh one. */
export function resolveRequestId(inbound: string | null | undefined): string {
  if (inbound && REQUEST_ID_PATTERN.test(inbound)) return inbound;
  return crypto.randomUUID();
}
