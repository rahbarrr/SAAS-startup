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
import { sanitizeRedirectPath } from "@/modules/auth/schemas";
import { signInAction } from "@/modules/auth/actions";

export default function LoginPage(): ReactNode {
  const [email, setEmail] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite_token");
    if (token) setInviteToken(token);
    const candidateNext = params.get("next");
    if (candidateNext) {
      const sanitized = sanitizeRedirectPath(candidateNext, "/dashboard");
      setNextPath(sanitized === "/" ? "/dashboard" : sanitized);
    }
  }, []);
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
      const result = await signInAction({ email, password });
      if (!result.ok) {
        setError(result.error ?? "Unable to sign in.");
        return;
      }
      setMessage(
        `Signed in as ${result.data?.email ?? email}. Redirecting to your workspace…`
      );
      window.location.assign(
        inviteToken ? `/onboarding?token=${encodeURIComponent(inviteToken)}` : nextPath
      );
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
        aria-labelledby="login-heading"
      >
        <h1
          id="login-heading"
          className="card-title"
          style={{
            fontSize: "1.375rem",
            fontFamily: "var(--font-heading)",
            color: "var(--brand-dark)",
            marginBottom: "0.375rem",
          }}
        >
          Sign in to your account
        </h1>
        <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
          Access your organization’s field itineraries, store visits, and approvals.
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

        <GoogleAuthButton mode="login" inviteToken={inviteToken} nextPath={nextPath} />
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
          <span>or sign in with email</span>
          <span style={{ height: "1px", flex: 1, background: "var(--border-subtle)" }} />
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}
        >
          <div>
            <label
              htmlFor="login-email"
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
              id="login-email"
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.375rem",
              }}
            >
              <label
                htmlFor="login-password"
                style={{ fontWeight: 600, fontSize: "0.875rem" }}
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--brand-primary)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
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
            {isPending ? "Signing in…" : "Sign In to Workspace"}
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
          Don’t have an organization account yet?{" "}
          <Link
            href={
              inviteToken
                ? `/signup?invite_token=${encodeURIComponent(inviteToken)}`
                : "/signup"
            }
            style={{
              color: "var(--brand-primary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}
