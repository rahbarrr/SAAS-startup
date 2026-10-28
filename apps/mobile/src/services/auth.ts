import * as SecureStore from "expo-secure-store";
import type { MobileAuthSession, MobileOrganizationMembership } from "../types";

export const MOBILE_SESSION_STORAGE_KEY = "fieldtrack_mobile_auth_session_v1";

/**
 * Normalizes and validates an HTTP/HTTPS API base URL.
 */
export function normalizeApiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Please enter the FieldTrack Server URL.");
  }
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) {
    throw new Error(
      "Server URL must start with http:// or https:// (for example, http://192.168.1.10:3000 or https://your-app.vercel.app)."
    );
  }
  return trimmed;
}

/**
 * Resolves the default FieldTrack backend base URL on physical devices and simulators:
 * 1. `process.env.EXPO_PUBLIC_API_BASE_URL` if configured at build/bundle time.
 * 2. When connected to Metro on a LAN IP (e.g. `192.168.x.x:8081`), derives `http://<lan-ip>:3000`.
 * 3. Falls back to `http://localhost:3000`.
 */
export function resolveDefaultApiBaseUrl(options?: {
  envBaseUrl?: string;
  metroScriptUrl?: string | null;
}): string {
  const envUrl =
    options?.envBaseUrl ??
    (typeof process !== "undefined"
      ? process.env?.EXPO_PUBLIC_API_BASE_URL?.trim()
      : undefined);

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  try {
    const scriptUrl = options?.metroScriptUrl;

    if (scriptUrl) {
      const match = scriptUrl.match(/^https?:\/\/([^:/]+)/i);
      const host = match?.[1];
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:3000`;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return "http://localhost:3000";
}

export class MobileAuthService {
  private static cachedSession: MobileAuthSession | null = null;

  static resetMemoryCache(): void {
    this.cachedSession = null;
  }

  static async getSavedSession(): Promise<MobileAuthSession | null> {
    if (this.cachedSession) {
      return { ...this.cachedSession };
    }
    try {
      const raw = await SecureStore.getItemAsync(MOBILE_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MobileAuthSession;
        if (parsed?.accessToken && parsed?.user?.id && parsed?.baseUrl) {
          this.cachedSession = parsed;
          return { ...parsed };
        }
      }
    } catch {
      // Ignore storage read failure
    }
    return null;
  }

  static async saveSession(session: MobileAuthSession): Promise<void> {
    this.cachedSession = { ...session };
    try {
      await SecureStore.setItemAsync(
        MOBILE_SESSION_STORAGE_KEY,
        JSON.stringify(session)
      );
    } catch {
      // Non-blocking if SecureStore value cannot be written
    }
  }

  static async clearSession(): Promise<void> {
    this.cachedSession = null;
    try {
      await SecureStore.deleteItemAsync(MOBILE_SESSION_STORAGE_KEY);
    } catch {
      // Non-blocking
    }
  }

  /**
   * Authenticates the employee against the FieldTrack backend (`POST /api/auth/login`),
   * resolves their active organization memberships, and stores the session in SecureStore.
   */
  static async signInWithPassword(params: {
    baseUrl: string;
    email: string;
    password: string;
  }): Promise<MobileAuthSession> {
    const baseUrl = normalizeApiBaseUrl(params.baseUrl);
    const email = params.email.trim();
    const password = params.password;

    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid work email address.");
    }
    if (!password) {
      throw new Error("Please enter your password.");
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      throw new Error(
        `Cannot reach FieldTrack server at ${baseUrl} (${detail}). Ensure the FieldTrack backend is running and reachable from this device, or update the Server URL.`
      );
    }

    let body: {
      data?: {
        accessToken?: string;
        refreshToken?: string | null;
        expiresAt?: number | null;
        user?: { id: string; email: string };
        organizations?: MobileOrganizationMembership[];
      } | null;
      error?: { code?: string; message?: string } | null;
    } | null = null;

    try {
      body = await response.json();
    } catch {
      throw new Error(
        `Unexpected response from ${baseUrl}/api/auth/login (HTTP ${response.status}). Verify that Server URL points to your FieldTrack Next.js backend.`
      );
    }

    if (!response.ok || !body?.data?.accessToken || !body?.data?.user) {
      throw new Error(
        body?.error?.message ?? `Sign-in failed (HTTP ${response.status}).`
      );
    }

    const activeOrgs = (body.data.organizations ?? []).filter(
      (membership) => membership.status === "active"
    );

    const session: MobileAuthSession = {
      baseUrl,
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken ?? null,
      expiresAt: body.data.expiresAt ?? null,
      user: body.data.user,
      organizations: activeOrgs,
      activeOrgId: activeOrgs[0]?.organization.id ?? null,
      activeTripId: null,
    };

    await this.saveSession(session);
    return session;
  }

  static async updateActiveSelection(params: {
    activeOrgId?: string | null;
    activeTripId?: string | null;
  }): Promise<MobileAuthSession | null> {
    const current = await this.getSavedSession();
    if (!current) return null;

    const updated: MobileAuthSession = {
      ...current,
      ...(params.activeOrgId !== undefined
        ? { activeOrgId: params.activeOrgId }
        : {}),
      ...(params.activeTripId !== undefined
        ? { activeTripId: params.activeTripId }
        : {}),
    };
    await this.saveSession(updated);
    return updated;
  }
}
