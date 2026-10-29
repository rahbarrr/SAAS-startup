import { describe, expect, it } from "vitest";
import { buildErrorEnvelope, sanitizeErrorMessage } from "@/lib/http/envelope";
import { isAuthPublicRoute, isProtectedPath } from "@/lib/supabase/middleware";
import {
  type PasswordRecoveryInput,
  type PasswordUpdateInput,
  type PublicSignUpInput,
  sanitizeRedirectPath,
  type SignInInput,
} from "@/modules/auth/schemas";
import {
  type AuthProvider,
  requestPasswordRecoveryForCaller,
  signInCaller,
  signUpPublicCaller,
  updatePasswordForCaller,
} from "@/modules/auth/service";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";

class FakeAuthProvider implements AuthProvider {
  public registeredUsers: { email: string; fullName: string }[] = [];
  public recoveryRequests: { email: string; redirectToUrl: string }[] = [];
  public updatedPasswords: string[] = [];

  async signInWithPassword(input: SignInInput): Promise<AuthenticatedUser> {
    if (input.password !== "correct-horse-battery") {
      const { AppError } = await import("@/lib/http/envelope");
      throw new AppError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password. Please check your credentials and try again.",
        401
      );
    }
    return {
      id: "10000000-0000-4000-8000-000000000001",
      email: input.email,
    };
  }

  async signUpWithPassword(
    input: PublicSignUpInput
  ): Promise<{ user: AuthenticatedUser; requiresEmailConfirmation: boolean }> {
    this.registeredUsers.push({
      email: input.email,
      fullName: input.fullName,
    });
    return {
      user: {
        id: "10000000-0000-4000-8000-000000000099",
        email: input.email,
      },
      requiresEmailConfirmation: false,
    };
  }

  async signOut(): Promise<void> {
    return;
  }

  async sendPasswordRecoveryEmail(
    input: PasswordRecoveryInput,
    redirectToUrl: string
  ): Promise<void> {
    this.recoveryRequests.push({ email: input.email, redirectToUrl });
  }

  async updatePassword(input: PasswordUpdateInput): Promise<void> {
    this.updatedPasswords.push(input.password);
  }
}

describe("Authentication, public sign-up protection, and error sanitization", () => {
  it("prevents public sign-up requests from setting orgId, organizationId, or role (DENIED)", async () => {
    const authProvider = new FakeAuthProvider();

    await expect(
      signUpPublicCaller({
        rawInput: {
          email: "attacker@example.com",
          password: "strong-password-123",
          fullName: "Attacker User",
          organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          role: "admin",
        },
        authProvider,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    expect(authProvider.registeredUsers).toHaveLength(0);
  });

  it("allows valid public sign-up with only email, password, and fullName (ALLOWED)", async () => {
    const authProvider = new FakeAuthProvider();

    const result = await signUpPublicCaller({
      rawInput: {
        email: "New.Employee@Example.com",
        password: "strong-password-123",
        fullName: "New Employee",
      },
      authProvider,
    });

    expect(result.user.email).toBe("new.employee@example.com");
    expect(authProvider.registeredUsers).toEqual([
      { email: "new.employee@example.com", fullName: "New Employee" },
    ]);
  });

  it("validates credentials on sign-in and denies invalid passwords with friendly message", async () => {
    const authProvider = new FakeAuthProvider();

    const signedIn = await signInCaller({
      rawInput: {
        email: "alice@example.com",
        password: "correct-horse-battery",
      },
      authProvider,
    });
    expect(signedIn.email).toBe("alice@example.com");

    await expect(
      signInCaller({
        rawInput: {
          email: "alice@example.com",
          password: "wrong-password",
        },
        authProvider,
      })
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
      status: 401,
    });
  });

  it("enforces authentication for password updates and returns uniform recovery messages", async () => {
    const authProvider = new FakeAuthProvider();

    // Unauthenticated password update is denied
    await expect(
      updatePasswordForCaller({
        user: null,
        rawInput: { password: "new-password-12345" },
        authProvider,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    // Authenticated password update succeeds
    const updateRes = await updatePasswordForCaller({
      user: {
        id: "10000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      },
      rawInput: { password: "new-password-12345" },
      authProvider,
    });
    expect(updateRes.message).toContain("updated");

    // Password recovery returns uniform message without leaking account existence
    const recoveryRes = await requestPasswordRecoveryForCaller({
      rawInput: { email: "nonexistent@example.com" },
      redirectToUrl: "http://localhost:3000/auth/callback?next=/reset-password",
      trustedOrigin: "http://localhost:3000",
      authProvider,
    });
    expect(recoveryRes.message).toContain("If an account exists");
  });

  it("classifies protected vs public auth paths and blocks open redirects", () => {
    expect(isProtectedPath("/trips")).toBe(true);
    expect(isProtectedPath("/visits/123")).toBe(true);
    expect(isProtectedPath("/approvals")).toBe(true);
    expect(isProtectedPath("/team")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);

    expect(isAuthPublicRoute("/login")).toBe(true);
    expect(isAuthPublicRoute("/signup")).toBe(true);
    expect(isAuthPublicRoute("/forgot-password")).toBe(true);

    // Sanitizes open redirect attempts
    expect(sanitizeRedirectPath("/trips")).toBe("/trips");
    expect(sanitizeRedirectPath("https://evil.example.com")).toBe("/");
    expect(sanitizeRedirectPath("//evil.example.com")).toBe("/");
    expect(sanitizeRedirectPath("/\\evil.example.com")).toBe("/");
    expect(sanitizeRedirectPath("/onboarding?token=invite-token")).toBe(
      "/onboarding?token=invite-token"
    );
  });

  it("redacts SQL queries, RLS policy strings, JWT tokens, and 64-char token hashes from user-facing error envelopes", () => {
    const fallback =
      "The request could not be completed. Please check your input and try again.";

    expect(
      sanitizeErrorMessage("new row violates row-level security policy for table stores")
    ).toBe(fallback);
    expect(
      sanitizeErrorMessage(
        "SELECT id FROM public.organization_members WHERE user_id = $1"
      )
    ).toBe(fallback);
    expect(
      sanitizeErrorMessage(`Invalid token hash ${"f".repeat(64)} in invitation lookup`)
    ).toBe(fallback);

    const safeEnvelope = buildErrorEnvelope(
      "INTERNAL_ERROR",
      "SQLSTATE 42501: permission denied"
    );
    expect(safeEnvelope.error?.message).toBe(fallback);
    expect(safeEnvelope.error?.message).not.toContain("SQLSTATE");
  });
});
