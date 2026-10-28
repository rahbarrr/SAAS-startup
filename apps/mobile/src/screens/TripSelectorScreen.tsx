import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FieldTrackMobileApiClient } from "../services/api";
import { MobileAuthService } from "../services/auth";
import type {
  MobileAuthSession,
  MobileTrip,
  MobileTripSummary,
} from "../types";

export interface TripSelectorScreenProps {
  session: MobileAuthSession;
  onSessionUpdated?: (session: MobileAuthSession) => void;
  onSelectOrganization: (orgId: string) => void;
  onSelectTrip: (trip: MobileTrip, apiClient: FieldTrackMobileApiClient) => void;
  onSignOut: () => void;
}

export function TripSelectorScreen({
  session,
  onSessionUpdated,
  onSelectOrganization,
  onSelectTrip,
  onSignOut,
}: TripSelectorScreenProps): React.JSX.Element {
  const [trips, setTrips] = useState<MobileTripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [orgSlugInput, setOrgSlugInput] = useState("");
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);

  const activeOrgId =
    session.activeOrgId ?? session.organizations[0]?.organization.id ?? null;

  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let resolvedOrgId = activeOrgId;
      if (!resolvedOrgId) {
        const refreshed = await MobileAuthService.refreshOrganizations(session);
        if (refreshed) {
          onSessionUpdated?.(refreshed);
          resolvedOrgId =
            refreshed.activeOrgId ??
            refreshed.organizations[0]?.organization.id ??
            null;
        }
      }

      if (!resolvedOrgId) {
        setTrips([]);
        return;
      }

      const client = new FieldTrackMobileApiClient({
        baseUrl: session.baseUrl,
        authToken: session.accessToken,
        orgId: resolvedOrgId,
      });

      const allUserTrips = await client.listTrips({
        ownerUserId: session.user.id,
        limit: 50,
      });
      setTrips(allUserTrips);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load field trips."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, onSessionUpdated, session]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleCreateWorkspace = async () => {
    const trimmedName = orgNameInput.trim();
    const derivedSlug = (
      orgSlugInput.trim() ||
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    ).slice(0, 64);

    if (trimmedName.length < 2) {
      setErrorMessage("Please enter an organization name (at least 2 characters).");
      return;
    }

    setIsOnboardingSubmitting(true);
    setErrorMessage(null);
    try {
      const client = new FieldTrackMobileApiClient({
        baseUrl: session.baseUrl,
        authToken: session.accessToken,
        orgId: "",
      });
      await client.createOrganization({
        name: trimmedName,
        slug: derivedSlug,
      });
      const refreshed = await MobileAuthService.refreshOrganizations(session);
      if (refreshed) {
        onSessionUpdated?.(refreshed);
      }
      setOrgNameInput("");
      setOrgSlugInput("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create workspace."
      );
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  const handleAcceptInviteToken = async () => {
    const token = inviteTokenInput.trim();
    if (!token) {
      setErrorMessage("Please paste your workspace invitation token.");
      return;
    }

    setIsOnboardingSubmitting(true);
    setErrorMessage(null);
    try {
      const client = new FieldTrackMobileApiClient({
        baseUrl: session.baseUrl,
        authToken: session.accessToken,
        orgId: "",
      });
      await client.acceptInvitation({ token });
      const refreshed = await MobileAuthService.refreshOrganizations(session);
      if (refreshed) {
        onSessionUpdated?.(refreshed);
      }
      setInviteTokenInput("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to accept invitation."
      );
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  const handleOpenTrip = async (summary: MobileTripSummary) => {
    if (!activeOrgId) return;
    setLoadingTripId(summary.id);
    setErrorMessage(null);
    try {
      const client = new FieldTrackMobileApiClient({
        baseUrl: session.baseUrl,
        authToken: session.accessToken,
        orgId: activeOrgId,
      });
      const executableTrip = await client.getExecutableTrip(summary.id);
      onSelectTrip(executableTrip, client);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to load trip stops and store coordinates."
      );
    } finally {
      setLoadingTripId(null);
    }
  };

  const executableTrips = trips.filter(
    (t) =>
      (t.status === "approved" || t.status === "in_progress") &&
      t.ownerUserId === session.user.id
  );
  const pendingOrDraftCount = trips.filter(
    (t) =>
      t.status === "draft" ||
      t.status === "submitted" ||
      t.status === "changes_requested"
  ).length;

  return (
    <View style={styles.container}>
      {/* User & Workspace Bar */}
      <View style={styles.topBar}>
        <View style={styles.userCol}>
          <Text style={styles.screenTitle}>Select Active Field Trip</Text>
          <Text style={styles.userEmail}>{session.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Organization Selector */}
      {session.organizations.length > 0 ? (
        <View style={styles.orgRow}>
          <Text style={styles.orgLabel}>Workspace:</Text>
          <View style={styles.orgPills}>
            {session.organizations.map((membership) => {
              const isSelected = membership.organization.id === activeOrgId;
              return (
                <TouchableOpacity
                  key={membership.organization.id}
                  style={[
                    styles.orgPill,
                    isSelected ? styles.orgPillSelected : null,
                  ]}
                  onPress={() =>
                    onSelectOrganization(membership.organization.id)
                  }
                >
                  <Text
                    style={[
                      styles.orgPillText,
                      isSelected ? styles.orgPillTextSelected : null,
                    ]}
                  >
                    {membership.organization.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Your account does not belong to an active organization workspace yet.
            Create a workspace or accept an invitation token below, or tap Refresh.
          </Text>

          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>Create Workspace</Text>
            <TextInput
              style={styles.onboardingInput}
              value={orgNameInput}
              onChangeText={setOrgNameInput}
              placeholder="Organization name (e.g. Apex Field Ops)"
              placeholderTextColor="#94a3b8"
              editable={!isOnboardingSubmitting}
            />
            <TextInput
              style={styles.onboardingInput}
              value={orgSlugInput}
              onChangeText={setOrgSlugInput}
              placeholder="Slug (optional, e.g. apex-field-ops)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              editable={!isOnboardingSubmitting}
            />
            <TouchableOpacity
              style={styles.onboardingBtn}
              onPress={handleCreateWorkspace}
              disabled={isOnboardingSubmitting}
            >
              <Text style={styles.onboardingBtnText}>
                {isOnboardingSubmitting
                  ? "Working…"
                  : "Create Organization Workspace"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.onboardingTitle, { marginTop: 10 }]}>
              Or Accept Invitation Token
            </Text>
            <TextInput
              style={styles.onboardingInput}
              value={inviteTokenInput}
              onChangeText={setInviteTokenInput}
              placeholder="Paste invitation token"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              editable={!isOnboardingSubmitting}
            />
            <TouchableOpacity
              style={styles.onboardingSecondaryBtn}
              onPress={handleAcceptInviteToken}
              disabled={isOnboardingSubmitting}
            >
              <Text style={styles.onboardingSecondaryBtnText}>
                Accept Workspace Invitation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Authorized Trips ({executableTrips.length})
        </Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadTrips}
          disabled={isLoading}
        >
          <Text style={styles.refreshBtnText}>
            {isLoading ? "Refreshing…" : "↻ Refresh"}
          </Text>
        </TouchableOpacity>
      </View>

      {pendingOrDraftCount > 0 ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ℹ️ You also have {pendingOrDraftCount} trip(s) in draft/submitted
            status. Only manager-approved or in-progress trips can activate
            store geofencing.
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.stateText}>Loading your field trips…</Text>
        </View>
      ) : executableTrips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No Approved or In-Progress Trips Found
          </Text>
          <Text style={styles.emptySubtitle}>
            To start smart store geofencing, create a trip with store stops in
            FieldTrack and have a manager approve it. Once approved, tap Refresh
            above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={executableTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isOpening = loadingTripId === item.id;
            return (
              <View style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <Text style={styles.tripTitle}>{item.title}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      item.status === "in_progress"
                        ? styles.statusInProgress
                        : styles.statusApproved,
                    ]}
                  >
                    {item.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.tripDates}>
                  📅 {item.startDate} → {item.endDate}
                </Text>
                {item.purpose ? (
                  <Text style={styles.tripPurpose} numberOfLines={2}>
                    {item.purpose}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.selectTripBtn}
                  onPress={() => handleOpenTrip(item)}
                  disabled={loadingTripId !== null}
                >
                  <Text style={styles.selectTripBtnText}>
                    {isOpening
                      ? "Loading Stops & Coordinates…"
                      : "Open Trip & Configure Geofencing →"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
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
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userCol: {
    flex: 1,
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0f172a",
  },
  userEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  orgRow: {
    marginBottom: 12,
  },
  orgLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  orgPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orgPill: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  orgPillSelected: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  orgPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  orgPillTextSelected: {
    color: "#ffffff",
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },
  onboardingCard: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  onboardingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  onboardingInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: "#0f172a",
    marginBottom: 6,
  },
  onboardingBtn: {
    backgroundColor: "#0284c7",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  onboardingBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  onboardingSecondaryBtn: {
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  onboardingSecondaryBtnText: {
    color: "#1e293b",
    fontSize: 12,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e0f2fe",
    borderRadius: 6,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369a1",
  },
  infoBanner: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  infoBannerText: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
  },
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  stateText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
  },
  listContent: {
    paddingBottom: 24,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tripCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  tripTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginRight: 8,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusApproved: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  statusInProgress: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
  },
  tripDates: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  tripPurpose: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 17,
  },
  selectTripBtn: {
    backgroundColor: "#0284c7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  selectTripBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});

