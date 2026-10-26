"use client";

import { useState } from "react";
import { useCurrentRole } from "@/components/ui/RoleContext";
import { useToast } from "@/components/ui/Toast";
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
                color: isActive ? "var(--brand-primary)" : "var(--text-secondary)",
                background: isActive ? "rgba(27, 53, 128, 0.08)" : "transparent",
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
            <div style={{ marginBottom: "1.5rem" }}>
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
                Enterprise contract details and workspace management.
              </p>
            </div>

            <div
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                background:
                  "linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-primary) 100%)",
                color: "#FFFFFF",
                marginBottom: "1.5rem",
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
                      opacity: 0.8,
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
                    Enterprise Pilot Edition
                  </h3>
                  <p style={{ fontSize: "0.8125rem", margin: 0, opacity: 0.9 }}>
                    Multi-Store Itineraries • GPS Telemetry • Photo Proof • Audit Trail •
                    AI Synthesis
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                    background: "rgba(5, 150, 105, 0.3)",
                    border: "1px solid #059669",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Active Subscription
                </span>
              </div>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
