import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GeofenceConsentModal } from "../components/GeofenceConsentModal";
import { GeofenceStatusBanner } from "../components/GeofenceStatusBanner";
import type { FieldTrackMobileApiClient } from "../services/api";
import { ConsentManager } from "../services/consent";
import { EventQueueManager } from "../services/eventQueue";
import { GeofenceManager } from "../services/geofencing";
import type {
  GeofenceConsentState,
  MobileTrip,
  MobileTripStop,
} from "../types";

export interface ActiveTripScreenProps {
  trip: MobileTrip;
  apiClient: FieldTrackMobileApiClient;
  currentUserId?: string;
  onBackToTrips?: () => void;
  onSignOut?: () => void;
  onTripUpdated?: (updatedTrip: MobileTrip) => void;
}

export function ActiveTripScreen({
  trip,
  apiClient,
  currentUserId,
  onBackToTrips,
  onSignOut,
  onTripUpdated,
}: ActiveTripScreenProps): React.JSX.Element {
  const [consentState, setConsentState] = useState<GeofenceConsentState>({
    consented: false,
    consentedAt: null,
    revokedAt: null,
    foregroundGranted: false,
    backgroundGranted: false,
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoredCount, setMonitoredCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [isProcessingManual, setIsProcessingManual] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const state = await ConsentManager.getConsentState();
      if (!mounted) return;
      setConsentState(state);

      if (state.consented && state.foregroundGranted && state.backgroundGranted) {
        try {
          const res = await GeofenceManager.registerTripGeofences(trip, {
            currentUserId,
          });
          if (mounted) {
            setIsMonitoring(res.registeredCount > 0);
            setMonitoredCount(res.registeredCount);
          }
        } catch {
          if (mounted) setIsMonitoring(false);
        }
      }
    }

    init();

    // Set callback when geofence event is processed
    GeofenceManager.configure({
      onEventProcessed: async () => {
        const { synced, failed } = await EventQueueManager.syncPendingEvents(
          (event) => apiClient.sendGeofenceEvent(event)
        );
        if (mounted) {
          setSyncStatus(`Auto Sync: ${synced} sent, ${failed} queued.`);
        }
        if (synced > 0 && onTripUpdated) {
          try {
            const refreshed = await apiClient.getExecutableTrip(trip.id);
            if (mounted) {
              onTripUpdated(refreshed);
            }
          } catch {
            // Non-blocking refresh
          }
        }
      },
    });

    return () => {
      mounted = false;
    };
  }, [trip, apiClient, currentUserId, onTripUpdated]);

  const handleConsentUpdated = async (newState: GeofenceConsentState) => {
    setConsentState(newState);
    if (
      newState.consented &&
      newState.foregroundGranted &&
      newState.backgroundGranted
    ) {
      try {
        const res = await GeofenceManager.registerTripGeofences(trip, {
          currentUserId,
        });
        setIsMonitoring(res.registeredCount > 0);
        setMonitoredCount(res.registeredCount);
      } catch (err) {
        Alert.alert(
          "Registration Error",
          err instanceof Error ? err.message : "Failed to register geofences"
        );
      }
    } else {
      await GeofenceManager.stopGeofencing();
      setIsMonitoring(false);
      setMonitoredCount(0);
    }
  };

  const handleRevokeConsent = async () => {
    Alert.alert(
      "Revoke Automatic Tracking?",
      "Automatic geofence check-in and checkout will be turned off. You will need to check in manually at each store stop.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            const state = await ConsentManager.revokeConsent();
            await GeofenceManager.stopGeofencing();
            setIsMonitoring(false);
            setMonitoredCount(0);
            setConsentState(state);
          },
        },
      ]
    );
  };

  const getCurrentDeviceCoords = async (): Promise<{
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  }> => {
    try {
      const pos = await Location.getLastKnownPositionAsync();
      if (pos?.coords) {
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? null,
        };
      }
    } catch {
      // Non-blocking fallback
    }
    return { latitude: null, longitude: null, accuracyMeters: null };
  };

  const handleManualCheckIn = async (stop: MobileTripStop) => {
    setIsProcessingManual(true);
    try {
      const coords = await getCurrentDeviceCoords();
      const res = await apiClient.manualCheckIn({
        tripStopId: stop.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      });
      setActiveVisitId(res.visitId);
      if (onTripUpdated) {
        try {
          const refreshed = await apiClient.getExecutableTrip(trip.id);
          onTripUpdated(refreshed);
        } catch {
          // Non-blocking
        }
      }
      Alert.alert(
        "Check-in Recorded",
        `Checked into ${stop.storeName} successfully.`
      );
    } catch (err) {
      Alert.alert(
        "Check-in Error",
        err instanceof Error ? err.message : "Failed to check in"
      );
    } finally {
      setIsProcessingManual(false);
    }
  };

  const handleManualCheckOut = async () => {
    if (!activeVisitId) return;
    setIsProcessingManual(true);
    try {
      const coords = await getCurrentDeviceCoords();
      await apiClient.manualCheckOut({
        visitId: activeVisitId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      });
      setActiveVisitId(null);
      if (onTripUpdated) {
        try {
          const refreshed = await apiClient.getExecutableTrip(trip.id);
          onTripUpdated(refreshed);
        } catch {
          // Non-blocking
        }
      }
      Alert.alert(
        "Check-out Recorded",
        "Visit completed and submitted for review."
      );
    } catch (err) {
      Alert.alert(
        "Check-out Error",
        err instanceof Error ? err.message : "Failed to check out"
      );
    } finally {
      setIsProcessingManual(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Navigation Bar */}
      {(onBackToTrips || onSignOut) && (
        <View style={styles.navBar}>
          {onBackToTrips ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToTrips}>
              <Text style={styles.backBtnText}>← Change Trip</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {onSignOut ? (
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Trip Header */}
      <View style={styles.header}>
        <Text style={styles.tripTitle}>{trip.title}</Text>
        <Text style={styles.tripMeta}>
          Status:{" "}
          <Text style={styles.tripStatus}>{trip.status.toUpperCase()}</Text> •{" "}
          {trip.stops.length} Planned Stops
        </Text>
      </View>

      {/* Geofence Status Banner */}
      <GeofenceStatusBanner
        isMonitoring={isMonitoring}
        monitoredRegionsCount={monitoredCount}
        consentState={consentState}
        onOpenSettings={() => setModalVisible(true)}
        onRevokeConsent={handleRevokeConsent}
      />

      {syncStatus && (
        <View style={styles.syncStatusBadge}>
          <Text style={styles.syncStatusText}>{syncStatus}</Text>
        </View>
      )}

      {/* Active Visit Bar */}
      {activeVisitId && (
        <View style={styles.activeVisitBar}>
          <Text style={styles.activeVisitText}>● Visit in progress</Text>
          <TouchableOpacity
            style={styles.manualCheckoutBtn}
            onPress={handleManualCheckOut}
            disabled={isProcessingManual}
          >
            <Text style={styles.manualBtnText}>
              {isProcessingManual ? "Checking Out…" : "Manual Check-out"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stops List */}
      <FlatList
        data={trip.stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.stopsList}
        renderItem={({ item, index }) => {
          const hasCoords = item.latitude !== null && item.longitude !== null;
          return (
            <View style={styles.stopCard}>
              <View style={styles.stopHeader}>
                <View style={styles.stopSequence}>
                  <Text style={styles.sequenceText}>{index + 1}</Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text style={styles.storeName}>{item.storeName}</Text>
                  <Text style={styles.storeAddress}>
                    {item.addressLine1}
                    {item.city ? `, ${item.city}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stopStatusBadge,
                    item.status === "visited"
                      ? styles.badgeVisited
                      : styles.badgePlanned,
                  ]}
                >
                  {item.status}
                </Text>
              </View>

              <View style={styles.stopFooter}>
                <Text style={styles.coordMeta}>
                  {hasCoords
                    ? "📍 120m Geofence Active"
                    : "⚠️ No Coordinates (Manual Only)"}
                </Text>

                {item.status === "planned" && !activeVisitId && (
                  <TouchableOpacity
                    style={styles.manualCheckInBtn}
                    onPress={() => handleManualCheckIn(item)}
                    disabled={isProcessingManual}
                  >
                    <Text style={styles.manualBtnText}>Manual Check-in</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Consent Modal */}
      <GeofenceConsentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConsentUpdated={handleConsentUpdated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#e0f2fe",
    borderRadius: 6,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369a1",
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  header: {
    marginBottom: 8,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  tripMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  tripStatus: {
    fontWeight: "600",
    color: "#0284c7",
  },
  syncStatusBadge: {
    backgroundColor: "#e0f2fe",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginVertical: 4,
  },
  syncStatusText: {
    fontSize: 11,
    color: "#0369a1",
  },
  activeVisitBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  activeVisitText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
  manualCheckoutBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stopsList: {
    paddingVertical: 8,
  },
  stopCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  stopSequence: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0284c7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sequenceText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  stopInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  storeAddress: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  stopStatusBadge: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeVisited: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  badgePlanned: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  stopFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  coordMeta: {
    fontSize: 11,
    color: "#475569",
  },
  manualCheckInBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  manualBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});
