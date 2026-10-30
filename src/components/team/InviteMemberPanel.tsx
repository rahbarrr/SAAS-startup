"use client";

import { type FormEvent, useState, type ReactNode } from "react";
import { createInFlightActionGuard } from "@/lib/ux/formatting-and-resilience";
import type { OrgRole } from "@/modules/tenancy/domain";

interface InviteMemberPanelProps {
  orgId: string;
}

export function InviteMemberPanel({ orgId }: InviteMemberPanelProps): ReactNode {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("field_employee");
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    invitationId: string;
    email: string;
    role: string;
    inviteToken: string;
    expiresAt: string;
    emailDelivered: boolean;
    emailStatusMessage: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const actionGuard = createInFlightActionGuard();

  async function handleInviteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setCreatedInvite(null);

    const acquired = actionGuard.tryAcquire();
    if (!acquired) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          expiresInHours,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        data?: {
          invitation: {
            id: string;
            invitedEmail: string;
            role: string;
            expiresAt: string;
          };
          inviteToken: string;
          emailDelivery?: { delivered: boolean; error?: string | null };
        };
        error?: { message: string } | string;
        message?: string;
      } | null;

      if (!res.ok || payload?.error || !payload?.data?.inviteToken) {
        const serverError =
          (typeof payload?.error === "object" ? payload?.error?.message : null) ??
          (typeof payload?.message === "string" ? payload.message : null) ??
          (typeof payload?.error === "string" ? payload.error : null) ??
          (res.ok
            ? "Invitation created, but no invite token was returned by the server."
            : `Failed to send invitation (HTTP ${res.status}). Please verify permissions and try again.`);
        throw new Error(serverError);
      }

      const emailDelivered = payload.data.emailDelivery?.delivered === true;
      setCreatedInvite({
        invitationId: payload.data.invitation.id,
        email: payload.data.invitation.invitedEmail,
        role: payload.data.invitation.role,
        inviteToken: payload.data.inviteToken,
        expiresAt: payload.data.invitation.expiresAt,
        emailDelivered,
        emailStatusMessage: emailDelivered
        ? "The email provider accepted the invitation for delivery."
          : (payload.data.emailDelivery?.error ??
            "Automatic email delivery is not configured. Copy and share the fallback link."),
      });
      setEmail("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while creating the invitation."
      );
    } finally {
      setIsSubmitting(false);
      actionGuard.release();
    }
  }

  async function handleRetryEmail() {
    if (!createdInvite || isRetrying) return;
    setIsRetrying(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/orgs/${orgId}/invitations/${createdInvite.invitationId}/resend`,
        { method: "POST" }
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { emailDelivery?: { delivered: boolean; error?: string | null } };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data?.emailDelivery?.delivered) {
        throw new Error(
          payload?.error?.message ??
            payload?.data?.emailDelivery?.error ??
            "Invitation email retry was not accepted."
        );
      }
      setCreatedInvite((current) =>
        current
          ? {
              ...current,
              emailDelivered: true,
              emailStatusMessage: "The email provider accepted the invitation for delivery.",
            }
          : current
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invitation email retry failed."
      );
    } finally {
      setIsRetrying(false);
    }
  }

  function handleCopyInviteLink() {
    if (!createdInvite) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/signup?invite_token=${encodeURIComponent(
      createdInvite.inviteToken
    )}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div className="card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>
        Invite New Team Member
      </h3>
      <p className="card-meta" style={{ margin: "0 0 1rem" }}>
        Issue a secure, single-use invitation token. The invitee will be assigned the
        exact role specified below upon accepting.
      </p>

      {errorMessage ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "var(--color-danger-subtle, #fef2f2)",
            color: "var(--color-danger-text, #991b1b)",
            border: "1px solid var(--color-danger-border, #fecaca)",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {createdInvite ? (
        <div
          role="status"
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: createdInvite.emailDelivered
              ? "var(--color-success-subtle, #ecfdf5)"
              : "var(--color-warning-subtle, #fffbeb)",
            border: createdInvite.emailDelivered
              ? "1px solid var(--color-success-border, #a7f3d0)"
              : "1px solid var(--color-warning-border, #f59e0b)",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          <strong
            style={{
              color: createdInvite.emailDelivered
                ? "var(--color-success-text, #065f46)"
                : "var(--color-warning-text, #92400e)",
            }}
          >
            {createdInvite.emailDelivered
              ? "Invitation email accepted for delivery"
              : "Invitation created, but email was not sent"}
            : {createdInvite.email} ({createdInvite.role})
          </strong>
          <p style={{ margin: "0.5rem 0" }}>{createdInvite.emailStatusMessage}</p>
          {!createdInvite.emailDelivered ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleRetryEmail()}
              disabled={isRetrying}
            >
              {isRetrying ? "Retrying email…" : "Retry email delivery"}
            </button>
          ) : null}
          <p style={{ margin: "0.5rem 0" }}>
            Fallback invitation link (expires in {expiresInHours} hours):
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code
              style={{
                flex: 1,
                padding: "0.5rem",
                backgroundColor: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: "0.25rem",
                wordBreak: "break-all",
              }}
            >
              {typeof window !== "undefined" ? window.location.origin : ""}
              /signup?invite_token={createdInvite.inviteToken}
            </code>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyInviteLink}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleInviteSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <label
              htmlFor="invite-email"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Invitee Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="invite-role"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Organization Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <option value="field_employee">
                Field Employee (Visit audits, checklists, evidence)
              </option>
              <option value="manager">Manager (Trip approvals, reviews, exports)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="invite-expiry"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Expiration Window
            </label>
            <select
              id="invite-expiry"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <option value={24}>24 hours</option>
              <option value={48}>48 hours (Standard)</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? "Issuing Invitation…" : "+ Send Invitation"}
          </button>
        </div>
      </form>
    </div>
  );
}
