import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { MobileTripStop } from "../types";

export interface CheckInModalProps {
  visible: boolean;
  stop: MobileTripStop | null;
  currentCoords: {
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  } | null;
  distanceMeters: number | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRetryGps: () => void;
}

export function CheckInModal({
  visible,
  stop,
  currentCoords,
  distanceMeters,
  isSubmitting,
  onConfirm,
  onCancel,
  onRetryGps,
}: CheckInModalProps): React.JSX.Element | null {
  if (!visible || !stop) return null;

  const accuracy = currentCoords?.accuracyMeters;
  const isAccuracyPoor = accuracy !== null && accuracy !== undefined && accuracy > 50;
  const isOutside = distanceMeters !== null && distanceMeters > 150;
  const hasCoords = currentCoords?.latitude !== null && currentCoords?.longitude !== null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>GPS Visit Check-in</Text>
          <Text style={styles.storeName}>{stop.storeName}</Text>
          <Text style={styles.storeAddress}>
            {stop.addressLine1}
            {stop.city ? `, ${stop.city}` : ""}
          </Text>

          <View style={styles.statusBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Distance to Store:</Text>
              <Text
                style={[
                  styles.value,
                  isOutside ? styles.warningText : styles.successText,
                ]}
              >
                {distanceMeters !== null ? `${distanceMeters} meters` : "Calculating..."}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>GPS Accuracy:</Text>
              <Text
                style={[
                  styles.value,
                  isAccuracyPoor ? styles.warningText : styles.successText,
                ]}
              >
                {accuracy !== null && accuracy !== undefined
                  ? `±${Math.round(accuracy)}m`
                  : "Unavailable"}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Allowed Radius:</Text>
              <Text style={styles.value}>150 meters</Text>
            </View>
          </View>

          {isOutside && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                ⚠️ You are currently outside the 150m store geofence. Check-in will be
                flagged for manager review.
              </Text>
            </View>
          )}

          {isAccuracyPoor && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                ⚠️ GPS accuracy is ±{Math.round(accuracy ?? 0)}m (threshold is 50m). Consider
                retrying outdoors.
              </Text>
            </View>
          )}

          {!hasCoords && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                ⚠️ Device location unavailable. Offline check-in will be marked pending
                verification.
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetryGps}
              disabled={isSubmitting}
            >
              <Text style={styles.retryBtnText}>🔄 Fresh GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isSubmitting && styles.btnDisabled,
              ]}
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Check-in</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  storeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  storeAddress: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  successText: {
    color: "#16a34a",
  },
  warningText: {
    color: "#d97706",
  },
  alertBanner: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  alertText: {
    fontSize: 12,
    color: "#92400e",
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  confirmBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 130,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
});
