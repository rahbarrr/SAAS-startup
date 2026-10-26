"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
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
      setMessage(result.message ?? "Your password has been updated.");
      setTimeout(() => {
        window.location.assign("/login");
      }, 2000);
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
        aria-labelledby="reset-password-heading"
      >
        <h1
          id="reset-password-heading"
          className="card-title"
          style={{
            fontSize: "1.375rem",
            fontFamily: "var(--font-heading)",
            color: "var(--brand-dark)",
            marginBottom: "0.375rem",
          }}
        >
          Choose a new password
        </h1>
        <p className="card-meta" style={{ marginBottom: "1.25rem" }}>
          Enter a new password of at least 8 characters for your FieldTrack account.
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
              htmlFor="reset-password-input"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.375rem",
              }}
            >
              New Password (minimum 8 characters)
            </label>
            <div style={{ position: "relative" }}>
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
            {isPending ? "Updating password…" : "Save New Password"}
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
