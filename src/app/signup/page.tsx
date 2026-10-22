"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { signUpAction } from "@/modules/auth/actions";

export default function SignUpPage(): ReactNode {
  const [fullName, setFullName] = useState("");
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
      const result = await signUpAction({ fullName, email, password });
      if (!result.ok) {
        setError(result.error ?? "Unable to create account.");
        return;
      }
      setMessage(
        result.message ??
          "Account created. Proceed to onboarding to create or join an organization."
      );
    });
  }

  return (
    <section
      className="card"
      style={{ maxWidth: "28rem", margin: "1rem auto", width: "100%" }}
      aria-labelledby="signup-heading"
    >
      <h1 id="signup-heading" className="card-title" style={{ fontSize: "1.375rem" }}>
        Create your FieldTrack account
      </h1>
      <p className="card-meta">
        After registering, you can create a new organization or accept a one-time
        invitation from your administrator.
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
            htmlFor="signup-name"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
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
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
            htmlFor="signup-email"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Work Email
          </label>
          <input
            id="signup-email"
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
            htmlFor="signup-password"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Password (minimum 8 characters)
          </label>
          <input
            id="signup-password"
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
          {isPending ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div style={{ fontSize: "0.875rem" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </section>
  );
}
