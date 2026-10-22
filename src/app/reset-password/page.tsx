"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { updatePasswordAction } from "@/modules/auth/actions";

export default function ResetPasswordPage(): ReactNode {
  const [password, setPassword] = useState("");
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
      setMessage(result.message ?? "Your password has been updated.");
    });
  }

  return (
    <section
      className="card"
      style={{ maxWidth: "28rem", margin: "1rem auto", width: "100%" }}
      aria-labelledby="reset-password-heading"
    >
      <h1
        id="reset-password-heading"
        className="card-title"
        style={{ fontSize: "1.375rem" }}
      >
        Choose a new password
      </h1>
      <p className="card-meta">
        Enter a new password of at least 8 characters for your FieldTrack account.
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
            htmlFor="new-password"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            New Password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {isPending ? "Updating password…" : "Update Password"}
        </button>
      </form>

      <div style={{ fontSize: "0.875rem" }}>
        <Link href="/">Return to Overview</Link>
      </div>
    </section>
  );
}
