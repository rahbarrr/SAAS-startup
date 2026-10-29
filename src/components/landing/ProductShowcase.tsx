"use client";

import { useState, type ReactNode } from "react";

type ShowcaseTab = "planning" | "visits" | "reports";

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
    tabLabel: "Trip Planning & Approvals",
    badge: "WORKFLOW 01",
    heading: "Build multi-stop itineraries. Enforce policy approvals.",
    description:
      "Field employees assemble planned travel routes by choosing verified retail doors from the store directory. Managers inspect the itinerary in their dedicated approval inbox and decide requests with documented audit feedback.",
    bulletPoints: [
      "Select retail doors with automated coordinate lookup",
      "Sequence stops to minimize transit time and mileage",
      "Mandatory explanatory notes for travel approval or change requests",
      "Anti-tamper rule prevents employee self-approvals",
    ],
  },
  {
    id: "visits",
    tabLabel: "Store Visits & Evidence",
    badge: "WORKFLOW 02",
    heading: "Verify on-site execution with consent-driven GPS check-ins.",
    description:
      "When representatives arrive at a scheduled store, they initiate an authorized check-in. The platform captures location coordinates only at that moment. Representatives complete standardized checklists and upload photo evidence before checkout is unlocked.",
    bulletPoints: [
      "Consent-driven GPS verification during check-in/out only (no background tracking)",
      "Mandatory checklist verification prevents premature departures",
      "Signed photo evidence stored in tenant-isolated private buckets",
      "Idempotent tokens prevent duplicate check-ins or corrupt records",
    ],
  },
  {
    id: "reports",
    tabLabel: "Reports & Performance",
    badge: "WORKFLOW 03",
    heading: "Compare planned vs. actual performance across territories.",
    description:
      "Eliminate spreadsheet consolidation. Live dashboards aggregate visit velocity, on-time rates, and unresolved exceptions. Export raw or summarized operational datasets into formula-injection-safe CSV files.",
    bulletPoints: [
      "Real-time planned vs. actual stop compliance tracking",
      "Filter by territory, regional manager, store chain, or rep",
      "Immediate alerts for cooler breakdowns or out-of-stock items",
      "Sanitized CSV export for seamless ERP or spreadsheet reporting",
    ],
  },
];

