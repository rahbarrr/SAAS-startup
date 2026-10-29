"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
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
    <AuthLayout>
      <section className="auth-card" aria-labelledby="login-heading">
        <div>
          <h1 id="login-heading" className="auth-title">
            Sign in to your account
          </h1>
          <p className="auth-subtitle">
            Access your organization’s field itineraries, store visits, and approvals.
          </p>
        </div>

        {error ? (
          <div role="alert" className="alert alert--error">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div role="status" aria-live="polite" className="alert alert--success">
            <span aria-hidden="true">✓</span>
            <span>{message}</span>
          </div>
        ) : null}

        <GoogleAuthButton mode="login" inviteToken={inviteToken} nextPath={nextPath} />

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
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
            />
          </div>

          <div className="form-group">
            <div className="auth-label-row">
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
              <Link href="/forgot-password" className="auth-inline-link">
                Forgot password?
              </Link>
            </div>
            <div className="password-field">
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary btn-block"
            style={{ marginTop: "0.25rem" }}
          >
            {isPending ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Signing in…</span>
              </>
            ) : (
              "Sign In to Workspace"
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          Don’t have an organization account yet?{" "}
          <Link
            href={
              inviteToken
                ? `/signup?invite_token=${encodeURIComponent(inviteToken)}`
                : "/signup"
            }
            className="auth-inline-link"
          >
            Create an account
          </Link>
        </p>
      </section>
    </AuthLayout>
  );
}
