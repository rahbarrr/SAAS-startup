import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import type { GeofenceConsentState } from "../types";

const CONSENT_STORAGE_KEY = "fieldtrack_geofence_consent_v1";

type RevocationListener = () => Promise<void> | void;

export class ConsentManager {
  private static cachedState: GeofenceConsentState | null = null;
  private static revocationListeners: Set<RevocationListener> = new Set();

  /**
   * Registers a callback invoked immediately whenever consent is revoked
   * (e.g., to deregister active OS geofences).
   */
  static onConsentRevoked(listener: RevocationListener): () => void {
    this.revocationListeners.add(listener);
    return () => {
      this.revocationListeners.delete(listener);
    };
  }

  /**
   * Clears in-memory state to simulate an app restart / cold start.
   */
  static resetMemoryCache(): void {
    this.cachedState = null;
  }

  /**
   * Loads the current employee consent state from persistent secure storage
   * and synchronizes live OS foreground/background permission states.
   */
  static async getConsentState(): Promise<GeofenceConsentState> {
    if (!this.cachedState) {
      try {
        const stored = await SecureStore.getItemAsync(CONSENT_STORAGE_KEY);
        if (stored) {
          this.cachedState = JSON.parse(stored) as GeofenceConsentState;
        }
      } catch {
        // Fallback if secure store is unavailable
      }
    }

    if (!this.cachedState) {
      this.cachedState = {
        consented: false,
        consentedAt: null,
        revokedAt: null,
        foregroundGranted: false,
        backgroundGranted: false,
      };
    }

    await this.syncOsPermissions(this.cachedState);
    return { ...this.cachedState };
  }

  /**
   * Refreshes the OS permission status from expo-location.
   */
  static async refreshPermissions(): Promise<GeofenceConsentState> {
    return this.getConsentState();
  }

  private static async syncOsPermissions(state: GeofenceConsentState): Promise<void> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const hasPreciseAccuracy =
        fg?.ios?.accuracy !== "reduced" && fg?.android?.accuracy !== "coarse";
      state.foregroundGranted = Boolean(fg?.granted) && hasPreciseAccuracy;

      if (state.foregroundGranted) {
        const bg = await Location.getBackgroundPermissionsAsync();
        state.backgroundGranted = Boolean(bg?.granted);
      } else {
        state.backgroundGranted = false;
      }
    } catch {
      state.foregroundGranted = false;
      state.backgroundGranted = false;
    }
  }

  /**
   * Step 1: Employee grants explicit consent in the app UI.
   */
  static async grantConsent(): Promise<GeofenceConsentState> {
    const state = await this.getConsentState();
    state.consented = true;
    state.consentedAt = new Date().toISOString();
    state.revokedAt = null;

    await this.persist(state);
    return { ...state };
  }

  /**
   * Step 2: Request foreground location permission.
   * Must be called before background location permission can be requested.
   */
  static async requestForegroundPermission(): Promise<boolean> {
    const state = await this.getConsentState();
    if (!state.consented) {
      throw new Error(
        "Explicit employee consent is required before requesting location permissions."
      );
    }

    const fg = await Location.requestForegroundPermissionsAsync();
    const hasPreciseAccuracy =
      fg?.ios?.accuracy !== "reduced" && fg?.android?.accuracy !== "coarse";
    state.foregroundGranted = fg.status === "granted" && hasPreciseAccuracy;
    if (!state.foregroundGranted) {
      state.backgroundGranted = false;
    }
    await this.persist(state);
    return state.foregroundGranted;
  }

  /**
   * Step 3: Request background location permission.
   * Must only be called after foreground permission has been granted.
   */
  static async requestBackgroundPermission(): Promise<boolean> {
    const state = await this.getConsentState();
    if (!state.consented) {
      throw new Error(
        "Explicit employee consent is required before requesting background location permissions."
      );
    }
    if (!state.foregroundGranted) {
      throw new Error(
        "Foreground location permission must be granted before requesting background permission."
      );
    }

    const { status } = await Location.requestBackgroundPermissionsAsync();
    state.backgroundGranted = status === "granted";
    await this.persist(state);
    return state.backgroundGranted;
  }

  /**
   * Revoke employee consent at any time.
   * Immediately clears consent, marks revokedAt timestamp, and triggers registered
   * revocation listeners to stop active geofence monitoring.
   */
  static async revokeConsent(): Promise<GeofenceConsentState> {
    const state = await this.getConsentState();
    state.consented = false;
    state.revokedAt = new Date().toISOString();

    await this.persist(state);

    for (const listener of this.revocationListeners) {
      try {
        await listener();
      } catch {
        // Non-blocking listener cleanup
      }
    }

    return { ...state };
  }

  /**
   * Verifies if geofencing is fully authorized (consent + foreground + background).
   */
  static async isGeofencingAuthorized(): Promise<boolean> {
    const state = await this.getConsentState();
    return state.consented && state.foregroundGranted && state.backgroundGranted;
  }

  private static async persist(state: GeofenceConsentState): Promise<void> {
    this.cachedState = { ...state };
    try {
      await SecureStore.setItemAsync(CONSENT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage failure non-blocking
    }
  }
}
