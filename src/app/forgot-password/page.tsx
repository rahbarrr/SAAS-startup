"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
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
        aria-labelledby="forgot-password-heading"
      >
        <h1
          id="forgot-password-heading"
          className="card-title"
          style={{
            fontSize: "1.375rem",
            fontFamily: "var(--font-heading)",
            color: "var(--brand-dark)",
            marginBottom: "0.375rem",
          }}
        >
          Reset your password
        </h1>
        <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
          Enter your work email and we will send secure password recovery instructions.
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

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}
        >
          <div>
            <label
              htmlFor="forgot-email"
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
              id="forgot-email"
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
            {isPending ? "Sending instructions…" : "Send Recovery Link"}
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
          Remember your password?{" "}
          <Link
            href="/login"
            style={{
              color: "var(--brand-primary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
