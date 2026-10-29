"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { updatePasswordAction } from "@/modules/auth/actions";

export default function ResetPasswordPage(): ReactNode {
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
      const result = await updatePasswordAction({ password });
      if (!result.ok) {
        setError(result.error ?? "Unable to update password.");
        return;
      }
      setMessage("Your password has been successfully updated. You may now sign in.");
    });
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="reset-password-heading">
        <div>
          <h1 id="reset-password-heading" className="auth-title">
            Choose a new password
          </h1>
          <p className="auth-subtitle">
            Enter a new password of at least 8 characters for your FieldTrack account.
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

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reset-password-input" className="form-label">
              New Password (minimum 8 characters)
            </label>
            <div className="password-field">
              <input
                id="reset-password-input"
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
                <span>Updating password…</span>
              </>
            ) : (
              "Save New Password"
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          <Link href="/login" className="auth-inline-link">
            Back to Sign in
          </Link>
        </p>
      </section>
    </AuthLayout>
  );
}
