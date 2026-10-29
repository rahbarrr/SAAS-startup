"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { requestPasswordRecoveryAction } from "@/modules/auth/actions";

export default function ForgotPasswordPage(): ReactNode {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await requestPasswordRecoveryAction({ email });
        if (!result.ok) {
          setError(result.error ?? "Unable to process password recovery request.");
          return;
        }
        setMessage(
          result.message ??
            "If an account exists for that email address, recovery instructions have been sent."
        );
      } catch {
        setError(
          "We couldn't reach the recovery service. Check your connection and try again."
        );
      }
    });
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="forgot-password-heading">
        <div>
          <h1 id="forgot-password-heading" className="auth-title">
            Reset your password
          </h1>
          <p className="auth-subtitle">
            Enter your work email and we will send secure password recovery instructions.
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
            <label htmlFor="forgot-email" className="form-label">
              Work Email
            </label>
            <input
              id="forgot-email"
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

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary btn-block"
            style={{ marginTop: "0.25rem" }}
          >
            {isPending ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Sending instructions…</span>
              </>
            ) : (
              "Send Recovery Email"
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          Remembered your credentials?{" "}
          <Link href="/login" className="auth-inline-link">
            Back to Sign in
          </Link>
        </p>
      </section>
    </AuthLayout>
  );
}
