"use client";

import { useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type GoogleAuthButtonProps = {
  mode: "signup" | "login";
  inviteToken?: string;
  nextPath?: string;
};

export function GoogleAuthButton({
  mode,
  inviteToken = "",
  nextPath = "/onboarding",
}: GoogleAuthButtonProps): ReactNode {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleAuth(): Promise<void> {
    setIsPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const safeNextPath =
        inviteToken
          ? `/onboarding?token=${encodeURIComponent(inviteToken)}`
          : nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\")
            ? nextPath
            : "/onboarding";
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", safeNextPath);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch {
      setError("Google sign-in could not start. Please check that Google is enabled in Supabase Auth, or use email sign-in.");
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void handleGoogleAuth()}
        disabled={isPending}
        style={{ width: "100%", minHeight: "var(--touch-target-min)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "#FFFFFF", color: "#202124", border: "1px solid #DADCE0", fontWeight: 600 }}
      >
        <span aria-hidden="true" style={{ fontWeight: 800, fontSize: "1.125rem", color: "#4285F4" }}>G</span>
        {isPending ? "Connecting to Google…" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>
      {error ? <p role="alert" style={{ margin: 0, color: "var(--danger-red, #b91c1c)", fontSize: "0.8125rem" }}>{error}</p> : null}
    </div>
  );
}
