import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GeofenceConsentModal } from "../components/GeofenceConsentModal";
import { GeofenceStatusBanner } from "../components/GeofenceStatusBanner";
import { CheckInModal } from "../components/CheckInModal";
import { LiveTrackingBar } from "../components/LiveTrackingBar";
import type { FieldTrackMobileApiClient } from "../services/api";
import { ConsentManager } from "../services/consent";
import { EventQueueManager } from "../services/eventQueue";
import { calculateDistanceMeters, GeofenceManager } from "../services/geofencing";
import { LiveTrackingManager } from "../services/liveTracking";
import { MOBILE_THEME } from "../theme";
import type {
  GeofenceConsentState,
  LiveTrackingState,
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

  // GPS Check-in Modal state
  const [selectedStopForCheckIn, setSelectedStopForCheckIn] =
    useState<MobileTripStop | null>(null);
  const [checkInCoords, setCheckInCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  } | null>(null);
  const [distanceToStore, setDistanceToStore] = useState<number | null>(null);

  // Live Tracking state
  const [liveTrackingState, setLiveTrackingState] = useState<LiveTrackingState>(
    LiveTrackingManager.getState()
  );
  const [isTogglingTracking, setIsTogglingTracking] = useState(false);

  useEffect(() => {
    const unsubscribe = LiveTrackingManager.subscribeState((state) => {
      setLiveTrackingState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

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
        const { synced, failed } = await EventQueueManager.syncPendingEvents((event) =>
          apiClient.sendGeofenceEvent(event)
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
    if (newState.consented && newState.foregroundGranted && newState.backgroundGranted) {
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

  const handleOpenCheckInModal = async (stop: MobileTripStop) => {
    setSelectedStopForCheckIn(stop);
    const coords = await getCurrentDeviceCoords();
    setCheckInCoords(coords);

    if (
      coords.latitude !== null &&
      coords.longitude !== null &&
      stop.latitude !== null &&
      stop.longitude !== null
    ) {
      const dist = calculateDistanceMeters(
        coords.latitude,
        coords.longitude,
        stop.latitude,
        stop.longitude
      );
      setDistanceToStore(dist);
    } else {
      setDistanceToStore(null);
    }
  };

  const handleRefreshGpsReading = async () => {
    if (!selectedStopForCheckIn) return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (pos?.coords) {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? null,
        };
        setCheckInCoords(coords);
        if (
          selectedStopForCheckIn.latitude !== null &&
          selectedStopForCheckIn.longitude !== null
        ) {
          const dist = calculateDistanceMeters(
            coords.latitude,
            coords.longitude,
            selectedStopForCheckIn.latitude,
            selectedStopForCheckIn.longitude
          );
          setDistanceToStore(dist);
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleConfirmGpsCheckIn = async () => {
    if (!selectedStopForCheckIn) return;
    setIsProcessingManual(true);
    try {
      const res = await apiClient.manualCheckIn({
        tripStopId: selectedStopForCheckIn.id,
        latitude: checkInCoords?.latitude,
        longitude: checkInCoords?.longitude,
        accuracyMeters: checkInCoords?.accuracyMeters,
        idempotencyKey: `chk_${selectedStopForCheckIn.id}_${Date.now()}`,
      });
      setActiveVisitId(res.visitId);
      setSelectedStopForCheckIn(null);
      if (onTripUpdated) {
        try {
          const refreshed = await apiClient.getExecutableTrip(trip.id);
          onTripUpdated(refreshed);
        } catch {
          // Non-blocking
        }
      }
      Alert.alert(
        "Check-in Confirmed",
        `Checked into ${selectedStopForCheckIn.storeName} successfully.`
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

  const handleToggleLiveTracking = async () => {
    setIsTogglingTracking(true);
    try {
      if (liveTrackingState.isTracking) {
        await LiveTrackingManager.stopTracking(apiClient);
      } else {
        await LiveTrackingManager.startTracking(trip.id, apiClient);
      }
    } catch (err) {
      Alert.alert(
        "Live Tracking Error",
        err instanceof Error ? err.message : "Failed to toggle live tracking"
      );
    } finally {
      setIsTogglingTracking(false);
    }
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
      Alert.alert("Check-in Recorded", `Checked into ${stop.storeName} successfully.`);
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
      Alert.alert("Check-out Recorded", "Visit completed and submitted for review.");
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

      {/* Trip Header — Reference Dark Obsidian Hero Card */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Active Route Telemetry</Text>
        <Text style={styles.tripTitle}>{trip.title}</Text>
        <Text style={styles.tripMeta}>
          Status: <Text style={styles.tripStatus}>{trip.status.toUpperCase()}</Text> •{" "}
          {trip.stops.length} Planned Stops
        </Text>
      </View>

      {/* Live Tracking Bar */}
      <LiveTrackingBar
        trackingState={liveTrackingState}
        onToggleTracking={handleToggleLiveTracking}
        isLoading={isTogglingTracking}
      />

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
                    item.status === "visited" ? styles.badgeVisited : styles.badgePlanned,
                  ]}
                >
                  {item.status}
                </Text>
              </View>

              <View style={styles.stopFooter}>
                <Text style={styles.coordMeta}>
                  {hasCoords
                    ? "● 150m Geofence Active"
                    : "○ No Coordinates (Manual Only)"}
                </Text>

                {item.status === "planned" && !activeVisitId && (
                  <TouchableOpacity
                    style={styles.manualCheckInBtn}
                    onPress={() => handleOpenCheckInModal(item)}
                    disabled={isProcessingManual}
                  >
                    <Text style={styles.manualBtnText}>Check-in (GPS)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* GPS Check-In Modal */}
      <CheckInModal
        visible={Boolean(selectedStopForCheckIn)}
        stop={selectedStopForCheckIn}
        currentCoords={checkInCoords}
        distanceMeters={distanceToStore}
        isSubmitting={isProcessingManual}
        onConfirm={handleConfirmGpsCheckIn}
        onCancel={() => setSelectedStopForCheckIn(null)}
        onRetryGps={handleRefreshGpsReading}
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
    backgroundColor: MOBILE_THEME.colors.canvasBg,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: MOBILE_THEME.colors.electricBlueSoft,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.electricBlue,
  },
  signOutBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
  },
  header: {
    backgroundColor: MOBILE_THEME.colors.obsidianHero,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: MOBILE_THEME.colors.periwinkle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tripTitle: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  tripMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 3,
  },
  tripStatus: {
    fontWeight: "700",
    color: MOBILE_THEME.colors.periwinkle,
  },
  syncStatusBadge: {
    backgroundColor: MOBILE_THEME.colors.electricBlueSoft,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: MOBILE_THEME.radii.pill,
    marginVertical: 4,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: MOBILE_THEME.colors.electricBlue,
  },
  activeVisitBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MOBILE_THEME.colors.emeraldSoft,
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
  },
  activeVisitText: {
    fontSize: 13,
    fontWeight: "700",
    color: MOBILE_THEME.colors.emeraldText,
  },
  manualCheckoutBtn: {
    backgroundColor: MOBILE_THEME.colors.emeraldLive,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  stopsList: {
    paddingVertical: 8,
  },
  stopCard: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
    shadowColor: "#10291F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 2,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  stopSequence: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sequenceText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
  },
  stopInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
  },
  storeAddress: {
    fontSize: 11.5,
    color: MOBILE_THEME.colors.textSecondary,
    marginTop: 1,
  },
  stopStatusBadge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  badgeVisited: {
    backgroundColor: MOBILE_THEME.colors.emeraldSoft,
    color: MOBILE_THEME.colors.emeraldText,
  },
  badgePlanned: {
    backgroundColor: MOBILE_THEME.colors.canvasBg,
    color: MOBILE_THEME.colors.textSecondary,
  },
  stopFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: MOBILE_THEME.colors.borderSubtle,
  },
  coordMeta: {
    fontSize: 11,
    color: MOBILE_THEME.colors.textSecondary,
  },
  manualCheckInBtn: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  manualBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
