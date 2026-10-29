import { describe, expect, it } from "vitest";
import {
  resolveInvitationOrigin,
  sendOrganizationInvitationEmail,
} from "@/modules/auth/invitation-email";

const invitation = {
  invitationId: "invite-123",
  recipientEmail: "employee@gmail.com",
  organizationName: "Acme Retail",
  role: "field_employee" as const,
  invitationToken: "raw-invite-token",
  expiresAt: "2026-11-01T12:00:00.000Z",
};

describe("Organization invitation email delivery", () => {
  it("reports email as unconfigured instead of pretending an invitation was sent", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response(null, { status: 500 });
    };

    const result = await sendOrganizationInvitationEmail(invitation, {}, fetchImpl);

    expect(result.provider).toBe("unconfigured");
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY");
    expect(called).toBe(false);
  });

  it("sends a one-time role-specific invitation using Resend and the configured application origin", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ id: "email_message_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendOrganizationInvitationEmail(
      invitation,
      {
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "FieldTrack <invites@example.com>",
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
      },
      fetchImpl
    );

    const body = JSON.parse(String(capturedInit?.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    expect(capturedUrl).toBe("https://api.resend.com/emails");
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key"
    );
    expect((capturedInit?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "fieldtrack-invitation-invite-123"
    );
    expect(body.to).toEqual(["employee@gmail.com"]);
    expect(body.subject).toContain("Acme Retail");
    expect(body.html).toContain("Field Employee");
    expect(body.html).toContain(
      "https://app.example.com/signup?invite_token=raw-invite-token"
    );
    expect(body.text).toContain("same email address");
    expect(result).toMatchObject({
      provider: "resend",
      delivered: true,
      messageId: "email_message_123",
      error: null,
    });
  });

  it("uses the validated Vercel deployment URL for Preview invitations", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ id: "preview_email_123" }), { status: 200 });
    };

    const result = await sendOrganizationInvitationEmail(
      invitation,
      {
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "FieldTrack <invites@example.com>",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "saas-startup1-git-fix-rahbar1.vercel.app",
      },
      fetchImpl
    );

    const body = JSON.parse(String(capturedInit?.body)) as { text: string };
    expect(body.text).toContain(
      "https://saas-startup1-git-fix-rahbar1.vercel.app/signup?invite_token=raw-invite-token"
    );
    expect(result.delivered).toBe(true);
  });

  it("uses the explicit canonical URL for Production invitations", () => {
    expect(
      resolveInvitationOrigin({
        VERCEL_ENV: "production",
        VERCEL_URL: "saas-startup1-git-fix-rahbar1.vercel.app",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toEqual({ origin: "https://saas-startup1.vercel.app", error: null });
  });

  it("rejects an untrusted Preview hostname instead of constructing an open redirect", () => {
    expect(
      resolveInvitationOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "attacker.example.com",
        NEXT_PUBLIC_APP_URL: "https://saas-startup1.vercel.app",
      })
    ).toMatchObject({ origin: null });
  });

  it("rejects application URLs that contain paths or credentials", () => {
    expect(
      resolveInvitationOrigin({
        NEXT_PUBLIC_APP_URL: "https://user:password@example.com/injected-path",
      })
    ).toMatchObject({ origin: null });
  });

  it("returns a truthful failed result when Resend rejects a request", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "invalid api key" }), { status: 401 });

    const result = await sendOrganizationInvitationEmail(
      invitation,
      {
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "FieldTrack <invites@example.com>",
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
      },
      fetchImpl
    );

    expect(result.provider).toBe("resend");
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("verify the configured sender domain");
  });

  it("preserves the invitation fallback when Resend is unreachable", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network failure");
    };

    const result = await sendOrganizationInvitationEmail(
      invitation,
      {
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "FieldTrack <invites@example.com>",
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
      },
      fetchImpl
    );

    expect(result.delivered).toBe(false);
    expect(result.error).toContain("invitation exists");
  });
});
