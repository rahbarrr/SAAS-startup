import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldTrackMobileApiClient } from "../services/api";
import {
  MobileAuthService,
  normalizeApiBaseUrl,
  normalizeOrganizationMemberships,
  resolveDefaultApiBaseUrl,
} from "../services/auth";

let store: Record<string, string> = {};

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: vi.fn((key: string, val: string) => {
    store[key] = val;
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
}));

describe("FieldTrack Mobile Auth & Trip Loading Workflow", () => {
  beforeEach(async () => {
    store = {};
    MobileAuthService.resetMemoryCache();
    await MobileAuthService.clearSession();
    vi.restoreAllMocks();
  });

  it("derives LAN API base URL from Metro scriptURL or explicit env var", () => {
    expect(
      resolveDefaultApiBaseUrl({
        envBaseUrl: "",
        metroScriptUrl:
          "http://192.168.43.142:8081/index.bundle?platform=android&dev=true",
      })
    ).toBe("http://192.168.43.142:3000");

    expect(
      resolveDefaultApiBaseUrl({
        envBaseUrl: "https://fieldtrack-preview.vercel.app/",
        metroScriptUrl: "http://192.168.43.142:8081/index.bundle",
      })
    ).toBe("https://fieldtrack-preview.vercel.app");

    expect(
      resolveDefaultApiBaseUrl({
        envBaseUrl: "",
        metroScriptUrl: "http://localhost:8081/index.bundle",
      })
    ).toBe("http://localhost:3000");

    expect(normalizeApiBaseUrl(" http://192.168.43.142:3000/ ")).toBe(
      "http://192.168.43.142:3000"
    );
    expect(() => normalizeApiBaseUrl("invalid-url")).toThrow(
      /Server URL must start with http:\/\/ or https:\/\//
    );
  });

  it("signs in via POST /api/auth/login, persists session in SecureStore, and survives cold restart", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          accessToken: "jwt_mobile_token_123",
          refreshToken: "refresh_123",
          expiresAt: 1999999999,
          user: {
            id: "emp-1",
            email: "rahul@fieldtrack.io",
          },
          organizations: [
            {
              organization: {
                id: "org-1",
                name: "Apex Retail Corp",
                slug: "apex-retail",
                status: "active",
              },
              membership: {
                id: "mem-1",
                orgId: "org-1",
                userId: "emp-1",
                role: "field_employee",
                status: "active",
              },
            },
          ],
        },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const session = await MobileAuthService.signInWithPassword({
      baseUrl: "http://192.168.43.142:3000/",
      email: "rahul@fieldtrack.io",
      password: "Password123!",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.43.142:3000/api/auth/login",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(session.accessToken).toBe("jwt_mobile_token_123");
    expect(session.user.email).toBe("rahul@fieldtrack.io");
    expect(session.activeOrgId).toBe("org-1");

    // Simulate cold restart
    MobileAuthService.resetMemoryCache();
    const restored = await MobileAuthService.getSavedSession();
    expect(restored?.accessToken).toBe("jwt_mobile_token_123");
    expect(restored?.activeOrgId).toBe("org-1");

    await MobileAuthService.updateActiveSelection({ activeTripId: "trip-99" });
    MobileAuthService.resetMemoryCache();
    expect((await MobileAuthService.getSavedSession())?.activeTripId).toBe(
      "trip-99"
    );

    await MobileAuthService.clearSession();
    expect(await MobileAuthService.getSavedSession()).toBeNull();
  });

  it("surfaces real authentication and network errors without faking sign-in", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        data: null,
        error: {
          code: "AUTH_INVALID_CREDENTIALS",
          message:
            "Invalid email or password. Please check your credentials and try again.",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      MobileAuthService.signInWithPassword({
        baseUrl: "http://192.168.43.142:3000",
        email: "rahul@fieldtrack.io",
        password: "wrong",
      })
    ).rejects.toThrow(/Invalid email or password/);

    expect(await MobileAuthService.getSavedSession()).toBeNull();
  });

  it("loads authorized trips and hydrates trip stops with store coordinates", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/orgs/org-1/trips?")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "trip-1",
                orgId: "org-1",
                ownerUserId: "emp-1",
                title: "Mumbai Retail Audit",
                startDate: "2026-10-28",
                endDate: "2026-10-29",
                purpose: "Monthly store merchandising audit",
                status: "approved",
              },
            ],
            error: null,
          }),
        };
      }
      if (url.endsWith("/api/orgs/org-1/trips/trip-1")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              trip: {
                id: "trip-1",
                orgId: "org-1",
                ownerUserId: "emp-1",
                title: "Mumbai Retail Audit",
                startDate: "2026-10-28",
                endDate: "2026-10-29",
                purpose: "Monthly store merchandising audit",
                status: "approved",
              },
              stops: [
                {
                  id: "stop-2",
                  storeId: "store-b",
                  sequenceNumber: 2,
                  status: "planned",
                },
                {
                  id: "stop-1",
                  storeId: "store-a",
                  sequenceNumber: 1,
                  status: "planned",
                },
              ],
            },
            error: null,
          }),
        };
      }
      if (url.includes("/api/orgs/org-1/stores")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "store-a",
                name: "Store A — Bandra",
                addressLine1: "10 Linking Rd",
                city: "Mumbai",
                latitude: 19.0596,
                longitude: 72.8295,
              },
              {
                id: "store-b",
                name: "Store B — Andheri",
                addressLine1: "42 SV Rd",
                city: "Mumbai",
                latitude: 19.1136,
                longitude: 72.8697,
              },
            ],
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const apiClient = new FieldTrackMobileApiClient({
      baseUrl: "http://192.168.43.142:3000",
      authToken: "jwt_mobile_token_123",
      orgId: "org-1",
    });

    const summaries = await apiClient.listTrips({ ownerUserId: "emp-1" });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.title).toBe("Mumbai Retail Audit");

    const executableTrip = await apiClient.getExecutableTrip("trip-1");
    expect(executableTrip.id).toBe("trip-1");
    expect(executableTrip.stops).toHaveLength(2);
    // Sorted by sequenceNumber ascending
    expect(executableTrip.stops[0]?.id).toBe("stop-1");
    expect(executableTrip.stops[0]?.storeName).toBe("Store A — Bandra");
    expect(executableTrip.stops[0]?.latitude).toBe(19.0596);
    expect(executableTrip.stops[0]?.longitude).toBe(72.8295);
    expect(executableTrip.stops[1]?.id).toBe("stop-2");
    expect(executableTrip.stops[1]?.storeName).toBe("Store B — Andheri");
  });

  it("normalizes nested UserOrganizationSummary payloads and refreshes workspaces via GET /api/orgs", async () => {
    const nestedPayload = [
      {
        organization: {
          id: "org-nested-1",
          name: "Metro Field Ops",
          slug: "metro-field-ops",
          status: "active",
        },
        membership: {
          id: "mem-nested-1",
          orgId: "org-nested-1",
          userId: "emp-1",
          role: "admin",
          status: "active",
        },
      },
      {
        organization: {
          id: "org-suspended",
          name: "Suspended Org",
          slug: "suspended-org",
          status: "suspended",
        },
        membership: {
          id: "mem-2",
          orgId: "org-suspended",
          userId: "emp-1",
          role: "admin",
          status: "active",
        },
      },
      {
        organization: {
          id: "org-deactivated-member",
          name: "Active Org",
          slug: "active-org",
          status: "active",
        },
        membership: {
          id: "mem-3",
          orgId: "org-deactivated-member",
          userId: "emp-1",
          role: "field_employee",
          status: "deactivated",
        },
      },
    ];

    const normalized = normalizeOrganizationMemberships(nestedPayload);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.organization.id).toBe("org-nested-1");
    expect(normalized[0]?.role).toBe("admin");
    expect(normalized[0]?.status).toBe("active");

    // Save a session with 0 organizations and verify refreshOrganizations self-heals it
    await MobileAuthService.saveSession({
      baseUrl: "http://192.168.43.142:3000",
      accessToken: "jwt_mobile_token_123",
      user: { id: "emp-1", email: "rahul@fieldtrack.io" },
      organizations: [],
      activeOrgId: null,
      activeTripId: null,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: nestedPayload,
          error: null,
        }),
      })
    );

    const refreshed = await MobileAuthService.refreshOrganizations();
    expect(refreshed?.organizations).toHaveLength(1);
    expect(refreshed?.activeOrgId).toBe("org-nested-1");
  });
});
