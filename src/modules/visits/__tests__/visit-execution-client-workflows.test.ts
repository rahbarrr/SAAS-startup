import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  captureDeviceLocationWithConsent,
  classifyRequestFailure,
  createInFlightActionGuard,
} from "@/lib/ux/formatting-and-resilience";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from "@/modules/visits/domain";
import {
  checkInStopInputSchema,
  checkOutVisitInputSchema,
  confirmEvidenceUploadInputSchema,
  requestEvidenceUploadTicketInputSchema,
} from "@/modules/visits/schemas";

vi.mock("@/lib/supabase/server", () => ({
  createUserServerSupabaseClient: async () => ({}),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  }),
}));

vi.mock("@/modules/visits/service", () => ({
  getSignedEvidenceDownloadUrlForOrg: async () => ({
    evidenceId: "33333333-3333-4333-8333-333333333333",
    signedDownloadUrl:
      "https://supabase.local/storage/v1/object/sign/visit-evidence/test.jpg?token=secret",
    expiresInSeconds: 120,
  }),
  confirmEvidenceUploadForOrg: vi.fn(),
  requestEvidenceUploadTicketForOrg: vi.fn(),
}));

describe("Phase 3: Visit Execution Client Resilience, Geolocation Consent, and Upload Validation", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe("captureDeviceLocationWithConsent", () => {
    it("returns { status: 'unavailable' } when geolocation is missing from navigator", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });

      const result = await captureDeviceLocationWithConsent();
      expect(result).toEqual({ status: "unavailable" });
    });

    it("returns { status: 'captured_unverified', latitude, longitude, accuracyMeters } on granted consent", async () => {
      const mockCoords = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 6.2,
      };

      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: mockCoords,
            timestamp: Date.now(),
          });
        }),
      };

      Object.defineProperty(globalThis, "navigator", {
        value: { geolocation: mockGeolocation },
        configurable: true,
        writable: true,
      });

      const result = await captureDeviceLocationWithConsent();
      expect(result).toEqual({
        status: "captured_unverified",
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 6.2,
      });
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it("returns { status: 'permission_denied' } when user denies location permission", async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({
            code: 1, // PERMISSION_DENIED
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }),
      };

      Object.defineProperty(globalThis, "navigator", {
        value: { geolocation: mockGeolocation },
        configurable: true,
        writable: true,
      });

      const result = await captureDeviceLocationWithConsent();
      expect(result).toEqual({ status: "permission_denied" });
    });

    it("returns { status: 'unavailable' } on position error or timeout", async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({
            code: 3, // TIMEOUT
            message: "Geolocation timeout",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }),
      };

      Object.defineProperty(globalThis, "navigator", {
        value: { geolocation: mockGeolocation },
        configurable: true,
        writable: true,
      });

      const result = await captureDeviceLocationWithConsent();
      expect(result).toEqual({ status: "unavailable" });
    });
  });

  describe("ActionGuard & In-Flight Concurrency Protection", () => {
    it("locks synchronous operations and allows sequential re-acquisition after release", () => {
      const guard = createInFlightActionGuard();
      expect(guard.isInFlight()).toBe(false);

      expect(guard.tryAcquire()).toBe(true);
      expect(guard.isInFlight()).toBe(true);

      // Concurrent duplicate tap is rejected
      expect(guard.tryAcquire()).toBe(false);

      guard.release();
      expect(guard.isInFlight()).toBe(false);

      // Can acquire again after release
      expect(guard.tryAcquire()).toBe(true);
      guard.release();
    });
  });

  describe("File Size & Type Constraints on Evidence Upload", () => {
    it("validates allowed evidence MIME types (JPEG, PNG, WebP, PDF)", () => {
      for (const mime of ALLOWED_EVIDENCE_MIME_TYPES) {
        const parsed = requestEvidenceUploadTicketInputSchema.safeParse({
          fileType: mime,
          fileSize: 1024,
          originalFileName: `evidence.${mime.split("/")[1]}`,
        });
        expect(parsed.success).toBe(true);
      }
    });

    it("rejects forbidden file types (HTML, SVG, executable)", () => {
      const forbiddenTypes = ["image/svg+xml", "text/html", "application/javascript"];
      for (const mime of forbiddenTypes) {
        const parsed = requestEvidenceUploadTicketInputSchema.safeParse({
          fileType: mime,
          fileSize: 1024,
          originalFileName: "test.file",
        });
        expect(parsed.success).toBe(false);
      }
    });

    it("strictly rejects files exceeding 25 MiB (26,214,400 bytes)", () => {
      const oversized = requestEvidenceUploadTicketInputSchema.safeParse({
        fileType: "image/jpeg",
        fileSize: MAX_EVIDENCE_FILE_SIZE_BYTES + 1,
        originalFileName: "huge.jpg",
      });
      expect(oversized.success).toBe(false);
    });

    it("accepts valid evidence confirmation input with client idempotency key", () => {
      const valid = confirmEvidenceUploadInputSchema.safeParse({
        storagePath:
          "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg",
        fileType: "image/jpeg",
        fileSize: 500_000,
        caption: "Shelf display front view",
        idempotencyKey: "idem-confirm-001",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Check-in & Check-out Input Schemas with Idempotency and Location", () => {
    it("accepts valid check-in with location and client idempotency key", () => {
      const parsed = checkInStopInputSchema.safeParse({
        tripStopId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "idem-checkin-key-001",
        location: {
          status: "captured_unverified",
          latitude: 41.8781,
          longitude: -87.6298,
          accuracyMeters: 10.5,
        },
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts check-in with permission_denied and no coordinates", () => {
      const parsed = checkInStopInputSchema.safeParse({
        tripStopId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "idem-checkin-key-002",
        location: {
          status: "permission_denied",
        },
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects captured_unverified location when coordinates are omitted", () => {
      const parsed = checkInStopInputSchema.safeParse({
        tripStopId: "11111111-1111-4111-8111-111111111111",
        location: {
          status: "captured_unverified",
        },
      });
      expect(parsed.success).toBe(false);
    });

    it("accepts checkout with notes, idempotencyKey, and location", () => {
      const parsed = checkOutVisitInputSchema.safeParse({
        notes: "Restocked promotional display in aisle 4",
        idempotencyKey: "idem-checkout-key-001",
        location: {
          status: "captured_unverified",
          latitude: 41.8781,
          longitude: -87.6298,
          accuracyMeters: 8,
        },
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("Failure Classification for User Feedback", () => {
    it("classifies expired session 401 with reauth requirement", () => {
      const failure = classifyRequestFailure({
        status: 401,
        errorCode: "UNAUTHENTICATED",
      });
      expect(failure.category).toBe("expired_session");
      expect(failure.requiresReauth).toBe(true);
      expect(failure.canRetrySafely).toBe(false);
    });

    it("classifies network timeouts with safe retry recommendation", () => {
      const failure = classifyRequestFailure({
        status: 504,
        networkError: new Error("fetch timeout"),
      });
      expect(failure.category).toBe("slow_network_or_timeout");
      expect(failure.canRetrySafely).toBe(true);
      expect(failure.requiresReauth).toBe(false);
    });

    it("classifies 409 conflict and informs about concurrent updates", () => {
      const failure = classifyRequestFailure({
        status: 409,
        errorCode: "CONFLICT",
        errorMessage: "Duplicate check-in prevented",
      });
      expect(failure.category).toBe("rate_limited_or_conflict");
      expect(failure.canRetrySafely).toBe(false);
    });
  });

  describe("Evidence Route Download Redirect Behavior", () => {
    it("handles download=true with 307 redirect vs standard json response", async () => {
      const { GET } =
        await import("@/app/api/orgs/[orgId]/visits/[visitId]/evidence/route");

      const orgId = "11111111-1111-4111-8111-111111111111";
      const visitId = "22222222-2222-4222-8222-222222222222";
      const evidenceId = "33333333-3333-4333-8333-333333333333";

      // 1. When download=true, returns 307 redirect directly to the signed Supabase Storage URL
      const redirectReq = new NextRequest(
        `https://app.example.com/api/orgs/${orgId}/visits/${visitId}/evidence?evidenceId=${evidenceId}&download=true`
      );
      const redirectRes = await GET(redirectReq, {
        params: Promise.resolve({ orgId, visitId }),
      });
      expect(redirectRes.status).toBe(307);
      expect(redirectRes.headers.get("location")).toBe(
        "https://supabase.local/storage/v1/object/sign/visit-evidence/test.jpg?token=secret"
      );

      // 2. When without download=true, returns 200 JSON payload for programmatic clients
      const jsonReq = new NextRequest(
        `https://app.example.com/api/orgs/${orgId}/visits/${visitId}/evidence?evidenceId=${evidenceId}`
      );
      const jsonRes = await GET(jsonReq, {
        params: Promise.resolve({ orgId, visitId }),
      });
      expect(jsonRes.status).toBe(200);
      const body = (await jsonRes.json()) as {
        data: { signedDownloadUrl: string; expiresInSeconds: number };
      };
      expect(body.data.signedDownloadUrl).toContain("visit-evidence/test.jpg");
      expect(body.data.expiresInSeconds).toBe(120);
    });
  });
});
