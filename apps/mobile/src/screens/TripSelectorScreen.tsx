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
import { MOBILE_THEME } from "../theme";
import type { MobileAuthSession, MobileTrip, MobileTripSummary } from "../types";

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
            refreshed.activeOrgId ?? refreshed.organizations[0]?.organization.id ?? null;
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
      setErrorMessage(err instanceof Error ? err.message : "Failed to load field trips.");
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
      setErrorMessage(err instanceof Error ? err.message : "Failed to create workspace.");
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
      t.status === "draft" || t.status === "submitted" || t.status === "changes_requested"
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
                  style={[styles.orgPill, isSelected ? styles.orgPillSelected : null]}
                  onPress={() => onSelectOrganization(membership.organization.id)}
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
            Your account does not belong to an active organization workspace yet. Create a
            workspace or accept an invitation token below, or tap Refresh.
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
                {isOnboardingSubmitting ? "Working…" : "Create Organization Workspace"}
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

      {/* Compact 2-Column Mobile KPI Grid (Section 2) */}
      <View style={styles.kpiGridRow}>
        <View style={styles.kpiCompactCard}>
          <View style={styles.kpiCompactHeader}>
            <View style={[styles.kpiDot, { backgroundColor: MOBILE_THEME.colors.electricBlue }]} />
            <Text style={styles.kpiCompactLabel}>Active Routes</Text>
          </View>
          <Text style={styles.kpiCompactValue}>{executableTrips.length}</Text>
          <Text style={styles.kpiCompactSub}>Authorized &amp; ready</Text>
        </View>
        <View style={styles.kpiCompactCard}>
          <View style={styles.kpiCompactHeader}>
            <View style={[styles.kpiDot, { backgroundColor: MOBILE_THEME.colors.emeraldLive }]} />
            <Text style={styles.kpiCompactLabel}>Store Geofence</Text>
          </View>
          <Text style={styles.kpiCompactValue}>150m</Text>
          <Text style={styles.kpiCompactSub}>60s GPS cadence</Text>
        </View>
      </View>

      {/* Reference Dark Obsidian Field Summary Card (Section 3) */}
      <View style={styles.heroObsidianCard}>
        <View style={styles.heroHeaderRow}>
          <View>
            <Text style={styles.heroEyebrow}>Field Operations Summary</Text>
            <Text style={styles.heroValue}>{executableTrips.length} Active Routes</Text>
          </View>
          <View style={styles.heroLivePill}>
            <Text style={styles.heroLivePillText}>● 60s GPS</Text>
          </View>
        </View>
        <Text style={styles.heroSubtitle}>
          150m store geofencing • {pendingOrDraftCount} pending/draft itineraries
        </Text>
        <View style={styles.heroBarTrack}>
          <View
            style={[
              styles.heroBarPrimary,
              {
                flex: Math.max(1, executableTrips.length),
              },
            ]}
          />
          <View
            style={[
              styles.heroBarSecondary,
              {
                flex: Math.max(1, pendingOrDraftCount),
              },
            ]}
          />
        </View>
      </View>

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
            ℹ️ You also have {pendingOrDraftCount} trip(s) in draft/submitted status. Only
            manager-approved or in-progress trips can activate store geofencing.
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
          <Text style={styles.emptyTitle}>No Approved or In-Progress Trips Found</Text>
          <Text style={styles.emptySubtitle}>
            To start smart store geofencing, create a trip with store stops in FieldTrack
            and have a manager approve it. Once approved, tap Refresh above.
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
    backgroundColor: MOBILE_THEME.colors.canvasBg,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  userCol: {
    flex: 1,
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: MOBILE_THEME.colors.textSecondary,
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
  },
  orgRow: {
    marginBottom: 12,
  },
  orgLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  orgPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orgPill: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
    borderRadius: MOBILE_THEME.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  orgPillSelected: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderColor: MOBILE_THEME.colors.electricBlue,
  },
  orgPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textSecondary,
  },
  orgPillTextSelected: {
    color: "#ffffff",
  },
  heroObsidianCard: {
    backgroundColor: MOBILE_THEME.colors.obsidianHero,
    borderRadius: MOBILE_THEME.radii.hero,
    padding: 15,
    marginBottom: 12,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLivePill: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroLivePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: MOBILE_THEME.colors.emeraldLive,
  },
  kpiGridRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  kpiCompactCard: {
    flex: 1,
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderRadius: MOBILE_THEME.radii.card,
    padding: 12,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
  },
  kpiCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  kpiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  kpiCompactLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textSecondary,
  },
  kpiCompactValue: {
    fontSize: 20,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
  },
  kpiCompactSub: {
    fontSize: 11,
    color: MOBILE_THEME.colors.textMuted,
    marginTop: 1,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: MOBILE_THEME.colors.periwinkle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.68)",
    marginTop: 2,
    marginBottom: 10,
  },
  heroBarTrack: {
    flexDirection: "row",
    height: 8,
    gap: 6,
  },
  heroBarPrimary: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderRadius: 999,
  },
  heroBarSecondary: {
    backgroundColor: MOBILE_THEME.colors.periwinkle,
    borderRadius: 999,
  },
  warningBox: {
    backgroundColor: MOBILE_THEME.colors.warningSoft,
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: MOBILE_THEME.colors.warningText,
    lineHeight: 17,
  },
  onboardingCard: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  onboardingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 6,
  },
  onboardingInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 6,
  },
  onboardingBtn: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderRadius: MOBILE_THEME.radii.pill,
    paddingVertical: 9,
    alignItems: "center",
  },
  onboardingBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  onboardingSecondaryBtn: {
    backgroundColor: MOBILE_THEME.colors.canvasBg,
    borderRadius: MOBILE_THEME.radii.pill,
    paddingVertical: 9,
    alignItems: "center",
  },
  onboardingSecondaryBtnText: {
    color: MOBILE_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: MOBILE_THEME.colors.dangerSoft,
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: MOBILE_THEME.colors.electricBlueSoft,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.electricBlue,
  },
  infoBanner: {
    backgroundColor: "#ffffff",
    borderColor: MOBILE_THEME.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  infoBannerText: {
    fontSize: 11,
    color: MOBILE_THEME.colors.textSecondary,
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
    color: MOBILE_THEME.colors.textSecondary,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderRadius: MOBILE_THEME.radii.card,
    padding: 20,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: MOBILE_THEME.colors.textSecondary,
    lineHeight: 19,
  },
  listContent: {
    paddingBottom: 24,
  },
  tripCard: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderRadius: MOBILE_THEME.radii.card,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
  },
  tripCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tripTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
    marginRight: 8,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MOBILE_THEME.radii.pill,
  },
  statusApproved: {
    backgroundColor: MOBILE_THEME.colors.emeraldSoft,
    color: MOBILE_THEME.colors.emeraldText,
  },
  statusInProgress: {
    backgroundColor: MOBILE_THEME.colors.electricBlueSoft,
    color: MOBILE_THEME.colors.electricBlue,
  },
  tripDates: {
    fontSize: 12,
    color: MOBILE_THEME.colors.textSecondary,
    marginBottom: 4,
  },
  tripPurpose: {
    fontSize: 12,
    color: MOBILE_THEME.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  selectTripBtn: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderRadius: MOBILE_THEME.radii.pill,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
  },
  selectTripBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