export function ProductShowcase(): ReactNode {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("planning");

  const currentTab: ShowcaseData =
    SHOWCASE_TABS.find((t) => t.id === activeTab) ?? (SHOWCASE_TABS[0] as ShowcaseData);

  return (
    <section className="product-showcase-section" aria-labelledby="showcase-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">INTERACTIVE PRODUCT TOUR</span>
          <h2 id="showcase-heading" className="section-title">
            Turn field activity into operational visibility.
          </h2>
          <p className="section-subtitle">
            Switch between core workflows to see how FieldTrack structures trip planning,
            on-site evidence capture, and territory reporting.
          </p>
        </div>

        {/* Tab Switcher Controls */}
        <div className="showcase-tab-bar" role="tablist" aria-label="Product showcase workflows">
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
              >
                <span>{tab.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div
          id={`panel-${currentTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${currentTab.id}`}
          className="showcase-panel"
        >
          {/* Left Column: Descriptive Text & Value Drivers */}
          <div className="showcase-info-col">
            <span className="showcase-workflow-badge">{currentTab.badge}</span>
            <h3 className="showcase-info-heading">{currentTab.heading}</h3>
            <p className="showcase-info-desc">{currentTab.description}</p>

            <ul className="showcase-points-list">
              {currentTab.bulletPoints.map((point) => (
                <li key={point}>
                  <span className="point-check" aria-hidden="true">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Dynamic Mockup Visualization */}
          <div className="showcase-visual-col">
            {activeTab === "planning" && (
              <div className="showcase-mockup-card">
                <div className="mockup-header-bar">
                  <span className="mockup-dot-group" aria-hidden="true">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                  </span>
                  <span className="mockup-bar-title">FieldTrip Planner • Trip #TRP-8402</span>
                  <span className="badge-warning text-xs">Submitted for Approval</span>
                </div>

                <div className="showcase-mockup-body">
                  <div className="planning-trip-meta">
                    <div>
                      <small className="text-muted">FIELD REPRESENTATIVE</small>
                      <strong>Marcus Vance (West Territory)</strong>
                    </div>
                    <div>
                      <small className="text-muted">TRAVEL WINDOW</small>
                      <strong>Oct 29 – Oct 31, 2026</strong>
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
                          <span className="text-xs text-muted">09:00 AM – 10:30 AM</span>
                        </div>
                        <small className="text-muted">2100 W Madison St • Endcap Planogram Audit</small>
                      </div>
                    </div>

                    <div className="planning-stop-connector" />

                    <div className="planning-stop-node">
                      <div className="node-marker active">2</div>
                      <div className="node-content">
                        <div className="node-header">
                          <strong>Target Superstore #18</strong>
                          <span className="text-xs text-muted">11:15 AM – 12:45 PM</span>
                        </div>
                        <small className="text-muted">1154 S Clark St • Promotional Cooler Inspection</small>
                      </div>
                    </div>

                    <div className="planning-stop-connector" />

                    <div className="planning-stop-node">
                      <div className="node-marker">3</div>
                      <div className="node-content">
                        <div className="node-header">
                          <strong>Walgreens Pharmacy Door #9</strong>
                          <span className="text-xs text-muted">02:00 PM – 03:00 PM</span>
                        </div>
                        <small className="text-muted">3405 S King Dr • Shelf Share Verification</small>
                      </div>
                    </div>
                  </div>

                  <div className="planning-approval-box">
                    <div className="approval-box-header">
                      <strong>Manager Decision Action</strong>
                      <span className="text-xs text-muted">Signed in as Jane Miller (Manager)</span>
                    </div>
                    <p className="text-xs text-secondary" style={{ margin: "0.25rem 0 0.5rem" }}>
                      Mandatory review note:
                    </p>
                    <div className="mockup-input-box">
                      Route optimized. Approved with standard mileage allowance.
                    </div>
                    <div className="approval-actions-row">
                      <button type="button" className="mini-btn btn-success" disabled>
                        ✓ Approve Trip
                      </button>
                      <button type="button" className="mini-btn btn-outline" disabled>
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
                  <span className="mockup-bar-title">Store Visit Execution • Door #18 Target</span>
                  <span className="badge-success text-xs">Checked In (GPS Verified)</span>
                </div>

                <div className="showcase-mockup-body">
                  <div className="visit-gps-telemetry-banner">
                    <div className="gps-telemetry-icon" aria-hidden="true">📍</div>
                    <div className="gps-telemetry-text">
                      <strong>Consent Check-in Timestamp: 11:15:24 AM UTC</strong>
                      <small>Lat: 41.8679 • Long: -87.6308 • Accuracy: ±8m • Store Verified</small>
                    </div>
                  </div>

                  <div className="visit-checklist-section">
                    <h5 className="visit-subhead">Required In-Store Inspection Items</h5>
                    <div className="visit-checklist-group">
                      <div className="visit-check-row row-done">
                        <span className="check-status-icon">✓</span>
                        <div className="check-detail">
                          <strong>Cooler Temperature Audit</strong>
                          <small>Recorded: 3.8°C (Normal operational threshold &lt; 5°C)</small>
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
                    <h5 className="visit-subhead">Captured Photographic Proof (Signed Vault)</h5>
                    <div className="evidence-thumbnails-row">
                      <div className="evidence-thumb-card">
                        <div className="thumb-placeholder-img">
                          <span>📷 Endcap Display</span>
                        </div>
                        <small className="thumb-caption">Aisle 4 Endcap • 11:22 AM</small>
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

            {activeTab === "reports" && (
              <div className="showcase-mockup-card">
                <div className="mockup-header-bar">
                  <span className="mockup-dot-group" aria-hidden="true">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                  </span>
                  <span className="mockup-bar-title">Territory Analytics & Planned vs Actual</span>
                  <span className="badge-info text-xs">Quarterly Audit Feed</span>
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
                          <div className="bar-fill fill-green" style={{ width: "96.8%" }} />
                        </div>
                      </div>

                      <div className="chart-bar-item">
                        <div className="bar-labels">
                          <span>West District (3 reps)</span>
                          <strong>92.5%</strong>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill fill-green" style={{ width: "92.5%" }} />
                        </div>
                      </div>

                      <div className="chart-bar-item">
                        <div className="bar-labels">
                          <span>South Suburban (5 reps)</span>
                          <strong>88.4%</strong>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill fill-amber" style={{ width: "88.4%" }} />
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
                    <button type="button" className="btn btn-secondary text-xs" disabled>
                      📥 Export CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
