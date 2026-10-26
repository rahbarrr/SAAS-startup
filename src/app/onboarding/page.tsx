"use client";

import { useSearchParams } from "next/navigation";
import {
  Suspense,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  acceptInvitationAction,
  onboardOrganizationAction,
} from "@/modules/auth/actions";

function OnboardingContent(): ReactNode {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") ?? "";

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [inviteToken, setInviteToken] = useState(tokenParam);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (tokenParam) {
      setInviteToken(tokenParam);
    }
  }, [tokenParam]);

  function handleNameChange(val: string) {
    setOrgName(val);
    if (!isSlugManuallyEdited) {
      const generatedSlug = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setOrgSlug(generatedSlug);
    }
  }

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
      setMessage(result.message ?? "Organization created successfully.");
      setTimeout(() => {
        window.location.assign("/");
      }, 1000);
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
      setMessage(result.message ?? "Invitation accepted. Redirecting to workspace…");
      setTimeout(() => {
        window.location.assign("/");
      }, 1000);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        maxWidth: "56rem",
        margin: "1rem auto",
        width: "100%",
      }}
    >
      <section aria-labelledby="onboarding-heading">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.25rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "0.2rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              background: "rgba(27, 53, 128, 0.1)",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            Workspace Setup
          </span>
        </div>
        <h1
          id="onboarding-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.75rem",
            fontFamily: "var(--font-heading)",
            color: "var(--brand-dark)",
          }}
        >
          Organization Onboarding
        </h1>
        <p className="card-meta" style={{ fontSize: "0.9375rem" }}>
          Create a new company workspace as the initial Workspace Administrator, or join
          an existing organization using a verified invitation token.
        </p>
      </section>

      {error ? (
        <div
          role="alert"
          className="state-panel state-panel--error"
          style={{
            padding: "0.875rem 1.25rem",
            textAlign: "left",
            borderRadius: "var(--radius-md)",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{
            padding: "0.875rem 1.25rem",
            textAlign: "left",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(5, 150, 105, 0.1)",
            borderColor: "var(--success-green)",
            color: "var(--success-green)",
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        className="card-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Option 1: Create Organization */}
        <section
          className="card"
          aria-labelledby="create-org-heading"
          style={{
            padding: "1.75rem",
            borderRadius: "var(--radius-xl)",
            borderTop: "4px solid var(--brand-primary)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: "50%",
                  background: "var(--brand-primary)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                }}
              >
                1
              </span>
              <h2
                id="create-org-heading"
                className="card-title"
                style={{ fontSize: "1.25rem", margin: 0, color: "var(--brand-dark)" }}
              >
                Create New Organization
              </h2>
            </div>
            <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
              Transactionally provisions the workspace database schema and assigns your
              account as the initial Admin.
            </p>

            <form
              onSubmit={handleCreateOrg}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label
                  htmlFor="org-name"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    marginBottom: "0.375rem",
                  }}
                >
                  Organization Name *
                </label>
                <input
                  id="org-name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="e.g. Acme Retail North"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input-field"
                  style={{
                    width: "100%",
                    minHeight: "var(--touch-target-min)",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="org-slug"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    marginBottom: "0.375rem",
                  }}
                >
                  Workspace Identifier Slug *
                </label>
                <input
                  id="org-slug"
                  name="slug"
                  type="text"
                  required
                  minLength={2}
                  placeholder="acme-retail-north"
                  value={orgSlug}
                  onChange={(e) => {
                    setIsSlugManuallyEdited(true);
                    setOrgSlug(e.target.value);
                  }}
                  className="input-field"
                  style={{
                    width: "100%",
                    minHeight: "var(--touch-target-min)",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  Used for unique tenant identification and routing.
                </span>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-canvas)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                ✓ <strong>Admin Privileges:</strong> Full control over trip approvals,
                checklist templates, store directories, and team member invitations.
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary"
                style={{ minHeight: "var(--touch-target-min)", marginTop: "0.5rem" }}
              >
                {isPending ? "Creating Workspace…" : "Create & Launch Workspace"}
              </button>
            </form>
          </div>
        </section>

        {/* Option 2: Join via Invitation */}
        <section
          className="card"
          aria-labelledby="accept-invite-heading"
          style={{
            padding: "1.75rem",
            borderRadius: "var(--radius-xl)",
            borderTop: "4px solid var(--brand-accent)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: "50%",
                  background: "var(--brand-accent)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                }}
              >
                2
              </span>
              <h2
                id="accept-invite-heading"
                className="card-title"
                style={{ fontSize: "1.25rem", margin: 0, color: "var(--brand-dark)" }}
              >
                Accept Organization Invitation
              </h2>
            </div>
            <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
              Paste your one-time invitation token. Your role is assigned strictly by your
              organization’s administrator.
            </p>

            <form
              onSubmit={handleAcceptInvite}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label
                  htmlFor="invite-token"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    marginBottom: "0.375rem",
                  }}
                >
                  One-Time Invitation Token *
                </label>
                <input
                  id="invite-token"
                  name="token"
                  type="text"
                  required
                  minLength={16}
                  placeholder="Paste 64-character token"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="input-field"
                  style={{
                    width: "100%",
                    minHeight: "var(--touch-target-min)",
                    fontFamily: "monospace",
                    fontSize: "0.8125rem",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  Tokens are cryptographic, single-use, and expire automatically.
                </span>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-canvas)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                🔒 <strong>Cryptographic Verification:</strong> Role and organization
                access are validated server-side. Form tampering cannot elevate
                privileges.
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn btn-secondary"
                style={{ minHeight: "var(--touch-target-min)", marginTop: "0.5rem" }}
              >
                {isPending ? "Verifying Token…" : "Accept & Enter Workspace"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function OnboardingPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          Loading workspace onboarding…
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
