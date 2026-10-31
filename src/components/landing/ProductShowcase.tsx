"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type ShowcaseTab = "planning" | "approvals" | "visits" | "location" | "reports";

interface ShowcaseData {
  id: ShowcaseTab;
  tabLabel: string;
  badge: string;
  heading: string;
  description: string;
  bulletPoints: string[];
}

const SHOWCASE_TABS: readonly ShowcaseData[] = [
  {
    id: "planning",
    tabLabel: "Trip Planning",
    badge: "CAPABILITY 01",
    heading: "Plan field itineraries directly from your store directory.",
    description:
      "Field employees build multi-stop itineraries with verified retail doors, travel dates, and objective notes. Keep field routes organized and aligned with territory priorities.",
    bulletPoints: [
      "Select retail doors with automated coordinate lookup",
      "Sequence stops to minimize transit time and mileage",
      "Organize daily visit schedules and travel allowances",
      "Link trips to assigned territory stores",
    ],
  },
  {
    id: "approvals",
    tabLabel: "Manager Approvals",
    badge: "CAPABILITY 02",
    heading: "Review and decide travel requests with documented audit trails.",
    description:
      "Managers review submitted trip itineraries in a centralized approval queue. Approve or request adjustments with mandatory explanatory feedback and anti-tamper safeguards.",
    bulletPoints: [
      "Dedicated manager approval queue for submitted trips",
      "Mandatory review notes for approval, rejection, or changes",
      "Strict anti-tamper rule prevents employee self-approvals",
      "Complete historical audit log of every travel decision",
    ],
  },
  {
    id: "visits",
    tabLabel: "Store Visit Execution",
    badge: "CAPABILITY 03",
    heading: "Verify on-site execution with consent-driven GPS check-ins.",
    description:
      "When representatives arrive at a scheduled store, they initiate an authorized check-in. Complete required checklists and upload photo evidence before checkout is unlocked.",
    bulletPoints: [
      "Point-in-time GPS check-in verification at the store entrance",
      "Mandatory inspection checklist prevents premature departures",
      "Photo evidence captured and stored in tenant-isolated private buckets",
      "Idempotent tokens prevent duplicate check-ins or corrupt records",
    ],
  },
  {
    id: "location",
    tabLabel: "Location Visibility",
    badge: "CAPABILITY 04",
    heading: "Maintain clear ground visibility without intrusive tracking.",
    description:
      "FieldTrack records verified coordinates strictly when check-in or checkout is triggered. Managers see verified store presence without invasive continuous background monitoring.",
    bulletPoints: [
      "Consent-driven, point-in-time check-in coordinates",
      "Geofence distance calculations against verified store master coordinates",
      "Respects field employee privacy with zero continuous background tracking",
      "Transparent location logs with accuracy confidence metrics",
    ],
  },
  {
    id: "reports",
    tabLabel: "Operational Reporting",
    badge: "CAPABILITY 05",
    heading: "Compare planned vs. actual performance across territories.",
    description:
      "Eliminate manual spreadsheet consolidation. Live dashboards aggregate visit velocity, completion rates, and exception flags with formula-injection-safe CSV export.",
    bulletPoints: [
      "Real-time planned vs. actual stop compliance tracking",
      "Filter by territory, regional manager, store chain, or rep",
      "Immediate alerts for out-of-stock items and equipment issues",
      "Sanitized CSV export for seamless ERP or spreadsheet reporting",
    ],
  },
];

