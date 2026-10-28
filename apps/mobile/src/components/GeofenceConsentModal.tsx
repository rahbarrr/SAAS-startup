import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ConsentManager } from "../services/consent";
import type { GeofenceConsentState } from "../types";

export interface GeofenceConsentModalProps {
  visible: boolean;
  onClose: () => void;
  onConsentUpdated: (state: GeofenceConsentState) => void;
}

export function GeofenceConsentModal({
  visible,
  onClose,
  onConsentUpdated,
}: GeofenceConsentModalProps): React.JSX.Element {
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [fgStatus, setFgStatus] = useState<boolean>(false);
  const [bgStatus, setBgStatus] = useState<boolean>(false);

  const handleToggleConsent = async (value: boolean) => {
    setConsentGiven(value);
    if (!value) {
      const revoked = await ConsentManager.revokeConsent();
      setFgStatus(false);
      setBgStatus(false);
      onConsentUpdated(revoked);
    }
  };

  const handleRequestPermissionsSequence = async () => {
    setIsRequesting(true);
    try {
      // Step 1: Grant explicit consent
      await ConsentManager.grantConsent();

      // Step 2: Request foreground permission
      const fgGranted = await ConsentManager.requestForegroundPermission();
      setFgStatus(fgGranted);

      if (!fgGranted) {
        Alert.alert(
          "Foreground Permission Required",
          "FieldTrack requires foreground location access to determine when you arrive at planned stores."
        );
        setIsRequesting(false);
        return;
      }

      // Step 3: Request background permission
      const bgGranted = await ConsentManager.requestBackgroundPermission();
      setBgStatus(bgGranted);

      if (!bgGranted) {
        Alert.alert(
          "Background Permission Optional",
          "Without background location permission, automatic check-in when your phone screen is locked or in your pocket will be limited. You can still check in manually."
        );
      }

      const updatedState = await ConsentManager.getConsentState();
      onConsentUpdated(updatedState);
      onClose();
    } catch (error) {
      Alert.alert("Permission Error", error instanceof Error ? error.message : "Failed to update permissions");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Automatic Visit Geofencing</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Privacy & Transparency Policy</Text>
              <Text style={styles.infoText}>
                FieldTrack uses native geofencing exclusively to detect arrival and departure
                at the planned store stops of your authorized, active work trips.
              </Text>
              <Text style={styles.bulletPoint}>
                • Only active trip stops (max 20) are monitored within a 120m radius.
              </Text>
              <Text style={styles.bulletPoint}>
                • Monitoring stops automatically when your trip is completed or cancelled.
              </Text>
              <Text style={styles.bulletPoint}>
                • Continuous all-day breadcrumbs or off-shift tracking are never recorded.
              </Text>
              <Text style={styles.bulletPoint}>
                • You can revoke consent at any time and switch to manual check-in.
              </Text>
            </View>

            <View style={styles.consentRow}>
              <Text style={styles.consentLabel}>I consent to automatic visit tracking</Text>
              <Switch
                value={consentGiven}
                onValueChange={handleToggleConsent}
                trackColor={{ false: "#cbd5e1", true: "#2563eb" }}
              />
            </View>

            {consentGiven && (
              <View style={styles.permissionSection}>
                <Text style={styles.permissionSectionTitle}>
                  Operating System Permissions
                </Text>
                <Text style={styles.permissionStatusText}>
                  Foreground Access: {fgStatus ? "✓ Granted" : "Not Granted"}
                </Text>
                <Text style={styles.permissionStatusText}>
                  Background Access: {bgStatus ? "✓ Granted" : "Not Granted"}
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, isRequesting && styles.disabledButton]}
                  onPress={handleRequestPermissionsSequence}
                  disabled={isRequesting}
                >
                  <Text style={styles.buttonText}>
                    {isRequesting ? "Requesting Permissions…" : "Grant Location Permissions"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close & Return to Trip</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    maxHeight: "85%",
    overflow: "hidden",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 16,
    marginLeft: 4,
    marginBottom: 4,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    marginRight: 12,
  },
  permissionSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderColor: "#bfdbfe",
    borderWidth: 1,
  },
  permissionSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 6,
  },
  permissionStatusText: {
    fontSize: 12,
    color: "#1e3a8a",
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
});

