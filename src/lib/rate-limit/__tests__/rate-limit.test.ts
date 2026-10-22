import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/http/envelope";
import { clientIpFromHeaders, enforceRateLimit } from "../index";

function fakeSupabase(result: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return result;
      },
    } as never,
  };
}

describe("enforceRateLimit", () => {
  it("allows when the RPC says allowed", async () => {
    const f = fakeSupabase({ data: true, error: null });
    await expect(
      enforceRateLimit({ supabase: f.client, scope: "ai_draft", subject: "u1" })
    ).resolves.toBeUndefined();
    expect(f.calls).toHaveLength(1);
  });

  it("throws RATE_LIMITED (429) when exceeded", async () => {
    const f = fakeSupabase({ data: false, error: null });
    await expect(
      enforceRateLimit({ supabase: f.client, scope: "auth_sign_in", subject: "ip:1" })
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("fails closed when the limiter errors", async () => {
    const f = fakeSupabase({ data: null, error: { message: "db down" } });
    const err = await enforceRateLimit({
      supabase: f.client,
      scope: "upload",
      subject: "u1",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(429);
  });

  it("truncates oversized subjects and extracts the first forwarded IP", async () => {
    const f = fakeSupabase({ data: true, error: null });
    await enforceRateLimit({
      supabase: f.client,
      scope: "upload",
      subject: "x".repeat(1000),
    });
    expect((f.calls[0] as { args: { p_subject: string } }).args.p_subject.length).toBe(
      256
    );
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.5");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