export function ProductShowcase(): ReactNode {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("planning");
  const shouldReduceMotion = useReducedMotion();

  const currentTab: ShowcaseData =
    SHOWCASE_TABS.find((t) => t.id === activeTab) ?? (SHOWCASE_TABS[0] as ShowcaseData);

  return (
    <section
      id="product"
      className="product-showcase-section"
      aria-labelledby="showcase-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <motion.div
          className="section-header-centered"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">PRODUCT CAPABILITIES</span>
          <h2 id="showcase-heading" className="section-title">
            Turn field activity into operational visibility.
          </h2>
          <p className="section-subtitle">
            Explore how FieldTrack streamlines trip planning, approvals, store execution,
            and operational oversight.
          </p>
        </motion.div>

        {/* Tab Switcher Controls */}
        <div
          className="showcase-tab-bar"
          role="tablist"
          aria-label="Product capabilities tour"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "2.5rem",
          }}
        >
          {SHOWCASE_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                className={`showcase-tab-btn ${isActive ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                style={{
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <span>{tab.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab.id}
            id={`panel-${currentTab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${currentTab.id}`}
            className="showcase-panel"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Left Column: Descriptive Text & Value Drivers */}
            <div className="showcase-info-col">
              <span className="showcase-workflow-badge">{currentTab.badge}</span>
              <h3 className="showcase-info-heading">{currentTab.heading}</h3>
              <p className="showcase-info-desc">{currentTab.description}</p>

              <ul className="showcase-points-list">
                {currentTab.bulletPoints.map((point) => (
                  <li key={point}>
                    <span className="point-check" aria-hidden="true">
                      ✓
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Dynamic Mockup Visualization */}
            <div className="showcase-visual-col" style={{ perspective: 1000 }}>
              {activeTab === "planning" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">Trip Planner • #TRP-8402</span>
                    <span className="badge-warning text-xs">Ready for Review</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="planning-trip-meta">
                      <div>
                        <small className="text-muted">FIELD REPRESENTATIVE</small>
                        <strong>Marcus Vance (West Territory)</strong>
                      </div>
                      <div>
                        <small className="text-muted">TRAVEL WINDOW</small>
                        <strong>Nov 02 – Nov 04, 2026</strong>
                      </div>
                      <div>
                        <small className="text-muted">SCHEDULED STOPS</small>
                        <strong>4 Stores • 38.4 mi</strong>
                      </div>
                    </div>

                    <div className="planning-stops-timeline">
                      <div className="planning-stop-node">
                        <div className="node-marker done">1</div>
                        <div className="node-content">
                          <div className="node-header">
                            <strong>Kroger Market #302</strong>
                            <span className="text-xs text-muted">
                              09:00 AM – 10:30 AM
                            </span>
                          </div>
                          <small className="text-muted">
                            2100 W Madison St • Endcap Planogram Audit
                          </small>
                        </div>
                      </div>

                      <div className="planning-stop-connector" />

                      <div className="planning-stop-node">
                        <div className="node-marker active">2</div>
                        <div className="node-content">
                          <div className="node-header">
                            <strong>Target Superstore #18</strong>
                            <span className="text-xs text-muted">
                              11:15 AM – 12:45 PM
                            </span>
                          </div>
                          <small className="text-muted">
                            1154 S Clark St • Promotional Cooler Inspection
                          </small>
                        </div>
                      </div>

                      <div className="planning-stop-connector" />

                      <div className="planning-stop-node">
                        <div className="node-marker">3</div>
                        <div className="node-content">
                          <div className="node-header">
                            <strong>Walgreens Pharmacy Door #9</strong>
                            <span className="text-xs text-muted">
                              02:00 PM – 03:00 PM
                            </span>
                          </div>
                          <small className="text-muted">
                            3405 S King Dr • Shelf Share Verification
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "approvals" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Approvals Inbox • Manager Review
                    </span>
                    <span className="badge-warning text-xs">Pending Decision</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="planning-approval-box" style={{ margin: 0 }}>
                      <div className="approval-box-header">
                        <strong>Trip Request #TRP-8402</strong>
                        <span className="text-xs text-muted">
                          Submitted by Marcus Vance
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.75rem",
                          margin: "0.75rem 0",
                          padding: "0.75rem",
                          background: "#f8f9fc",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <div>
                          <small className="text-muted" style={{ display: "block" }}>
                            STOPS &amp; MILEAGE
                          </small>
                          <strong style={{ fontSize: "0.875rem" }}>
                            4 retail stops • 38.4 mi
                          </strong>
                        </div>
                        <div>
                          <small className="text-muted" style={{ display: "block" }}>
                            COMPLIANCE CHECK
                          </small>
                          <strong style={{ fontSize: "0.875rem", color: "#16a34a" }}>
                            ✓ Within policy allowance
                          </strong>
                        </div>
                      </div>
                      <p
                        className="text-xs text-secondary"
                        style={{ margin: "0.5rem 0 0.25rem" }}
                      >
                        Manager Decision Feedback (mandatory):
                      </p>
                      <div
                        className="mockup-input-box"
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.375rem",
                          fontSize: "0.8125rem",
                        }}
                      >
                        Route sequence verified against territory priorities. Approved.
                      </div>
                      <div
                        className="approval-actions-row"
                        style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}
                      >
                        <button
                          type="button"
                          className="mini-btn btn-success"
                          disabled
                          style={{
                            background: "#16a34a",
                            color: "#ffffff",
                            border: "none",
                            padding: "0.375rem 0.875rem",
                            borderRadius: "0.25rem",
                            fontWeight: 600,
                            fontSize: "0.8125rem",
                          }}
                        >
                          ✓ Approve Trip
                        </button>
                        <button
                          type="button"
                          className="mini-btn btn-outline"
                          disabled
                          style={{
                            background: "transparent",
                            border: "1px solid #d1d5db",
                            padding: "0.375rem 0.875rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.8125rem",
                          }}
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "visits" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Store Visit Execution • Door #18 Target
                    </span>
                    <span className="badge-success text-xs">
                      Checked In (GPS Verified)
                    </span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="visit-gps-telemetry-banner">
                      <div className="gps-telemetry-icon" aria-hidden="true">
                        📍
                      </div>
                      <div className="gps-telemetry-text">
                        <strong>Consent Check-in Timestamp: 11:15:24 AM UTC</strong>
                        <small>
                          Lat: 41.8679 • Long: -87.6308 • Accuracy: ±8m • Store Verified
                        </small>
                      </div>
                    </div>

                    <div className="visit-checklist-section">
                      <h5 className="visit-subhead">
                        Required In-Store Inspection Items
                      </h5>
                      <div className="visit-checklist-group">
                        <div className="visit-check-row row-done">
                          <span className="check-status-icon">✓</span>
                          <div className="check-detail">
                            <strong>Cooler Temperature Audit</strong>
                            <small>
                              Recorded: 3.8°C (Normal operational threshold &lt; 5°C)
                            </small>
                          </div>
                          <span className="pill-status-done">Completed</span>
                        </div>

                        <div className="visit-check-row row-done">
                          <span className="check-status-icon">✓</span>
                          <div className="check-detail">
                            <strong>Shelf Facing & Planogram Alignment</strong>
                            <small>8 facings verified on Eye-Level Shelf B</small>
                          </div>
                          <span className="pill-status-done">Completed</span>
                        </div>

                        <div className="visit-check-row row-done">
                          <span className="check-status-icon">✓</span>
                          <div className="check-detail">
                            <strong>Stockout / OOS Flagging</strong>
                            <small>Zero stockouts detected across top 4 SKUs</small>
                          </div>
                          <span className="pill-status-done">Completed</span>
                        </div>
                      </div>
                    </div>

                    <div className="visit-evidence-gallery">
                      <h5 className="visit-subhead">
                        Captured Photographic Proof (Signed Vault)
                      </h5>
                      <div className="evidence-thumbnails-row">
                        <div className="evidence-thumb-card">
                          <div className="thumb-placeholder-img">
                            <span>📷 Endcap Display</span>
                          </div>
                          <small className="thumb-caption">
                            Aisle 4 Endcap • 11:22 AM
                          </small>
                        </div>
                        <div className="evidence-thumb-card">
                          <div className="thumb-placeholder-img">
                            <span>📷 Cooler Gauge</span>
                          </div>
                          <small className="thumb-caption">Temp Log • 11:28 AM</small>
                        </div>
                        <div className="evidence-thumb-card">
                          <div className="thumb-placeholder-img">
                            <span>📷 Shelf Share</span>
                          </div>
                          <small className="thumb-caption">Facing Row 2 • 11:34 AM</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "location" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Location &amp; Geofence Verification
                    </span>
                    <span className="badge-info text-xs">Privacy-Safe Verification</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div
                      style={{
                        background: "#f8f9fc",
                        borderRadius: "0.5rem",
                        padding: "1rem",
                        border: "1px solid #e5e7eb",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "#20243a",
                          }}
                        >
                          GEOFENCE CONFIRMATION
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "9999px",
                            fontWeight: 600,
                          }}
                        >
                          Within 25m Radius
                        </span>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "#626b80", margin: 0 }}>
                        Point-in-time check-in coordinates matched verified store address
                        (Target #18, 1154 S Clark St) with 99.4% confidence.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          padding: "0.75rem",
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <small className="text-muted" style={{ display: "block" }}>
                          POINT-IN-TIME CHECK-IN
                        </small>
                        <strong style={{ fontSize: "0.875rem" }}>
                          11:15 AM (GPS Fixed)
                        </strong>
                      </div>
                      <div
                        style={{
                          padding: "0.75rem",
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <small className="text-muted" style={{ display: "block" }}>
                          POINT-IN-TIME CHECK-OUT
                        </small>
                        <strong style={{ fontSize: "0.875rem" }}>
                          12:45 PM (GPS Fixed)
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "0.75rem",
                        background: "rgba(41, 63, 145, 0.04)",
                        borderRadius: "0.375rem",
                        borderLeft: "3px solid #293f91",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "0.8125rem",
                          color: "#293f91",
                          display: "block",
                        }}
                      >
                        Privacy Safeguard Policy
                      </strong>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#626b80",
                          margin: "0.25rem 0 0",
                        }}
                      >
                        Zero background location polling. Coordinates are recorded
                        exclusively upon explicit rep action at check-in and checkout.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "reports" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Territory Analytics &amp; Compliance
                    </span>
                    <span className="badge-info text-xs">Live Feed</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="reports-top-metrics">
                      <div className="report-metric-tile">
                        <small className="text-muted">PLANNED STOPS</small>
                        <strong className="text-lg">120</strong>
                        <span className="text-xs text-muted">Across 3 districts</span>
                      </div>
                      <div className="report-metric-tile">
                        <small className="text-muted">ACTUAL VISITED</small>
                        <strong className="text-lg text-success">113</strong>
                        <span className="text-xs text-success">94.2% Adherence</span>
                      </div>
                      <div className="report-metric-tile">
                        <small className="text-muted">AVG VISIT TIME</small>
                        <strong className="text-lg text-navy">42 min</strong>
                        <span className="text-xs text-muted">Per store door</span>
                      </div>
                      <div className="report-metric-tile">
                        <small className="text-muted">EXCEPTIONS</small>
                        <strong className="text-lg text-danger">3</strong>
                        <span className="text-xs text-danger">Stockout flags</span>
                      </div>
                    </div>

                    <div className="reports-chart-mockup">
                      <div className="chart-header-row">
                        <strong>District Visit Adherence (October 2026)</strong>
                        <span className="text-xs text-muted">Target: &gt; 90%</span>
                      </div>

                      <div className="chart-bars-list">
                        <div className="chart-bar-item">
                          <div className="bar-labels">
                            <span>North Metro (4 reps)</span>
                            <strong>96.8%</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill fill-green"
                              style={{ width: "96.8%" }}
                            />
                          </div>
                        </div>

                        <div className="chart-bar-item">
                          <div className="bar-labels">
                            <span>West District (3 reps)</span>
                            <strong>92.5%</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill fill-green"
                              style={{ width: "92.5%" }}
                            />
                          </div>
                        </div>

                        <div className="chart-bar-item">
                          <div className="bar-labels">
                            <span>South Suburban (5 reps)</span>
                            <strong>88.4%</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill fill-amber"
                              style={{ width: "88.4%" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="reports-export-banner">
                      <div>
                        <strong>Audit-Ready Data Export</strong>
                        <p className="text-xs text-muted" style={{ margin: 0 }}>
                          Formula-injection safe CSV with raw timestamps and user IDs.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary text-xs"
                        disabled
                      >
                        📥 Export CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
