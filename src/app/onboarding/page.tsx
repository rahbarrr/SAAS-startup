"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import {
  acceptInvitationAction,
  onboardOrganizationAction,
} from "@/modules/auth/actions";

export default function OnboardingPage(): ReactNode {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreateOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await onboardOrganizationAction({
        name: orgName,
        slug: orgSlug,
      });
      if (!result.ok) {
        setError(result.error ?? "Unable to create organization.");
        return;
      }
      setMessage(result.message ?? "Organization created.");
    });
  }

  function handleAcceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await acceptInvitationAction({ token: inviteToken });
      if (!result.ok) {
        setError(result.error ?? "Unable to accept invitation.");
        return;
      }
      setMessage(result.message ?? "Invitation accepted.");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="onboarding-heading">
        <h1 id="onboarding-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Organization Onboarding
        </h1>
        <p className="card-meta">
          Create a new organization (assigning you as its first active Admin) or accept a
          one-time invitation token from an existing organization.
        </p>
      </section>

      {error ? (
        <div
          role="alert"
          className="state-panel state-panel--error"
          style={{ padding: "0.75rem 1rem", textAlign: "left" }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{ padding: "0.75rem 1rem", textAlign: "left" }}
        >
          {message}
        </div>
      ) : null}

      <div className="card-grid">
        <section className="card" aria-labelledby="create-org-heading">
          <h2 id="create-org-heading" className="card-title">
            Create New Organization
          </h2>
          <p className="card-meta">
            Transactionally creates the organization and registers your account as the
            initial Admin.
          </p>
          <form
            onSubmit={handleCreateOrg}
            style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
          >
            <div>
              <label
                htmlFor="org-name"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Organization Name
              </label>
              <input
                id="org-name"
                name="name"
                type="text"
                required
                minLength={2}
                placeholder="Acme Retail North"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="org-slug"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Organization URL Slug
              </label>
              <input
                id="org-slug"
                name="slug"
                type="text"
                required
                minLength={2}
                placeholder="acme-retail-north"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? "Creating…" : "Create Organization"}
            </button>
          </form>
        </section>

        <section className="card" aria-labelledby="accept-invite-heading">
          <h2 id="accept-invite-heading" className="card-title">
            Accept Organization Invitation
          </h2>
          <p className="card-meta">
            Paste your one-time invitation token. Your role is assigned strictly from the
            administrator’s invitation.
          </p>
          <form
            onSubmit={handleAcceptInvite}
            style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
          >
            <div>
              <label
                htmlFor="invite-token"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                One-Time Invitation Token
              </label>
              <input
                id="invite-token"
                name="token"
                type="text"
                required
                minLength={16}
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <button type="submit" disabled={isPending} className="btn btn-secondary">
              {isPending ? "Verifying…" : "Accept Invitation"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
