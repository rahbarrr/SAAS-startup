import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as healthGet } from "../health/route";
import { POST as digestPost } from "../orgs/[orgId]/digest/route";

vi.mock("@/lib/supabase/server", () => ({
  createUserServerSupabaseClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: "mock-org" }], error: null }),
      }),
    }),
  })),
  createAdminServerSupabaseClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: "mock-org" }], error: null }),
      }),
    }),
  })),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/modules/notifications/digest", () => ({
  generateAndDispatchDailyManagerDigestForOrg: vi.fn().mockResolvedValue({
    orgId: "org-1",
    digestDate: "2026-10-25",
    summary: {
      pendingApprovalsCount: 0,
      overdueVisitsCount: 0,
      completedVisitsCount: 0,
      operationalExceptionsCount: 0,
    },
    recipientsDispatched: [],
  }),
}));

describe("Phase 6: Production Security, Cron Authentication, and Health Probes", () => {
  it("operational /api/health probe returns 200 with service status and zero leaked secrets", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);

    const data = await response.json() as Record<string, unknown>;
    expect(data.status).toBe("healthy");
    expect(data.environment).toBeDefined();
    expect(data.services).toBeDefined();

    const services = data.services as Record<string, { configured?: boolean; status?: string; provider?: string }>;
    expect(services.database?.status).toBe("connected");
    expect(services.routing?.provider).toBeDefined();
    expect(typeof services.pushNotifications?.configured).toBe("boolean");
    expect(typeof services.schedulerAuth?.configured).toBe("boolean");

    const jsonString = JSON.stringify(data);
    expect(jsonString).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(jsonString).not.toContain("CRON_SECRET");
    expect(jsonString).not.toContain("VAPID_PRIVATE_KEY");
    expect(jsonString).not.toContain("OPENAI_API_KEY");
  });

  it("rejects unauthorized public requests to /api/orgs/[orgId]/digest with 401", async () => {
    const request = new NextRequest("http://localhost:3000/api/orgs/org-1/digest", {
      method: "POST",
    });

    const response = await digestPost(request, {
      params: Promise.resolve({ orgId: "org-1" }),
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: { message: string } };
    expect(body.error?.message).toMatch(/authenticat/i);
  });

  it("rejects invalid scheduler secret requests with 401", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "super-secret-cron-token";

    try {
      const request = new NextRequest("http://localhost:3000/api/orgs/org-1/digest", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-token",
        },
      });

      const response = await digestPost(request, {
        params: Promise.resolve({ orgId: "org-1" }),
      });

      expect(response.status).toBe(401);
      const body = await response.json() as { error?: { message: string } };
      expect(body.error?.message).toMatch(/invalid.*scheduler.*secret/i);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it("authenticates valid scheduler call via Bearer CRON_SECRET or x-cron-secret", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "production-cron-secret-12345";

    try {
      // 1. Authorization: Bearer <secret>
      const bearerReq = new NextRequest("http://localhost:3000/api/orgs/org-1/digest", {
        method: "POST",
        headers: {
          authorization: "Bearer production-cron-secret-12345",
        },
      });

      const bearerRes = await digestPost(bearerReq, {
        params: Promise.resolve({ orgId: "org-1" }),
      });

      expect(bearerRes.status).toBe(200);
      const bearerData = await bearerRes.json() as { data?: { orgId: string } };
      expect(bearerData.data?.orgId).toBe("org-1");

      // 2. x-cron-secret header
      const headerReq = new NextRequest("http://localhost:3000/api/orgs/org-1/digest", {
        method: "POST",
        headers: {
          "x-cron-secret": "production-cron-secret-12345",
        },
      });

      const headerRes = await digestPost(headerReq, {
        params: Promise.resolve({ orgId: "org-1" }),
      });

      expect(headerRes.status).toBe(200);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });
});
