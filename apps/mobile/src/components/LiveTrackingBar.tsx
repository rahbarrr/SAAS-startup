import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { LiveTrackingState } from "../types";

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
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  barActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  barInactive: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
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
    backgroundColor: "#16a34a",
  },
  dotInactive: {
    backgroundColor: "#94a3b8",
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  buttonStart: {
    backgroundColor: "#2563eb",
    borderColor: "#1d4ed8",
  },
  buttonStartText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
  },
  buttonStop: {
    backgroundColor: "#ffffff",
    borderColor: "#dc2626",
  },
  buttonStopText: {
    color: "#dc2626",
    fontWeight: "600",
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
