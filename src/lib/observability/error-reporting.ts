import { log, serializeError } from "./logger";

/**
 * Error monitoring abstraction. NO external provider is connected by default.
 *
 * To enable Sentry (or equivalent) the owner must create the account/project, provide a DSN
 * as a server secret, and register a reporter at startup via `setErrorReporter(...)`.
 * Until then, errors are emitted ONLY as redacted structured log lines.
 */
export type ErrorReporter = (error: unknown, context: Record<string, unknown>) => void;

let reporter: ErrorReporter | null = null;

export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function isErrorReporterConnected(): boolean {
  return reporter !== null;
}

export function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
  requestId?: string | null
): void {
  log(
    "error",
    "unhandled_error",
    { error: serializeError(error), ...context },
    requestId
  );
  if (reporter) {
    try {
      reporter(error, context);
    } catch {
      log("warn", "error_reporter_failed", {}, requestId);
    }
  }
}
