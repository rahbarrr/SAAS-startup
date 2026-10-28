import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { GeofenceConsentState } from "../types";

export interface GeofenceStatusBannerProps {
  isMonitoring: boolean;
  monitoredRegionsCount: number;
  consentState: GeofenceConsentState;
  onOpenSettings: () => void;
  onRevokeConsent: () => void;
}

export function GeofenceStatusBanner({
  isMonitoring,
  monitoredRegionsCount,
  consentState,
  onOpenSettings,
  onRevokeConsent,
}: GeofenceStatusBannerProps): React.JSX.Element {
  if (!consentState.consented) {
    return (
      <View style={[styles.banner, styles.bannerInactive]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Automatic Geofencing Disabled</Text>
          <Text style={styles.description}>
            Consent not provided. Using manual check-in &amp; check-out.
          </Text>
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={onOpenSettings}>
          <Text style={styles.actionButtonText}>Enable</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!consentState.foregroundGranted || !consentState.backgroundGranted) {
    return (
      <View style={[styles.banner, styles.bannerWarning]}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, styles.textWarning]}>
            Missing Location Permissions
          </Text>
          <Text style={styles.description}>
            Foreground: {consentState.foregroundGranted ? "✓" : "✗"} • Background:{" "}
            {consentState.backgroundGranted ? "✓" : "✗"}.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, styles.buttonWarning]}
          onPress={onOpenSettings}
        >
          <Text style={styles.actionButtonText}>Grant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isMonitoring) {
    return (
      <View style={[styles.banner, styles.bannerActive]}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, styles.textActive]}>
            ● Active Trip Geofencing ({monitoredRegionsCount} Stops)
          </Text>
          <Text style={styles.description}>
            Hands-free check-in enabled (120m radius around planned stops).
          </Text>
        </View>
        <TouchableOpacity style={styles.revokeButton} onPress={onRevokeConsent}>
          <Text style={styles.revokeButtonText}>Revoke</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerInactive]}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Geofencing Ready (Paused)</Text>
        <Text style={styles.description}>
          No in-progress trip stop regions currently registered.
        </Text>
      </View>
      <TouchableOpacity style={styles.actionButton} onPress={onOpenSettings}>
        <Text style={styles.actionButtonText}>Manage</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  bannerActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
  },
  bannerWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
  },
  bannerInactive: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  textActive: {
    color: "#065f46",
  },
  textWarning: {
    color: "#92400e",
  },
  description: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 15,
  },
  actionButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonWarning: {
    backgroundColor: "#d97706",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  revokeButton: {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  revokeButtonText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "600",
  },
});

