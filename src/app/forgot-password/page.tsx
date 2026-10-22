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
      const result = await requestPasswordRecoveryAction({
        email,
      });
      if (!result.ok) {
        setError(result.error ?? "Unable to process password recovery request.");
        return;
      }
      setMessage(
        result.message ??
          "If an account exists for that email address, recovery instructions have been sent."
      );
    });
  }

  return (
    <section
      className="card"
      style={{ maxWidth: "28rem", margin: "1rem auto", width: "100%" }}
      aria-labelledby="forgot-password-heading"
    >
      <h1
        id="forgot-password-heading"
        className="card-title"
        style={{ fontSize: "1.375rem" }}
      >
        Reset your password
      </h1>
      <p className="card-meta">
        Enter your work email and we will send a password reset link.
      </p>

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

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <label
            htmlFor="recovery-email"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Work Email
          </label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {isPending ? "Sending link…" : "Send Recovery Link"}
        </button>
      </form>

      <div style={{ fontSize: "0.875rem" }}>
        <Link href="/login">Return to Sign In</Link>
      </div>
    </section>
  );
}
