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
    <AuthLayout>
      <section className="auth-card" aria-labelledby="signup-heading">
        <div>
          <h1 id="signup-heading" className="auth-title">
            Create your account
          </h1>
          <p className="auth-subtitle">
            Start your 14-day evaluation pilot or accept an invitation from your team.
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

        <GoogleAuthButton mode="signup" inviteToken={inviteToken} />

        <div className="auth-divider">
          <span>or register with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="signup-name" className="form-label">
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email" className="form-label">
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-password" className="form-label">
              Password (minimum 8 characters)
            </label>
            <div className="password-field">
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
                <span>Creating account…</span>
              </>
            ) : (
              "Create FieldTrack Account"
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account?{" "}
          <Link
            href={
              inviteToken
                ? `/login?invite_token=${encodeURIComponent(inviteToken)}`
                : "/login"
            }
            className="auth-inline-link"
          >
            Sign in
          </Link>
        </p>
      </section>
    </AuthLayout>
  );
}
