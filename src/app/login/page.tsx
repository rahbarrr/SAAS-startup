"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { signInAction } from "@/modules/auth/actions";

export default function LoginPage(): ReactNode {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setMessage(`Signed in as ${result.data?.email ?? email}. Redirecting…`);
      window.location.assign("/");
    });
  }

  return (
    <section
      className="card"
      style={{ maxWidth: "28rem", margin: "1rem auto", width: "100%" }}
      aria-labelledby="login-heading"
    >
      <h1 id="login-heading" className="card-title" style={{ fontSize: "1.375rem" }}>
        Sign in to FieldTrack
      </h1>
      <p className="card-meta">
        Access your organization’s field trips, store visits, and approvals.
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
            htmlFor="login-email"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Work Email
          </label>
          <input
            id="login-email"
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

        <div>
          <label
            htmlFor="login-password"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
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
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          fontSize: "0.875rem",
        }}
      >
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/signup">Create an account</Link>
      </div>
    </section>
  );
}
