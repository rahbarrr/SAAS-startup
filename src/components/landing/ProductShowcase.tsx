"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type ShowcaseTab =
  "dashboard" | "planning" | "approvals" | "visits" | "location" | "reports";

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
    id: "dashboard",
    tabLabel: "Operations Dashboard",
    badge: "CENTRAL COMMAND",
    heading: "Real-time command center across all field territories.",
    description:
      "Managers and operations leaders gain immediate clarity on active field routes, pending trip authorizations, store visit adherence, and critical retail merchandising exceptions.",
    bulletPoints: [
      "Live operational KPI cards with real-time field telemetry",
      "Immediate trip approval triage and priority queueing",
      "Territory adherence breakdown and store visit completion",
      "Drill down directly from high-level metrics into store records",
    ],
  },
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
    tabLabel: "Live Location View",
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
    tabLabel: "Reports & Analytics",
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
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("dashboard");
  const shouldReduceMotion = useReducedMotion();

  const currentTab: ShowcaseData =
    SHOWCASE_TABS.find((t) => t.id === activeTab) ?? (SHOWCASE_TABS[0] as ShowcaseData);

  return (
    <section
      id="showcase"
      className="product-showcase-section"
      aria-labelledby="showcase-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">INTERACTIVE PRODUCT SHOWCASE</span>
          <h2 id="showcase-heading" className="section-title">
            Turn field activity into operational visibility.
          </h2>
          <p className="section-subtitle">
            Explore how FieldTrack manages the entire lifecycle of field operations—from
            initial route planning to final audit verification and territory analytics.
          </p>
        </div>

        {/* Interactive Tab Selector Buttons */}
        <div
          role="tablist"
          aria-label="Product Showcase Capabilities"
          className="showcase-tab-bar"
        >
          {SHOWCASE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                type="button"
                className={`showcase-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  position: "relative",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
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
              {/* Mockup 0: Operations Dashboard */}
              {activeTab === "dashboard" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Operations Command Center • Midwest FMCG
                    </span>
                    <span className="badge-success text-xs">Live Sync</span>
                  </div>

                  <div className="showcase-mockup-body">
                    {/* KPI Cards Row */}
                    <div className="dashboard-mockup-kpis">
                      <div className="dash-kpi-tile">
                        <small className="text-muted">ACTIVE TRIPS</small>
                        <strong className="text-lg text-primary">18</strong>
                        <span className="text-xs text-success">↑ 4 in progress</span>
                      </div>
                      <div className="dash-kpi-tile">
                        <small className="text-muted">PENDING APPROVALS</small>
                        <strong className="text-lg text-amber">3</strong>
                        <span className="text-xs text-muted">Awaiting review</span>
                      </div>
                      <div className="dash-kpi-tile">
                        <small className="text-muted">COMPLETED VISITS</small>
                        <strong className="text-lg text-success">142</strong>
                        <span className="text-xs text-success">96.4% on schedule</span>
                      </div>
                      <div className="dash-kpi-tile">
                        <small className="text-muted">STORE EXCEPTIONS</small>
                        <strong className="text-lg text-danger">2</strong>
                        <span className="text-xs text-danger">Out-of-stock items</span>
                      </div>
                    </div>

                    {/* Operational Feed */}
                    <div className="dashboard-mockup-feed">
                      <div className="feed-header">
                        <strong>Recent Field Activity & Approvals</strong>
                        <span className="text-xs text-muted">Updated 2m ago</span>
                      </div>
                      <div className="feed-items-list">
                        <div className="feed-item">
                          <span className="feed-dot dot-green" aria-hidden="true" />
                          <div className="feed-details">
                            <span className="feed-title">
                              Check-in Verified: Target Superstore #18
                            </span>
                            <span className="feed-sub">
                              Marcus Vance • GPS 38m • Checklist Complete
                            </span>
                          </div>
                          <span className="feed-time">10:42 AM</span>
                        </div>
                        <div className="feed-item">
                          <span className="feed-dot dot-blue" aria-hidden="true" />
                          <div className="feed-details">
                            <span className="feed-title">
                              Trip Approved: North Metro Corridor
                            </span>
                            <span className="feed-sub">
                              Approved by Area Lead • 5 stops scheduled
                            </span>
                          </div>
                          <span className="feed-time">09:15 AM</span>
                        </div>
                        <div className="feed-item">
                          <span className="feed-dot dot-amber" aria-hidden="true" />
                          <div className="feed-details">
                            <span className="feed-title">
                              Exception Logged: Kroger Market #302
                            </span>
                            <span className="feed-sub">
                              Promotional Cooler stockout flagged
                            </span>
                          </div>
                          <span className="feed-time">08:50 AM</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mockup 1: Trip Planning */}
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
                        <div className="node-marker pending">3</div>
                        <div className="node-content">
                          <div className="node-header">
                            <strong>Whole Foods Market</strong>
                            <span className="text-xs text-muted">
                              01:30 PM – 03:00 PM
                            </span>
                          </div>
                          <small className="text-muted">
                            1550 N Kingsbury St • Facing Compliance & Inventory
                          </small>
                        </div>
                      </div>
                    </div>

                    <div className="planning-route-summary">
                      <div className="route-stat">
                        <span className="route-stat-label">Estimated Transit:</span>
                        <strong className="route-stat-val">1h 14m</strong>
                      </div>
                      <div className="route-stat">
                        <span className="route-stat-label">Total Mileage:</span>
                        <strong className="route-stat-val">38.4 miles</strong>
                      </div>
                      <div className="route-stat">
                        <span className="route-stat-label">Estimated Allowance:</span>
                        <strong className="route-stat-val">$24.96</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mockup 2: Manager Approvals */}
              {activeTab === "approvals" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Approval Queue • Trip #TRP-8402
                    </span>
                    <span className="badge-warning text-xs">Review Required</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="approval-request-card">
                      <div className="request-profile-row">
                        <div className="rep-avatar">MV</div>
                        <div className="rep-meta">
                          <strong>Marcus Vance</strong>
                          <span className="text-xs text-muted">
                            Submitted today at 08:14 AM • West District
                          </span>
                        </div>
                        <span className="badge-info text-xs">Tier 1 Approval</span>
                      </div>

                      <div className="request-route-preview">
                        <div className="preview-label">PROPOSED ROUTE & PURPOSE</div>
                        <div className="preview-text">
                          Q4 Promotional Launch Audit across 4 primary grocery doors in
                          West District. Includes 3 planogram checks and 1 inventory
                          reconciliation.
                        </div>
                      </div>

                      <div className="approval-itinerary-table">
                        <div className="table-row-head">
                          <span>Stop</span>
                          <span>Store</span>
                          <span>Est. Window</span>
                          <span>Status</span>
                        </div>
                        <div className="table-row">
                          <span>1</span>
                          <span>Kroger #302</span>
                          <span>09:00 AM</span>
                          <span className="text-success text-xs">Verified</span>
                        </div>
                        <div className="table-row">
                          <span>2</span>
                          <span>Target #18</span>
                          <span>11:15 AM</span>
                          <span className="text-success text-xs">Verified</span>
                        </div>
                        <div className="table-row">
                          <span>3</span>
                          <span>Whole Foods</span>
                          <span>01:30 PM</span>
                          <span className="text-success text-xs">Verified</span>
                        </div>
                      </div>

                      <div className="approval-actions-box">
                        <div className="anti-tamper-notice">
                          <span className="shield-tiny" aria-hidden="true">
                            🔒
                          </span>
                          <span>
                            Logged in as Sarah Chen (Area Lead). Self-approval prevented
                            by PostgreSQL RLS.
                          </span>
                        </div>
                        <div className="action-buttons-row">
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            disabled
                          >
                            Request Edits
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-danger-soft text-xs"
                            disabled
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary text-xs"
                            disabled
                          >
                            ✓ Approve Route
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mockup 3: Store Visit Execution */}
              {activeTab === "visits" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Active Visit • Target Superstore #18
                    </span>
                    <span className="badge-success text-xs">In Progress</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="visit-active-banner">
                      <div className="geofence-status verified">
                        <span className="geo-icon" aria-hidden="true">
                          📍
                        </span>
                        <div>
                          <strong>GPS Check-in Verified</strong>
                          <span className="text-xs">
                            Accuracy: 4.2m • Entrance distance: 22m (within 150m boundary)
                          </span>
                        </div>
                      </div>
                      <div className="timer-badge">
                        <small className="text-muted">DURATION</small>
                        <strong>24m 12s</strong>
                      </div>
                    </div>

                    <div className="visit-checklist-preview">
                      <div className="checklist-title-row">
                        <strong>Store Inspection Checklist (3 of 4 Complete)</strong>
                        <span className="text-xs text-muted">Mandatory for Checkout</span>
                      </div>

                      <div className="checklist-items">
                        <div className="check-item done">
                          <span className="check-box" aria-hidden="true">
                            ✓
                          </span>
                          <span>Front Entrance Promotional Display Verified</span>
                        </div>
                        <div className="check-item done">
                          <span className="check-box" aria-hidden="true">
                            ✓
                          </span>
                          <span>Endcap Facing & Pricing Label Audit</span>
                        </div>
                        <div className="check-item done">
                          <span className="check-box" aria-hidden="true">
                            ✓
                          </span>
                          <span>2 Display Photos Captured & Encrypted</span>
                        </div>
                        <div className="check-item pending">
                          <span className="check-box" aria-hidden="true" />
                          <span>Manager Signature & Stock Condition Notes</span>
                        </div>
                      </div>
                    </div>

                    <div className="visit-evidence-preview">
                      <div className="evidence-thumb">
                        <div className="thumb-placeholder">📷 Display Photo #1</div>
                        <span className="text-xs text-muted">Endcap View • 11:28 AM</span>
                      </div>
                      <div className="evidence-thumb">
                        <div className="thumb-placeholder">📷 Display Photo #2</div>
                        <span className="text-xs text-muted">
                          Cooler Facing • 11:34 AM
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mockup 4: Location Visibility */}
              {activeTab === "location" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Territory Ground Visibility • West Metro
                    </span>
                    <span className="badge-info text-xs">3 Active Reps</span>
                  </div>

                  <div className="showcase-mockup-body">
                    <div className="map-mockup-container">
                      <div className="map-grid-bg">
                        {/* Store Pin 1 */}
                        <div
                          className="map-pin pin-done"
                          style={{ top: "25%", left: "20%" }}
                        >
                          <div className="pin-bubble">Kroger #302 ✓</div>
                          <div className="pin-point" />
                        </div>

                        {/* Store Pin 2 (Active) */}
                        <div
                          className="map-pin pin-active"
                          style={{ top: "50%", left: "55%" }}
                        >
                          <div className="pin-pulse" />
                          <div className="pin-bubble">Target #18 • Marcus V.</div>
                          <div className="pin-point" />
                        </div>

                        {/* Store Pin 3 (Upcoming) */}
                        <div
                          className="map-pin pin-pending"
                          style={{ top: "72%", left: "78%" }}
                        >
                          <div className="pin-bubble">Whole Foods</div>
                          <div className="pin-point" />
                        </div>

                        {/* Connection Line */}
                        <svg
                          className="map-route-svg"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M 20 25 Q 40 35 55 50 T 78 72"
                            fill="none"
                            stroke="rgba(136, 117, 247, 0.45)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                        </svg>
                      </div>

                      <div className="map-privacy-overlay">
                        <div className="privacy-badge">
                          <span className="privacy-icon" aria-hidden="true">
                            🛡️
                          </span>
                          <div>
                            <strong>Point-in-Time GPS Verification Only</strong>
                            <p className="text-xs text-muted" style={{ margin: 0 }}>
                              Coordinates recorded strictly at check-in & checkout. Zero
                              continuous tracking.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mockup 5: Reports & Analytics */}
              {activeTab === "reports" && (
                <div className="showcase-mockup-card">
                  <div className="mockup-header-bar">
                    <span className="mockup-dot-group" aria-hidden="true">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </span>
                    <span className="mockup-bar-title">
                      Territory Compliance Report • Q4 2026
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
