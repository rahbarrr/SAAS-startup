import "server-only";

export type InvitationEmailProvider = "unconfigured" | "resend";

export interface InvitationEmailResult {
  provider: InvitationEmailProvider;
  delivered: boolean;
  messageId: string | null;
  error: string | null;
  attemptedAt: string;
}

export interface OrganizationInvitationEmailInput {
  invitationId: string;
  recipientEmail: string;
  organizationName: string;
  role: "manager" | "field_employee";
  invitationToken: string;
  expiresAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unconfiguredResult(error: string, attemptedAt: string): InvitationEmailResult {
  return {
    provider: "unconfigured",
    delivered: false,
    messageId: null,
    error,
    attemptedAt,
  };
}

/**
 * Sends a one-time workspace invitation using Resend. Invitation records are persisted
 * before email delivery; a provider failure is returned honestly so the admin can copy
 * the fallback link without the database transaction being lost.
 */
export async function sendOrganizationInvitationEmail(
  input: OrganizationInvitationEmailInput,
  envSource: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<InvitationEmailResult> {
  const attemptedAt = new Date().toISOString();
  const apiKey = envSource.RESEND_API_KEY?.trim();
  const from = envSource.RESEND_FROM_EMAIL?.trim();
  const appUrlValue = envSource.NEXT_PUBLIC_APP_URL?.trim();

  if (!apiKey || !from || !appUrlValue) {
    return unconfiguredResult(
      "Automatic email is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and NEXT_PUBLIC_APP_URL.",
      attemptedAt
    );
  }

  let appOrigin: string;
  try {
    const appUrl = new URL(appUrlValue);
    if (
      (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") ||
      appUrl.username ||
      appUrl.password
    ) {
      return unconfiguredResult(
        "NEXT_PUBLIC_APP_URL must be a trusted HTTP or HTTPS application URL.",
        attemptedAt
      );
    }
    appOrigin = appUrl.origin;
  } catch {
    return unconfiguredResult(
      "NEXT_PUBLIC_APP_URL must be a valid application URL.",
      attemptedAt
    );
  }

  const inviteUrl = new URL("/signup", appOrigin);
  inviteUrl.searchParams.set("invite_token", input.invitationToken);
  const company = input.organizationName.replace(/[\r\n]+/g, " ").trim();
  const roleLabel = input.role === "manager" ? "Manager" : "Field Employee";
  const expiresLabel = new Date(input.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const safeCompany = escapeHtml(company);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(inviteUrl.toString());
  const subject = `You're invited to ${company} on FieldTrack`;
  const text = [
    `You've been invited to join ${company} on FieldTrack.`,
    `Assigned role: ${roleLabel}`,
    `Invitation expires at (UTC): ${expiresLabel}`,
    "",
    "Accept your invitation and sign in with the same email address the invitation was sent to:",
    inviteUrl.toString(),
    "",
    "If you weren't expecting this invitation, you can ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <section style="background:#fff;border:1px solid #e5e9f2;border-radius:14px;padding:28px;">
        <p style="margin:0 0 8px;color:#1b3580;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">FieldTrack</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">You're invited to join ${safeCompany}</h1>
        <p style="margin:0 0 12px;line-height:1.6;">Your workspace administrator invited you as a <strong>${safeRole}</strong>.</p>
        <p style="margin:0 0 22px;color:#657087;font-size:13px;">Invitation expires at ${escapeHtml(expiresLabel)} UTC.</p>
        <a href="${safeUrl}" style="display:inline-block;background:#1b3580;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">Accept invitation</a>
        <p style="margin:22px 0 6px;font-size:12px;color:#657087;">For security, sign in with the same email address this invitation was sent to. The link can only be used once.</p>
        <p style="margin:0;font-size:12px;word-break:break-all;color:#657087;">${safeUrl}</p>
      </section>
      <p style="margin:16px 4px;font-size:12px;color:#7b8496;">If you weren't expecting this invitation, you can ignore this message.</p>
    </main>
  </body>
</html>`;

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `fieldtrack-invitation-${input.invitationId}`,
      },
      body: JSON.stringify({
        from,
        to: [input.recipientEmail],
        subject,
        html,
        text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
      message?: unknown;
    } | null;
    if (!response.ok) {
      return {
        provider: "resend",
        delivered: false,
        messageId: null,
        error:
          "Resend could not accept the invitation email. Check the API key and verify the configured sender domain.",
        attemptedAt,
      };
    }

    return {
      provider: "resend",
      delivered: true,
      messageId: typeof payload?.id === "string" ? payload.id : null,
      error: null,
      attemptedAt,
    };
  } catch {
    return {
      provider: "resend",
      delivered: false,
      messageId: null,
      error:
        "Resend could not be reached. The invitation exists; copy the fallback link and send it manually.",
      attemptedAt,
    };
  }
}
