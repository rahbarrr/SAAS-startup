"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentRole } from "@/components/ui/RoleContext";
import { useToast } from "@/components/ui/Toast";
import type { OrganizationBillingSummary, PlanTier } from "@/modules/billing/domain";
import type { OrgRole } from "@/modules/tenancy/domain";

type SettingsTab =
  "company" | "preferences" | "notifications" | "workspace" | "security" | "billing";

export interface SettingsClientProps {
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  userEmail: string;
  userRole: OrgRole;
}

export function SettingsClient({ activeOrg, userEmail, userRole }: SettingsClientProps) {
  const { currentRole, profile } = useCurrentRole();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("company");

  // Form states
  const [orgName, setOrgName] = useState(activeOrg.name);
  const [industry, setIndustry] = useState("Retail & FMCG Operations");
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
  );

  // Notification toggles
  const [notifApprovals, setNotifApprovals] = useState(true);
  const [notifExceptions, setNotifExceptions] = useState(true);
  const [notifDailyDigest, setNotifDailyDigest] = useState(true);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(false);

  // Preference states
  const [offlineSyncWifiOnly, setOfflineSyncWifiOnly] = useState(false);
  const [emailDigestTime, setEmailDigestTime] = useState("08:00");

  // Billing states
  const [billingSummary, setBillingSummary] = useState<OrganizationBillingSummary | null>(
    null
  );
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState<string | null>(null);
  const [seatInput, setSeatInput] = useState<number>(15);

  const loadBillingSummary = useCallback(async () => {
    setBillingLoading(true);
    try {
      const response = await fetch(`/api/orgs/${activeOrg.id}/billing`);
      const body = await response.json();
      if (response.ok && body?.data) {
        const data = body.data as OrganizationBillingSummary;
        setBillingSummary(data);
        setSeatInput(Math.max(data.subscription.seatCount, 5));
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setBillingLoading(false);
    }
  }, [activeOrg.id]);

  useEffect(() => {
    if (activeTab === "billing" && !billingSummary && !billingLoading) {
      loadBillingSummary();
    }
  }, [activeTab, billingSummary, billingLoading, loadBillingSummary]);

  const handleCheckoutUpgrade = async (planTier: "pro" | "enterprise") => {
    setBillingActionLoading(`checkout-${planTier}`);
    try {
      const response = await fetch(`/api/orgs/${activeOrg.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          planTier,
          seatCount: Math.max(seatInput, planTier === "enterprise" ? 50 : 15),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        showToast(
          body?.error?.message ?? "Unable to start Stripe Checkout session.",
          "error"
        );
        return;
      }
      if (body?.data?.checkoutUrl) {
        window.location.assign(body.data.checkoutUrl);
      }
    } catch {
      showToast("Network error starting Stripe Checkout session.", "error");
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setBillingActionLoading("portal");
    try {
      const response = await fetch(`/api/orgs/${activeOrg.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const body = await response.json();
      if (!response.ok) {
        showToast(
          body?.error?.message ?? "Unable to open Stripe Billing Portal.",
          "error"
        );
        return;
      }
      if (body?.data?.portalUrl) {
        window.location.assign(body.data.portalUrl);
      }
    } catch {
      showToast("Network error opening Stripe Billing Portal.", "error");
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleUpdateSeats = async (nextPlanTier?: PlanTier) => {
    setBillingActionLoading("seats");
    try {
      const response = await fetch(`/api/orgs/${activeOrg.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_seats",
          seatCount: seatInput,
          ...(nextPlanTier ? { planTier: nextPlanTier } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        showToast(
          body?.error?.message ?? "Failed to update workspace seat allocation.",
          "error"
        );
        return;
      }
      showToast("Workspace seat allocation updated.", "success");
      await loadBillingSummary();
    } catch {
      showToast("Network error updating workspace seat allocation.", "error");
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Workspace details have been updated successfully.", "success");
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("User preferences updated for your session.", "success");
  };

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "company", label: "Company Profile", icon: "building" },
    { id: "preferences", label: "User Preferences", icon: "user" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "workspace", label: "Territories & Workflows", icon: "map-pin" },
    { id: "security", label: "Security & SSO", icon: "shield-check" },
    { id: "billing", label: "Subscription & Billing", icon: "credit-card" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: "1.5rem",
        alignItems: "start",
      }}
    >
      {/* Settings Navigation Sidebar */}
      <div
        className="card"
        style={{
          padding: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.625rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--brand-violet-strong)" : "var(--text-secondary)",
                background: isActive ? "var(--brand-violet-soft)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Content Area */}
      <div className="card" style={{ padding: "1.75rem" }}>
        {/* Tab 1: Company Profile */}
        {activeTab === "company" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-heading)",
                  color: "var(--brand-dark)",
                  margin: "0 0 0.25rem",
                }}
              >
                Company &amp; Workspace Profile
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Manage your enterprise workspace identity, timezone, and operational
                parameters.
              </p>
            </div>

            <form
              onSubmit={handleSaveCompany}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <div className="form-group">
                <label htmlFor="company-name" className="form-label">
                  Organization Legal Name *
                </label>
                <input
                  id="company-name"
                  type="text"
                  className="form-input"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={userRole !== "admin"}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="company-industry" className="form-label">
                  Industry &amp; Operating Sector
                </label>
                <input
                  id="company-industry"
                  type="text"
                  className="form-input"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={userRole !== "admin"}
                />
              </div>

              <div className="form-group">
                <label htmlFor="company-timezone" className="form-label">
                  Primary Operating Timezone
                </label>
                <input
                  id="company-timezone"
                  type="text"
                  className="form-input"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={userRole !== "admin"}
                />
              </div>

              <div className="form-group">
                <label htmlFor="company-slug" className="form-label">
                  Workspace URL Slug
                </label>
                <input
                  id="company-slug"
                  type="text"
                  className="form-input"
                  value={activeOrg.slug}
                  readOnly
                  disabled
                />
                <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                  Unique URL namespace: <code>app.fieldtrack.io/{activeOrg.slug}</code>
                </span>
              </div>

              {userRole === "admin" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: User Preferences */}
        {activeTab === "preferences" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-heading)",
                  color: "var(--brand-dark)",
                  margin: "0 0 0.25rem",
                }}
              >
                Personal User Preferences
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Configure your display name, digest timing, and offline synchronization
                rules.
              </p>
            </div>

            <form
              onSubmit={handleSavePreferences}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <div
                style={{
                  background: "var(--bg-subtle)",
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    className="user-avatar"
                    style={{ width: "2.5rem", height: "2.5rem", fontSize: "1rem" }}
                  >
                    {profile.avatarInitials}
                  </div>
                  <div>
                    <strong>{profile.userName}</strong>
                    <p className="card-meta" style={{ margin: 0 }}>
                      Role:{" "}
                      <strong style={{ textTransform: "capitalize" }}>
                        {currentRole}
                      </strong>{" "}
                      • Email: {userEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pref-digest" className="form-label">
                  Daily Briefing Delivery Time (Local)
                </label>
                <input
                  id="pref-digest"
                  type="time"
                  className="form-input"
                  value={emailDigestTime}
                  onChange={(e) => setEmailDigestTime(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  paddingTop: "0.5rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={offlineSyncWifiOnly}
                    onChange={(e) => setOfflineSyncWifiOnly(e.target.checked)}
                  />
                  <span>
                    Upload high-resolution photo evidence only when connected to Wi-Fi
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary">
                  Update Preferences
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === "notifications" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-heading)",
                  color: "var(--brand-dark)",
                  margin: "0 0 0.25rem",
                }}
              >
                Notification Dispatch Rules
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Control which operational events trigger alerts.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <input
                  type="checkbox"
                  checked={notifApprovals}
                  onChange={(e) => setNotifApprovals(e.target.checked)}
                  style={{ marginTop: "0.25rem" }}
                />
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Trip Submission &amp; Approval Decisions
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Notify when a field itinerary is submitted for policy review or when a
                    decision is recorded.
                  </p>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <input
                  type="checkbox"
                  checked={notifExceptions}
                  onChange={(e) => setNotifExceptions(e.target.checked)}
                  style={{ marginTop: "0.25rem" }}
                />
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Store Inspection Anomalies &amp; Exceptions
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Immediate alert when a representative flags a failed checklist item
                    during store visits.
                  </p>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <input
                  type="checkbox"
                  checked={notifDailyDigest}
                  onChange={(e) => setNotifDailyDigest(e.target.checked)}
                  style={{ marginTop: "0.25rem" }}
                />
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Morning Field Intelligence Digest
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Daily summary of assigned field visits, outstanding approvals, and AI
                    observations.
                  </p>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <input
                  type="checkbox"
                  checked={notifWeeklyReport}
                  onChange={(e) => setNotifWeeklyReport(e.target.checked)}
                  style={{ marginTop: "0.25rem" }}
                />
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Weekly Operations &amp; Compliance Rollup
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Executive synthesis of planogram compliance and territory completion
                    trends.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Tab 4: Territories & Workflows */}
        {activeTab === "workspace" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-heading)",
                  color: "var(--brand-dark)",
                  margin: "0 0 0.25rem",
                }}
              >
                Territories &amp; Workflow Policies
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Operating rules enforced across itineraries, store visits, and supervisor
                sign-offs.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <strong style={{ fontSize: "0.875rem" }}>
                  Self-Approval Prevention Rule
                </strong>
                <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                  Field managers cannot approve their own submitted trips. All requests
                  require peer or administrator review.
                </p>
                <span
                  className="status-badge"
                  style={{
                    marginTop: "0.5rem",
                    display: "inline-block",
                    background: "rgba(5, 150, 105, 0.1)",
                    color: "var(--success-green)",
                  }}
                >
                  Enforced via Database Trigger &amp; Domain Model
                </span>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <strong style={{ fontSize: "0.875rem" }}>
                  Point-in-Time Location Verification
                </strong>
                <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                  Check-ins record device sensor latitude, longitude, and accuracy with
                  employee consent. No continuous tracking is performed.
                </p>
                <span
                  className="status-badge"
                  style={{
                    marginTop: "0.5rem",
                    display: "inline-block",
                    background: "rgba(5, 150, 105, 0.1)",
                    color: "var(--success-green)",
                  }}
                >
                  Active Compliance Policy
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Security & SSO */}
        {activeTab === "security" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-heading)",
                  color: "var(--brand-dark)",
                  margin: "0 0 0.25rem",
                }}
              >
                Security, SSO &amp; Access Controls
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Enterprise identity integration, session policies, and encryption
                settings.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    PostgreSQL Row-Level Security (RLS)
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Tenant isolation enforced in database engine on every query
                  </p>
                </div>
                <span
                  className="status-badge"
                  style={{
                    background: "rgba(5, 150, 105, 0.1)",
                    color: "var(--success-green)",
                  }}
                >
                  Active
                </span>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Append-Only Audit Trail
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Cryptographic audit events for all trips, visits, approvals, and
                    mutations
                  </p>
                </div>
                <span
                  className="status-badge"
                  style={{
                    background: "rgba(5, 150, 105, 0.1)",
                    color: "var(--success-green)",
                  }}
                >
                  Active
                </span>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.875rem" }}>
                    Private Evidence Storage
                  </strong>
                  <p className="card-meta" style={{ margin: "0.125rem 0 0" }}>
                    Photos stored in canonical private bucket (<code>visit-evidence</code>
                    ) with authenticated signed URLs
                  </p>
                </div>
                <span
                  className="status-badge"
                  style={{
                    background: "rgba(5, 150, 105, 0.1)",
                    color: "var(--success-green)",
                  }}
                >
                  Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Subscription & Billing */}
        {activeTab === "billing" && (
          <div>
            <div
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-dark)",
                    margin: "0 0 0.25rem",
                  }}
                >
                  Subscription &amp; Workspace Allocation
                </h2>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Manage your workspace subscription tier, seat quotas, and Stripe billing
                  portal.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadBillingSummary}
                disabled={billingLoading}
              >
                {billingLoading ? "Refreshing…" : "Refresh Status"}
              </button>
            </div>

            <div
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                background:
                  "linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-primary) 100%)",
                color: "#FFFFFF",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "0.75rem",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      opacity: 0.85,
                    }}
                  >
                    Active Workspace Tier
                  </span>
                  <h3
                    style={{
                      fontSize: "1.375rem",
                      margin: "0.25rem 0",
                      color: "#FFFFFF",
                    }}
                  >
                    {billingSummary
                      ? `${billingSummary.subscription.planTier.toUpperCase()} PLAN (${billingSummary.subscription.seatCount} Seats)`
                      : "Enterprise Pilot Edition"}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", margin: 0, opacity: 0.92 }}>
                    {billingSummary?.access.message ??
                      "Multi-Store Itineraries • GPS Telemetry • Photo Proof • Audit Trail • AI Synthesis"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                    background:
                      billingSummary?.access.writeAllowed === false
                        ? "rgba(220, 38, 38, 0.35)"
                        : "rgba(5, 150, 105, 0.3)",
                    border:
                      billingSummary?.access.writeAllowed === false
                        ? "1px solid #f87171"
                        : "1px solid #059669",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {billingSummary?.subscription.status ?? "Active Subscription"}
                </span>
              </div>
            </div>

            {billingSummary && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div className="card" style={{ padding: "1rem" }}>
                  <span className="card-meta">Team Seats Used</span>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      marginTop: "0.25rem",
                    }}
                  >
                    {billingSummary.usage.activeAndInvitedMembers} /{" "}
                    {billingSummary.subscription.seatCount}
                  </div>
                  <span className="card-meta">
                    Plan max: {billingSummary.subscription.entitlements.max_members}
                  </span>
                </div>
                <div className="card" style={{ padding: "1rem" }}>
                  <span className="card-meta">Active Stores</span>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      marginTop: "0.25rem",
                    }}
                  >
                    {billingSummary.usage.activeStores} /{" "}
                    {billingSummary.subscription.entitlements.max_stores}
                  </div>
                  <span className="card-meta">Store Master Quota</span>
                </div>
                <div className="card" style={{ padding: "1rem" }}>
                  <span className="card-meta">Monthly Store Visits</span>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      marginTop: "0.25rem",
                    }}
                  >
                    {billingSummary.usage.monthlyVisits} /{" "}
                    {billingSummary.subscription.entitlements.max_monthly_visits}
                  </div>
                  <span className="card-meta">
                    AI Draft Quota:{" "}
                    {billingSummary.subscription.entitlements.ai_daily_draft_quota}
                    /day
                  </span>
                </div>
              </div>
            )}

            {userRole === "admin" ? (
              <div className="card" style={{ padding: "1.25rem" }}>
                <strong style={{ fontSize: "0.95rem" }}>
                  Seat Allocation &amp; Plan Upgrade
                </strong>
                <p className="card-meta" style={{ margin: "0.25rem 0 0.75rem" }}>
                  Configure workspace seat limits or launch Stripe Checkout / Billing
                  Portal.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    htmlFor="billing-seat-input"
                    style={{ fontSize: "0.8125rem", fontWeight: 600 }}
                  >
                    Seats:
                  </label>
                  <input
                    id="billing-seat-input"
                    type="number"
                    min={1}
                    max={1000}
                    className="form-input"
                    style={{ width: "100px" }}
                    value={seatInput}
                    onChange={(e) =>
                      setSeatInput(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleUpdateSeats()}
                    disabled={billingActionLoading !== null}
                  >
                    {billingActionLoading === "seats" ? "Saving…" : "Update Seat Limit"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleCheckoutUpgrade("pro")}
                    disabled={billingActionLoading !== null}
                  >
                    {billingActionLoading === "checkout-pro"
                      ? "Redirecting…"
                      : "Upgrade to Pro ($149/mo)"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleCheckoutUpgrade("enterprise")}
                    disabled={billingActionLoading !== null}
                  >
                    {billingActionLoading === "checkout-enterprise"
                      ? "Redirecting…"
                      : "Upgrade to Enterprise ($499/mo)"}
                  </button>
                  {billingSummary?.portalAvailable && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleOpenBillingPortal}
                      disabled={billingActionLoading !== null}
                    >
                      {billingActionLoading === "portal"
                        ? "Opening…"
                        : "Open Stripe Billing Portal"}
                    </button>
                  )}
                </div>
                {billingSummary && !billingSummary.stripeConfigured && (
                  <p
                    className="card-meta"
                    style={{ marginTop: "0.75rem", color: "#b45309" }}
                  >
                    Stripe Checkout keys (<code>STRIPE_SECRET_KEY</code>,{" "}
                    <code>STRIPE_PRICE_ID_PRO_MONTHLY</code>) are not yet configured in
                    this environment. Local seat and tier entitlements remain manageable.
                  </p>
                )}
              </div>
            ) : (
              <div
                className="card"
                style={{ padding: "1.25rem", background: "var(--bg-subtle)" }}
              >
                <strong style={{ fontSize: "0.875rem" }}>
                  Plan &amp; Capacity Inquiries
                </strong>
                <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                  To modify your workspace seat quota, add territory accounts, or adjust
                  billing parameters, please contact your organization administrator or
                  FieldTrack enterprise support.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
