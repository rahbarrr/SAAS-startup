import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MobileAuthService, resolveDefaultApiBaseUrl } from "../services/auth";
import { MOBILE_THEME } from "../theme";
import type { MobileAuthSession } from "../types";

export interface SignInScreenProps {
  initialBaseUrl?: string;
  onSignedIn: (session: MobileAuthSession) => void;
}

export function SignInScreen({
  initialBaseUrl,
  onSignedIn,
}: SignInScreenProps): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(() => {
    if (initialBaseUrl) return initialBaseUrl;
    const metroScriptUrl = (
      NativeModules as Record<string, { scriptURL?: string } | undefined>
    )?.SourceCode?.scriptURL;
    return resolveDefaultApiBaseUrl({ metroScriptUrl });
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const session = await MobileAuthService.signInWithPassword({
        baseUrl,
        email,
        password,
      });
      onSignedIn(session);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please verify your credentials and server URL."
      );
      setShowServerConfig(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandHeader}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeLetter}>F</Text>
          </View>
          <Text style={styles.title}>FieldTrack Mobile Companion</Text>
          <Text style={styles.subtitle}>
            Sign in and select an approved or in-progress field trip to enable smart store
            geofence check-in and check-out.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to your account</Text>
          <Text style={styles.cardMeta}>
            Access your organization’s approved field itineraries and store geofences.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Sign-In Error</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Work Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.serverSection}>
            <TouchableOpacity
              style={styles.serverToggleBtn}
              onPress={() => setShowServerConfig((prev) => !prev)}
              disabled={isSubmitting}
            >
              <Text style={styles.serverToggleText}>
                {showServerConfig ? "▼" : "▶"} FieldTrack Server:{" "}
                <Text style={styles.serverUrlPreview}>{baseUrl}</Text>
              </Text>
            </TouchableOpacity>

            {showServerConfig ? (
              <View style={styles.serverConfigBox}>
                <Text style={styles.label}>FieldTrack API Base URL</Text>
                <TextInput
                  style={styles.input}
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  placeholder="http://192.168.1.10:3000 or https://your-app.vercel.app"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!isSubmitting}
                />
                <Text style={styles.helperText}>
                  For local development on a physical Android device, ensure `npm run dev`
                  is running on your computer (port 3000) or enter your deployed Vercel
                  URL.
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting ? styles.submitBtnDisabled : null]}
            onPress={handleSignIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.submitBtnText}>Signing in…</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Sign In to Workspace</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrapper: {
    flex: 1,
    backgroundColor: MOBILE_THEME.colors.canvasBg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 22,
  },
  brandBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  brandBadgeLetter: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: MOBILE_THEME.colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    backgroundColor: MOBILE_THEME.colors.surfaceCard,
    borderRadius: MOBILE_THEME.radii.card,
    padding: 22,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: MOBILE_THEME.colors.textSecondary,
    marginBottom: 18,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: MOBILE_THEME.colors.dangerSoft,
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.dangerText,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: MOBILE_THEME.colors.textPrimary,
    marginBottom: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: MOBILE_THEME.colors.electricBlue,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderStrong,
    borderRadius: MOBILE_THEME.radii.input,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: MOBILE_THEME.colors.textPrimary,
    backgroundColor: "#FAFAFC",
  },
  serverSection: {
    marginBottom: 18,
    borderTopWidth: 1,
    borderTopColor: MOBILE_THEME.colors.borderSubtle,
    paddingTop: 12,
  },
  serverToggleBtn: {
    paddingVertical: 4,
  },
  serverToggleText: {
    fontSize: 12,
    color: MOBILE_THEME.colors.textSecondary,
    fontWeight: "600",
  },
  serverUrlPreview: {
    color: MOBILE_THEME.colors.electricBlue,
    fontWeight: "600",
  },
  serverConfigBox: {
    marginTop: 8,
    backgroundColor: MOBILE_THEME.colors.canvasBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MOBILE_THEME.colors.borderSubtle,
  },
  helperText: {
    fontSize: 11,
    color: MOBILE_THEME.colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: MOBILE_THEME.colors.electricBlue,
    borderRadius: MOBILE_THEME.radii.pill,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
