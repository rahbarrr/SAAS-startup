import type { ReactNode } from "react";

export function ProductDashboardPreview(): ReactNode {
  return (
    <div className="product-preview-wrapper" aria-label="FieldTrack product interface overview">
      {/* Desktop Manager Dashboard Mockup */}
      <div className="desktop-mockup-frame">
        {/* Window Chrome / Title Bar */}
        <div className="mockup-window-bar">
          <div className="mockup-window-controls" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="mockup-window-title">
            <span className="window-app-icon" aria-hidden="true">F</span>
            <span>FieldTrack Operations Control • Midwest Territory (Chicago Hub)</span>
          </div>
          <div className="mockup-window-status">
            <span className="status-indicator-live" aria-hidden="true" />
            <span>Active Live Telemetry</span>
          </div>
        </div>

        {/* Dashboard Body with Mini Sidebar and Main Content */}
        <div className="mockup-dashboard-layout">
          {/* Mini Left Sidebar */}
          <aside className="mockup-mini-sidebar" aria-hidden="true">
            <div className="mockup-sidebar-brand">
              <div className="mockup-avatar-brand">F</div>
              <div className="mockup-sidebar-brand-text">
                <strong>FieldTrack</strong>
                <small>Acme FMCG Corp</small>
              </div>
            </div>

            <nav className="mockup-sidebar-nav">
              <div className="mockup-nav-item active">
                <span className="mockup-nav-icon">📊</span>
                <span>Overview</span>
              </div>
              <div className="mockup-nav-item">
                <span className="mockup-nav-icon">🗺️</span>
                <span>Field Trips</span>
                <span className="mockup-nav-badge">5</span>
              </div>
              <div className="mockup-nav-item">
                <span className="mockup-nav-icon">⚖️</span>
                <span>Approvals</span>
                <span className="mockup-nav-badge badge-warning">3</span>
              </div>
              <div className="mockup-nav-item">
                <span className="mockup-nav-icon">📍</span>
                <span>Store Visits</span>
              </div>
              <div className="mockup-nav-item">
                <span className="mockup-nav-icon">🏢</span>
                <span>Stores & Doors</span>
              </div>
              <div className="mockup-nav-item">
                <span className="mockup-nav-icon">📈</span>
                <span>Territory Reports</span>
              </div>
            </nav>

            <div className="mockup-sidebar-user">
              <div className="mockup-avatar-user">JM</div>
              <div className="mockup-user-info">
                <span>Jane Miller</span>
                <small>Regional Ops Head</small>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Preview Content */}
          <div className="mockup-main-panel">
            {/* Top Stats Bar */}
            <div className="mockup-kpi-grid">
              <div className="mockup-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">ACTIVE FIELD TRIPS</span>
                  <span className="kpi-tag tag-blue">Live</span>
                </div>
                <div className="kpi-number">4</div>
                <div className="kpi-trend text-success">
                  <span aria-hidden="true">↑</span> 12% vs last cycle
                </div>
              </div>

              <div className="mockup-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">AWAITING APPROVAL</span>
                  <span className="kpi-tag tag-amber">Action req.</span>
                </div>
                <div className="kpi-number text-amber">3</div>
                <div className="kpi-trend text-muted">
                  Requires manager review
                </div>
              </div>

              <div className="mockup-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">COMPLETED VISITS</span>
                  <span className="kpi-tag tag-green">On schedule</span>
                </div>
                <div className="kpi-number text-navy">38</div>
                <div className="kpi-trend text-success">
                  94.2% on-time execution
                </div>
              </div>

              <div className="mockup-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">FLAGGED EXCEPTIONS</span>
                  <span className="kpi-tag tag-red">Attention</span>
                </div>
                <div className="kpi-number text-danger">2</div>
                <div className="kpi-trend text-danger">
                  1 cooler alert • 1 stockout
                </div>
              </div>
            </div>

            {/* Live Field Activity Table */}
            <div className="mockup-table-card">
              <div className="mockup-table-header">
                <div>
                  <h4 className="mockup-table-title">Real-Time Field Execution Activity</h4>
                  <p className="mockup-table-subtitle">Illustrative live data feed across active Midwest retail routes</p>
                </div>
                <div className="mockup-filter-chip">
                  <span>Filtered: Today (UTC)</span>
                </div>
              </div>

              <div className="mockup-table-scroll">
                <table className="mockup-table" aria-label="Field activity sample preview">
                  <thead>
                    <tr>
                      <th scope="col">Field Representative</th>
                      <th scope="col">Scheduled Retail Door</th>
                      <th scope="col">Visit Type</th>
                      <th scope="col">Execution Status</th>
                      <th scope="col">Evidence & Checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="mockup-cell-user">
                          <span className="mockup-user-circle circle-blue">SJ</span>
                          <div>
                            <strong>Sarah Jenkins</strong>
                            <small>North Territory Rep</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mockup-cell-store">
                          <strong>HyperCity Supercenter #104</strong>
                          <small>1440 Michigan Ave, Chicago</small>
                        </div>
                      </td>
                      <td>
                        <span className="pill-type">Merchandising & Planogram</span>
                      </td>
                      <td>
                        <span className="badge-status status-in-progress">
                          <span className="badge-dot dot-pulse" />
                          Checked In (10:14 AM)
                        </span>
                      </td>
                      <td>
                        <div className="mockup-evidence-summary">
                          <span className="checklist-pill">4/4 Checked ✓</span>
                          <span className="evidence-count">📷 3 Photos</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div className="mockup-cell-user">
                          <span className="mockup-user-circle circle-amber">DC</span>
                          <div>
                            <strong>David Chen</strong>
                            <small>West Territory Rep</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mockup-cell-store">
                          <strong>Metro Grocery Mart #42</strong>
                          <small>890 Grand Blvd, Oak Park</small>
                        </div>
                      </td>
                      <td>
                        <span className="pill-type">Endcap Display Audit</span>
                      </td>
                      <td>
                        <span className="badge-status status-visited">
                          <span className="badge-dot" />
                          Visited (09:40 AM)
                        </span>
                      </td>
                      <td>
                        <div className="mockup-evidence-summary">
                          <span className="checklist-pill">3/3 Checked ✓</span>
                          <span className="evidence-count">📷 2 Photos</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div className="mockup-cell-user">
                          <span className="mockup-user-circle circle-red">PP</span>
                          <div>
                            <strong>Priya Patel</strong>
                            <small>South Territory Rep</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mockup-cell-store">
                          <strong>Apex Retail Warehouse #12</strong>
                          <small>220 Industrial Pkwy, Gary</small>
                        </div>
                      </td>
                      <td>
                        <span className="pill-type">Cooler Audit & Restock</span>
                      </td>
                      <td>
                        <span className="badge-status status-exception">
                          <span className="badge-dot" />
                          Exception Flagged
                        </span>
                      </td>
                      <td>
                        <div className="mockup-evidence-summary">
                          <span className="checklist-pill pill-warning">Cooler at 12°C ⚠️</span>
                          <span className="evidence-count">📷 4 Photos</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Table Footer Meta */}
              <div className="mockup-table-footer">
                <span className="footer-meta-text">
                  Verified with multi-tenant row-level security and cryptographically signed timestamps.
                </span>
                <span className="footer-meta-badge">Consent-driven GPS check-ins</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Field App Mockup */}
      <div className="floating-mobile-frame" aria-label="FieldTrack mobile check-in app preview">
        <div className="phone-bezel">
          {/* Phone Speaker & Camera Notch */}
          <div className="phone-notch" aria-hidden="true">
            <span className="notch-speaker" />
            <span className="notch-camera" />
          </div>

          {/* Mobile Screen Content */}
          <div className="phone-screen">
            {/* Mobile App Header */}
            <div className="mobile-app-header">
              <div className="mobile-header-top">
                <span className="mobile-time">10:14</span>
                <div className="mobile-icons" aria-hidden="true">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="mobile-brand-bar">
                <div className="brand-dot-box">F</div>
                <div className="mobile-title-block">
                  <strong>Today&apos;s Itinerary</strong>
                  <small>Stop 2 of 4 • On Schedule</small>
                </div>
                <span className="mobile-offline-badge">Offline Ready</span>
              </div>
            </div>

            {/* Mobile Active Stop Card */}
            <div className="mobile-stop-card">
              <div className="stop-card-badge">CURRENT ACTIVE STOP</div>
              <h5 className="stop-name">HyperCity Supercenter #104</h5>
              <p className="stop-address">1440 Michigan Ave, Aisles 4 & 7</p>

              <div className="gps-verified-banner">
                <div className="gps-icon-circle" aria-hidden="true">📍</div>
                <div>
                  <strong>GPS Check-in Verified</strong>
                  <small>Within 45m of store • 10:14 AM UTC</small>
                </div>
              </div>

              {/* Checklist progress */}
              <div className="mobile-checklist-block">
                <div className="checklist-progress-header">
                  <span>Store Visit Checklist</span>
                  <strong className="text-success">3 / 3 Items Done</strong>
                </div>

                <ul className="mobile-check-list">
                  <li className="check-item-done">
                    <span className="check-box-icon" aria-hidden="true">✓</span>
                    <span>Facing & Planogram compliance verified</span>
                  </li>
                  <li className="check-item-done">
                    <span className="check-box-icon" aria-hidden="true">✓</span>
                    <span>Cooler temperature recorded (3.8°C)</span>
                  </li>
                  <li className="check-item-done">
                    <span className="check-box-icon" aria-hidden="true">✓</span>
                    <span>Endcap promo photo captured & signed</span>
                  </li>
                </ul>
              </div>

              {/* Mobile CTA */}
              <button
                type="button"
                className="btn btn-primary mobile-checkout-btn"
                disabled
                aria-label="Complete Visit & Check Out (Illustrative preview)"
              >
                <span>Complete Visit & Check Out</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Context Callout */}
        <div className="mobile-callout-pill" aria-hidden="true">
          <span className="callout-indicator" />
          <span>Real-time sync to Manager Dashboard</span>
        </div>
      </div>
    </div>
  );
}

