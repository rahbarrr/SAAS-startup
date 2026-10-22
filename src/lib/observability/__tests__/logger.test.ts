import { describe, expect, it, vi } from "vitest";
import {
  captureException,
  setErrorReporter,
  isErrorReporterConnected,
} from "../error-reporting";
import { buildLogLine, redactString, redactValue, resolveRequestId } from "../logger";

describe("structured logging & redaction", () => {
  it("redacts tokens, emails, notes, coordinates and secrets by key and by value", () => {
    const line = buildLogLine({
      level: "info",
      event: "visit_checkout",
      requestId: "req-12345678",
      fields: {
        visitId: "70000000-0000-4000-8000-000000000001",
        notes: "customer was rude about pricing",
        check_in_lat: 41.88,
        checkInLng: -87.63,
        authorization: "Bearer abc",
        nested: { email: "a@b.com", ok: "fine" },
        message:
          "failed for user fiona@example.com with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij",
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.requestId).toBe("req-12345678");
    expect(parsed.visitId).toBe("70000000-0000-4000-8000-000000000001");
    expect(parsed.notes).toBe("[REDACTED]");
    expect(parsed.check_in_lat).toBe("[REDACTED]");
    expect(parsed.checkInLng).toBe("[REDACTED]");
    expect(parsed.authorization).toBe("[REDACTED]");
    expect((parsed.nested as Record<string, unknown>).email).toBe("[REDACTED]");
    expect(line).not.toContain("fiona@example.com");
    expect(line).not.toContain("eyJhbGci");
    expect(line).not.toContain("rude");
  });

  it("redacts OpenAI-style keys and long hex secrets in free text", () => {
    expect(redactString("key sk-abcdefghijklmnopqrstuvwxyz1234 failed")).not.toContain(
      "sk-abc"
    );
    expect(redactString("hash " + "a".repeat(64))).toContain("[REDACTED]");
    expect(redactValue({ a: [1, "x@y.io"] })).toEqual({ a: [1, "[REDACTED]"] });
  });

  it("accepts well-formed inbound request ids and replaces malformed ones", () => {
    expect(resolveRequestId("abcd-1234-efgh")).toBe("abcd-1234-efgh");
    expect(resolveRequestId("bad id\nwith newline")).not.toContain("\n");
    expect(resolveRequestId(null)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reports errors only to a registered reporter and never crashes when it throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(isErrorReporterConnected()).toBe(false);
    captureException(new Error("boom for a@b.com"), { a: 1 }, "req-12345678");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("a@b.com");

    const reporter = vi.fn(() => {
      throw new Error("sdk down");
    });
    setErrorReporter(reporter);
    expect(() => captureException(new Error("x"))).not.toThrow();
    expect(reporter).toHaveBeenCalledOnce();
    setErrorReporter(null);
  });
});
