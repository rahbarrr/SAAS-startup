"use client";

import { useState } from "react";
import { DEMO_ORGANIZATION } from "@/lib/mock-data/fieldtrack-demo-data";
import { useCurrentRole } from "@/components/ui/RoleContext";
import { useToast } from "@/components/ui/Toast";

type SettingsTab = "company" | "preferences" | "notifications" | "workspace" | "security" | "billing";

export function SettingsClient() {
  const { currentRole, profile } = useCurrentRole();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("company");

  // Form states
  const [orgName, setOrgName] = useState(DEMO_ORGANIZATION.name);
  const [industry, setIndustry] = useState(DEMO_ORGANIZATION.industry);
  const [timezone, setTimezone] = useState(DEMO_ORGANIZATION.timezone);

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
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem", alignItems: "start" }}>
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
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                Company & Workspace Profile
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Manage your enterprise workspace identity, timezone, and operational parameters.
              </p>
            </div>

            <form onSubmit={handleSaveCompany} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label" htmlFor="company-name">
                  Company Name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label" htmlFor="company-industry">
                    Industry Sector
                  </label>
                  <input
                    id="company-industry"
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="company-timezone">
                    Operational Timezone
                  </label>
                  <select
                    id="company-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="input-field"
                  >
                    <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York (EST/EDT)">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago (CST/CDT)">America/Chicago (CST/CDT)</option>
                    <option value="America/Los_Angeles (PST/PDT)">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London (GMT/BST)">Europe/London (GMT/BST)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="company-slug">
                  Workspace Slug Identifier
                </label>
                <input
                  id="company-slug"
                  type="text"
                  value={DEMO_ORGANIZATION.slug}
                  disabled
                  className="input-field"
                  style={{ background: "var(--bg-canvas)", color: "var(--text-muted)" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Workspace identifiers are immutable and assigned during enterprise provisioning.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: User Preferences */}
        {activeTab === "preferences" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                User Preferences
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Customise personal display options, offline caching, and briefing schedules.
              </p>
            </div>

            <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                  background: "var(--bg-canvas)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--brand-primary)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.125rem",
                    fontWeight: 700,
                  }}
                >
                  {profile.avatarInitials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--brand-dark)" }}>
                    {profile.userName}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {profile.userEmail} • {profile.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Role: <strong style={{ textTransform: "capitalize" }}>{currentRole}</strong> (Apex Retail Solutions)
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="agenda-time">
                  Daily Morning Agenda Dispatch Time
                </label>
                <input
                  id="agenda-time"
                  type="time"
                  value={emailDigestTime}
                  onChange={(e) => setEmailDigestTime(e.target.value)}
                  className="input-field"
                  style={{ width: "160px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={offlineSyncWifiOnly}
                    onChange={(e) => setOfflineSyncWifiOnly(e.target.checked)}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <div>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      Sync High-Resolution Photo Evidence on Wi-Fi Only
                    </span>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Saves cellular data when field representatives upload in-store display audits.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary">
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === "notifications" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                Notification Preferences
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Control which operational events trigger email and in-app alerts.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                {
                  id: "approvals",
                  title: "Trip Approval & Review Requests",
                  desc: "Receive instant notifications when a team member submits a travel itinerary.",
                  checked: notifApprovals,
                  onChange: () => {
                    setNotifApprovals(!notifApprovals);
                    showToast("Approval notification setting changed", "info");
                  },
                },
                {
                  id: "exceptions",
                  title: "Store Visit Exception Alerts",
                  desc: "Alerts when out-of-stock items or checklist failures are logged by representatives.",
                  checked: notifExceptions,
                  onChange: () => {
                    setNotifExceptions(!notifExceptions);
                    showToast("Exception notification setting changed", "info");
                  },
                },
                {
                  id: "dailyDigest",
                  title: "Daily Operations Executive Briefing",
                  desc: "Morning summary of scheduled visits, active trips, and pending reviews.",
                  checked: notifDailyDigest,
                  onChange: () => {
                    setNotifDailyDigest(!notifDailyDigest);
                    showToast("Daily digest setting changed", "info");
                  },
                },
                {
                  id: "weeklyReport",
                  title: "Weekly Compliance & Velocity Digest",
                  desc: "End-of-week breakdown of territory execution and representative completion rates.",
                  checked: notifWeeklyReport,
                  onChange: () => {
                    setNotifWeeklyReport(!notifWeeklyReport);
                    showToast("Weekly report setting changed", "info");
                  },
                },
              ].map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {item.desc}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={item.onChange}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    aria-label={item.title}
                  />
                </div>
              ))}
            </div>

            {/* Phase 5: Web Push Notification Subscriptions */}
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default, #e5e7eb)",
                backgroundColor: "var(--bg-subtle, #f9fafb)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    Browser Web Push Notifications
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginTop: "0.25rem",
                    }}
                  >
                    Receive real-time trip approvals, visit reminders, and operational alerts
                    directly on your desktop or mobile lock-screen.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof window === "undefined" || !("Notification" in window)) {
                      showToast(
                        "Web push is not supported in this browser environment.",
                        "error"
                      );
                      return;
                    }
                    try {
                      const perm = await Notification.requestPermission();
                      if (perm === "granted") {
                        showToast(
                          "Push notifications enabled. Subscriptions will trigger on workflow alerts.",
                          "success"
                        );
                      } else {
                        showToast(
                          `Push permission was ${perm}. You can enable it anytime in browser settings.`,
                          "info"
                        );
                      }
                    } catch {
                      showToast("Could not request notification permission.", "error");
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8125rem", whiteSpace: "nowrap" }}
                >
                  Configure Web Push
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Workspace & Territories */}
        {activeTab === "workspace" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                Territories & Workflows
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Organizational defaults for store routing, checklist schemas, and geofencing.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                  Default FMCG Checklist Template
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.75rem" }}>
                  Applied automatically to all newly scheduled store visits unless customized.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span className="status-badge" style={{ background: "rgba(27, 53, 128, 0.08)", color: "var(--brand-primary)" }}>
                    1. Endcap Merchandising Compliance
                  </span>
                  <span className="status-badge" style={{ background: "rgba(27, 53, 128, 0.08)", color: "var(--brand-primary)" }}>
                    2. Inventory On-Shelf Stock Count
                  </span>
                  <span className="status-badge" style={{ background: "rgba(27, 53, 128, 0.08)", color: "var(--brand-primary)" }}>
                    3. Cooler Temperature Verification
                  </span>
                  <span className="status-badge" style={{ background: "rgba(27, 53, 128, 0.08)", color: "var(--brand-primary)" }}>
                    4. POS Promotional Banner Photo
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                  Geofence Proximity Threshold
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>
                  Device check-in proximity warning distance.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    defaultValue={100}
                    className="input-field"
                    style={{ width: "100px" }}
                    disabled
                  />
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>meters radius</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Security & SSO Placeholder */}
        {activeTab === "security" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                Enterprise Security & Access Control
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Single Sign-On, Multi-Factor Authentication, and role policy configuration.
              </p>
            </div>

            <div
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                marginBottom: "1.25rem",
                fontSize: "0.8125rem",
                color: "var(--brand-dark)",
              }}
            >
              <strong>Phase 1 Demonstration:</strong> Single Sign-On and cryptographic key provisioning will be configured during Phase 2 (Authentication & Workspace Foundation).
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Single Sign-On (SAML 2.0 / OIDC)</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Okta, Microsoft Azure AD, Google Workspace
                  </div>
                </div>
                <span className="status-badge" style={{ background: "rgba(5, 150, 105, 0.1)", color: "var(--success-green)" }}>
                  Available in Enterprise Tier
                </span>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Mandatory Multi-Factor Authentication (MFA)</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Enforced for all Workspace Admins and Territory Managers
                  </div>
                </div>
                <span className="status-badge" style={{ background: "rgba(5, 150, 105, 0.1)", color: "var(--success-green)" }}>
                  Active
                </span>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Session Inactivity Timeout</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Automatic session termination for security compliance
                  </div>
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>8 Hours</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Subscription & Billing Placeholder */}
        {activeTab === "billing" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)", margin: "0 0 0.25rem" }}>
                Subscription & Seat Allocation
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Enterprise contract details, seat utilization, and billing statements.
              </p>
            </div>

            <div
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-primary) 100%)",
                color: "#FFFFFF",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>
                    Current Active Tier
                  </span>
                  <h3 style={{ fontSize: "1.375rem", margin: "0.25rem 0", color: "#FFFFFF" }}>
                    {DEMO_ORGANIZATION.plan}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", margin: 0, opacity: 0.9 }}>
                    50 Field Seats • Unlimited Multi-Stop Itineraries • AI Synthesis Enabled
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

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.375rem" }}>
                  <span>Seat Utilization: <strong>{DEMO_ORGANIZATION.activeSeats} of {DEMO_ORGANIZATION.totalSeats} seats</strong></span>
                  <span>12 seats available</span>
                </div>
                <div style={{ height: "8px", width: "100%", background: "rgba(255, 255, 255, 0.2)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(DEMO_ORGANIZATION.activeSeats / DEMO_ORGANIZATION.totalSeats) * 100}%`,
                      background: "var(--brand-accent)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--brand-dark)", marginBottom: "0.75rem" }}>
                Recent Invoices (Demonstration)
              </h4>
              <div className="table-responsive">
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Billing Period</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>INV-2026-10</code></td>
                      <td>Oct 1 - Oct 31, 2026</td>
                      <td>$2,450.00</td>
                      <td>
                        <span className="status-badge" style={{ background: "rgba(5, 150, 105, 0.1)", color: "var(--success-green)" }}>
                          Paid
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => showToast("Demo invoice downloaded.", "info")}
                          style={{ background: "none", border: "none", color: "var(--brand-primary)", cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem" }}
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td><code>INV-2026-09</code></td>
                      <td>Sep 1 - Sep 30, 2026</td>
                      <td>$2,450.00</td>
                      <td>
                        <span className="status-badge" style={{ background: "rgba(5, 150, 105, 0.1)", color: "var(--success-green)" }}>
                          Paid
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => showToast("Demo invoice downloaded.", "info")}
                          style={{ background: "none", border: "none", color: "var(--brand-primary)", cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem" }}
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
