import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Handler-level access control: every API route must fail safely
 *  - 401 UNAUTHENTICATED for callers without a verified Supabase user, and
 *  - 403 FORBIDDEN_ORG_ACCESS for a signed-in user who is not a member of the target org.
 * The Supabase client is faked at the module boundary so no network/DB is touched; the real
 * route handlers, services, authorization and envelope code run unmodified.
 */

type FakeUser = { id: string; email: string } | null;
const state = vi.hoisted(() => ({
  user: null as FakeUser,
  dbCalls: [] as string[],
  writeCalls: [] as string[],
}));

function chain(result: unknown, label: string): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown) => resolve(result);
      }
      if (["insert", "update", "upsert", "delete"].includes(String(prop))) {
        return (..._args: unknown[]) => {
          state.writeCalls.push(`${label}.${String(prop)}`);
          return new Proxy({}, handler);
        };
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/supabase/server", () => ({
  createUserServerSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : { message: "no session" },
      }),
    },
    // Membership lookups, listings, etc. all resolve to "no rows".
    from: (table: string) => {
      state.dbCalls.push(table);
      return chain({ data: null, error: null }, table);
    },
    rpc: async (fn: string) => {
      state.dbCalls.push(`rpc:${fn}`);
      return { data: true, error: null };
    },
    storage: {
      from: () => {
        state.dbCalls.push("storage");
        return {
          createSignedUploadUrl: async () => ({ data: null, error: { message: "x" } }),
          createSignedUrl: async () => ({ data: null, error: { message: "x" } }),
        };
      },
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

function findRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findRoutes(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

const ID = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";

interface RouteCase {
  rel: string;
  method: (typeof METHODS)[number];
  file: string;
  url: string;
  orgScoped: boolean;
}

const cases: RouteCase[] = findRoutes(API_ROOT)
  .sort()
  .filter((file) => !file.endsWith(`${path.sep}health${path.sep}route.ts`))
  .flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join("/");
    const url = `https://app.example.com/api/${rel
      .replace("[orgId]", ORG)
      .replace("[storeId]", ID)
      .replace("[tripId]", ID)
      .replace("[visitId]", ID)}`;
    return METHODS.filter((m) =>
      new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(source)
    ).map((method) => ({ rel, method, file, url, orgScoped: rel.includes("[orgId]") }));
  });

async function invoke(c: RouteCase): Promise<Response> {
  const mod = (await import(/* @vite-ignore */ c.file)) as Record<
    string,
    (
      req: NextRequest,
      ctx: { params: Promise<Record<string, string>> }
    ) => Promise<Response>
  >;
  const hasBody = c.method !== "GET";
  const request = new NextRequest(c.url, {
    method: c.method,
    headers: { host: "app.example.com", "content-type": "application/json" },
    ...(hasBody ? { body: JSON.stringify({}) } : {}),
  });
  const handler = mod[c.method];
  if (!handler) {
    throw new Error(`Handler for ${c.method} not found in ${c.file}`);
  }
  return handler(request, {
    params: Promise.resolve({ orgId: ORG, storeId: ID, tripId: ID, visitId: ID }),
  });
}

describe("API access control (all route handlers)", () => {
  beforeEach(() => {
    state.user = null;
    state.dbCalls = [];
    state.writeCalls = [];
  });

  it("discovers the route inventory (guards against the walker silently testing nothing)", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(cases.map((c) => c.rel)).size).toBeGreaterThanOrEqual(20);
  });

  it.each(cases.map((c) => [`${c.method} /api/${c.rel}`, c] as const))(
    "%s -> 401 UNAUTHENTICATED with no database access when signed out",
    async (_name, c) => {
      state.user = null;
      const res = await invoke(c);
      const body = (await res.json()) as {
        data: unknown;
        error: { code: string } | null;
      };
      expect(res.status).toBe(401);
      expect(body.data).toBeNull();
      expect(body.error?.code).toBe("UNAUTHENTICATED");
      expect(state.writeCalls).toEqual([]);
      expect(
        state.dbCalls.filter((c2) => !c2.startsWith("rpc:consume_rate_limit"))
      ).toEqual([]);
    }
  );

  it.each(
    cases.filter((c) => c.orgScoped).map((c) => [`${c.method} /api/${c.rel}`, c] as const)
  )(
    "%s -> 403 FORBIDDEN_ORG_ACCESS for a signed-in non-member, with no writes",
    async (_name, c) => {
      state.user = {
        id: "33333333-3333-4333-8333-333333333333",
        email: "outsider@example.com",
      };
      const res = await invoke(c);
      const body = (await res.json()) as {
        data: unknown;
        error: { code: string; message: string } | null;
      };
      expect(res.status).toBe(403);
      expect(body.data).toBeNull();
      expect(body.error?.code).toBe("FORBIDDEN_ORG_ACCESS");
      expect(state.writeCalls).toEqual([]);
      // The error must not reveal whether the org exists or any tenant metadata.
      expect(JSON.stringify(body)).not.toMatch(ORG);
    }
  );
});
