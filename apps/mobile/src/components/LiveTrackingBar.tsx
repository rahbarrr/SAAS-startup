import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { LiveTrackingState } from "../types";
import { MOBILE_THEME } from "../theme";

export interface LiveTrackingBarProps {
  trackingState: LiveTrackingState;
  onToggleTracking: () => void;
  isLoading?: boolean;
}

export function LiveTrackingBar({
  trackingState,
  onToggleTracking,
  isLoading,
}: LiveTrackingBarProps): React.JSX.Element {
  const isTracking = trackingState.isTracking;

  return (
    <View style={[styles.bar, isTracking ? styles.barActive : styles.barInactive]}>
      <View style={styles.left}>
        <View style={[styles.dot, isTracking ? styles.dotPulse : styles.dotInactive]} />
        <View>
          <Text style={styles.statusTitle}>
            {isTracking ? "Live GPS Location Sharing Active" : "Location Sharing Paused"}
          </Text>
          <Text style={styles.statusSubtitle}>
            {isTracking
              ? `Sync: ${trackingState.syncStatus} • Acc: ${
                  trackingState.accuracyMeters
                    ? `±${Math.round(trackingState.accuracyMeters)}m`
                    : "n/a"
                }`
              : "Starts when authorized trip tracking is active"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          isTracking ? styles.buttonStop : styles.buttonStart,
          isLoading && styles.buttonDisabled,
        ]}
        onPress={onToggleTracking}
        disabled={isLoading}
      >
        <Text
          style={[
            styles.buttonText,
            isTracking ? styles.buttonStopText : styles.buttonStartText,
          ]}
        >
          {isLoading ? "..." : isTracking ? "Stop" : "Start Tracking"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  barActive: {
    backgroundColor: MOBILE_THEME.colors.electricBlueSoft,
    borderColor: MOBILE_THEME.colors.borderStrong,
  },
  barInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: MOBILE_THEME.colors.borderSubtle,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotPulse: {
    backgroundColor: MOBILE_THEME.colors.emeraldLive,
  },
  dotInactive: {
    backgroundColor: MOBILE_THEME.colors.forest400,
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: 11,
    color: MOBILE_THEME.colors.textSecondary,
    marginTop: 2,
  },
  button: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  buttonStart: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderColor: MOBILE_THEME.colors.electricBlue,
  },
  buttonStartText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  buttonStop: {
    backgroundColor: "#ffffff",
    borderColor: "#dc2626",
  },
  buttonStopText: {
    color: "#dc2626",
    fontWeight: "700",
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
