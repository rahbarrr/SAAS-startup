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
            Foreground: {consentState.foregroundGranted ? "Granted" : "Denied"} • Background:{" "}
            {consentState.backgroundGranted ? "Granted" : "Denied"}.
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
    padding: 14,
    borderRadius: 16,
    marginVertical: 6,
  },
  bannerActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
  },
  bannerWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
  },
  bannerInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8EAF2",
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#021D24",
    marginBottom: 2,
  },
  textActive: {
    color: "#065F46",
  },
  textWarning: {
    color: "#92400E",
  },
  description: {
    fontSize: 11,
    color: "#093F52",
    lineHeight: 15,
  },
  actionButton: {
    backgroundColor: "#216A85",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  buttonWarning: {
    backgroundColor: "#D97706",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  revokeButton: {
    borderColor: "#65A7C2",
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  revokeButtonText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
  },
});
