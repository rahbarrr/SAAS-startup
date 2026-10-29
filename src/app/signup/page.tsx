"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from "react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { signUpAction } from "@/modules/auth/actions";

export default function SignUpPage(): ReactNode {
  const [fullName, setFullName] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite_token");
    if (token) setInviteToken(token);
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await signUpAction({
          fullName,
          email,
          password,
          inviteToken: inviteToken || undefined,
        });
        if (!result.ok) {
          setError(result.error ?? "Unable to create account.");
          return;
        }
        setMessage(
          result.message ??
            "Account created. Proceed to onboarding to create or join an organization."
        );
        if (!result.data?.requiresEmailConfirmation) {
          window.location.assign(
            inviteToken
              ? `/onboarding?token=${encodeURIComponent(inviteToken)}`
              : "/onboarding"
          );
        }
      } catch {
        setError(
          "We couldn't reach the account service. Check your connection and try again."
        );
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "75vh",
        padding: "1rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <Link
          href="/"
          className="brand-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            marginBottom: "0.5rem",
          }}
        >
          <div
            className="brand-icon-box"
            style={{ width: "2.5rem", height: "2.5rem", fontSize: "1.25rem" }}
          >
            F
          </div>
          <span
            style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--brand-dark)" }}
          >
            FieldTrack
          </span>
        </Link>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Enterprise Field Operations &amp; Travel Management Platform
        </p>
      </div>

      <section
        className="card"
        style={{
          maxWidth: "28rem",
          width: "100%",
          padding: "2rem",
          boxShadow: "var(--shadow-md)",
          borderRadius: "var(--radius-xl)",
        }}
        aria-labelledby="signup-heading"
      >
        <h1
          id="signup-heading"
          className="card-title"
          style={{
            fontSize: "1.375rem",
            fontFamily: "var(--font-heading)",
            color: "var(--brand-dark)",
            marginBottom: "0.375rem",
          }}
        >
          Create your FieldTrack account
        </h1>
        <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
          After registering, you can create a new organization or accept a one-time
          invitation from your administrator.
        </p>

        {error ? (
          <div
            role="alert"
            className="state-panel state-panel--error"
            style={{
              padding: "0.75rem 1rem",
              textAlign: "left",
              marginBottom: "1rem",
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
              padding: "0.75rem 1rem",
              textAlign: "left",
              marginBottom: "1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(5, 150, 105, 0.1)",
              borderColor: "var(--success-green)",
              color: "var(--success-green)",
            }}
          >
            {message}
          </div>
        ) : null}

        <GoogleAuthButton mode="signup" inviteToken={inviteToken} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            margin: "1.25rem 0",
            color: "var(--text-muted)",
            fontSize: "0.8125rem",
          }}
        >
          <span style={{ height: "1px", flex: 1, background: "var(--border-subtle)" }} />
          <span>or continue with email</span>
          <span style={{ height: "1px", flex: 1, background: "var(--border-subtle)" }} />
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}
        >
          <div>
            <label
              htmlFor="signup-name"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.375rem",
              }}
            >
              Full Name
            </label>
            <input
              id="signup-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="signup-email"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.375rem",
              }}
            >
              Work Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              style={{
                width: "100%",
                minHeight: "var(--touch-target-min)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.375rem",
              }}
            >
              Password (minimum 8 characters)
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  paddingRight: "2.75rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "0.25rem 0.5rem",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
            style={{
              width: "100%",
              marginTop: "0.5rem",
              minHeight: "var(--touch-target-min)",
            }}
          >
            {isPending ? "Creating account…" : "Create FieldTrack Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
          }}
        >
          Already have an account?{" "}
          <Link
            href={
              inviteToken
                ? `/login?invite_token=${encodeURIComponent(inviteToken)}`
                : "/login"
            }
            style={{
              color: "var(--brand-primary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
