import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import "./services/geofencing";
import {
  ActiveTripScreen,
  type ActiveTripScreenProps,
} from "./screens/ActiveTripScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { TripSelectorScreen } from "./screens/TripSelectorScreen";
import { FieldTrackMobileApiClient } from "./services/api";
import { MobileAuthService } from "./services/auth";
import { GeofenceManager } from "./services/geofencing";
import type { MobileAuthSession, MobileTrip } from "./types";

export interface FieldTrackMobileAppProps {
  activeTrip?: ActiveTripScreenProps["trip"] | null;
  apiClient?: ActiveTripScreenProps["apiClient"] | null;
}

export function App({
  activeTrip = null,
  apiClient = null,
}: FieldTrackMobileAppProps): React.JSX.Element {
  const [session, setSession] = useState<MobileAuthSession | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<MobileTrip | null>(
    activeTrip
  );
  const [selectedApiClient, setSelectedApiClient] =
    useState<FieldTrackMobileApiClient | null>(apiClient);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(
    !(activeTrip && apiClient)
  );

  useEffect(() => {
    if (activeTrip && apiClient) {
      setSelectedTrip(activeTrip);
      setSelectedApiClient(apiClient);
      setIsRestoringSession(false);
      return;
    }

    let mounted = true;
    async function restore() {
      try {
        const saved = await MobileAuthService.getSavedSession();
        if (!mounted) return;
        if (saved) {
          setSession(saved);
          if (saved.activeOrgId && saved.activeTripId) {
            try {
              const client = new FieldTrackMobileApiClient({
                baseUrl: saved.baseUrl,
                authToken: saved.accessToken,
                orgId: saved.activeOrgId,
              });
              const restoredTrip = await client.getExecutableTrip(
                saved.activeTripId
              );
              if (mounted) {
                setSelectedTrip(restoredTrip);
                setSelectedApiClient(client);
              }
            } catch {
              await MobileAuthService.updateActiveSelection({
                activeTripId: null,
              });
            }
          }
        }
      } finally {
        if (mounted) {
          setIsRestoringSession(false);
        }
      }
    }

    restore();
    return () => {
      mounted = false;
    };
  }, [activeTrip, apiClient]);

  const handleSignedIn = (newSession: MobileAuthSession) => {
    setSession(newSession);
    setSelectedTrip(null);
    setSelectedApiClient(null);
  };

  const handleSelectOrganization = async (orgId: string) => {
    const updated = await MobileAuthService.updateActiveSelection({
      activeOrgId: orgId,
      activeTripId: null,
    });
    if (updated) {
      setSession(updated);
    } else if (session) {
      setSession({ ...session, activeOrgId: orgId, activeTripId: null });
    }
  };

  const handleSelectTrip = async (
    trip: MobileTrip,
    client: FieldTrackMobileApiClient
  ) => {
    setSelectedTrip(trip);
    setSelectedApiClient(client);
    const updated = await MobileAuthService.updateActiveSelection({
      activeTripId: trip.id,
    });
    if (updated) {
      setSession(updated);
    }
  };

  const handleBackToTrips = async () => {
    await GeofenceManager.stopGeofencing();
    setSelectedTrip(null);
    setSelectedApiClient(null);
    const updated = await MobileAuthService.updateActiveSelection({
      activeTripId: null,
    });
    if (updated) {
      setSession(updated);
    }
  };

  const handleSignOut = async () => {
    await GeofenceManager.stopGeofencing();
    await MobileAuthService.clearSession();
    setSelectedTrip(null);
    setSelectedApiClient(null);
    setSession(null);
  };

  return (
    <View style={styles.safeArea}>
      {selectedTrip && selectedApiClient ? (
        <ActiveTripScreen
          trip={selectedTrip}
          apiClient={selectedApiClient}
          currentUserId={session?.user.id}
          onBackToTrips={
            activeTrip && apiClient ? undefined : handleBackToTrips
          }
          onSignOut={activeTrip && apiClient ? undefined : handleSignOut}
          onTripUpdated={(updated) => setSelectedTrip(updated)}
        />
      ) : isRestoringSession ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>
            Initializing FieldTrack Mobile…
          </Text>
        </View>
      ) : session ? (
        <TripSelectorScreen
          session={session}
          onSelectOrganization={handleSelectOrganization}
          onSelectTrip={handleSelectTrip}
          onSignOut={handleSignOut}
        />
      ) : (
        <SignInScreen onSignedIn={handleSignedIn} />
      )}
    </View>
  );
}

export default App;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
  },
});
