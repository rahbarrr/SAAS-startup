import type { ReactNode } from "react";

export function FeatureGrid(): ReactNode {
  return (
    <section
      id="product-capabilities"
      className="feature-grid-section"
      aria-labelledby="features-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">INTEGRATED FIELD SUITE</span>
          <h2 id="features-heading" className="section-title">
            Everything your field operations workflow needs, in one place.
          </h2>
          <p className="section-subtitle">
            Six cohesive capabilities designed to eliminate guesswork, enforce standard operating
            procedures, and provide reliable visibility into ground-level execution.
          </p>
        </div>

        {/* 6 Premium Feature Cards */}
        <div className="feature-cards-grid">
          {/* Card 1: Trip Planning */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-navy" aria-hidden="true">
                🗺️
              </div>
              <span className="feature-status-tag tag-live">Active Capability</span>
            </div>

            <h3 className="feature-title">Multi-Stop Trip Planning</h3>
            <p className="feature-desc">
              Plan employee trips, organize store visits, sequence multi-stop itineraries, and set
              territory schedules directly linked to your master store directory.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-trip">
              <div className="preview-trip-item">
                <span className="preview-dot dot-done">1</span>
                <div>
                  <strong>Stop 1: Downtown Mart</strong>
                  <small>09:00 AM • Planogram Audit</small>
                </div>
              </div>
              <div className="preview-trip-connector" />
              <div className="preview-trip-item">
                <span className="preview-dot dot-active">2</span>
                <div>
                  <strong>Stop 2: HyperCity Express</strong>
                  <small>11:30 AM • Cooler Restock</small>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Trip Approval */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-amber" aria-hidden="true">
                ⚖️
              </div>
              <span className="feature-status-tag tag-live">Active Capability</span>
            </div>

            <h3 className="feature-title">Multi-Tier Trip Approvals</h3>
            <p className="feature-desc">
              Give managers a dedicated workflow to inspect itineraries, review travel dates,
              approve trips, or request revisions with mandatory feedback notes. Self-approval is strictly prevented.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-approval">
              <div className="preview-approval-header">
                <span className="text-sm font-semibold">Trip #TRP-8402 Review</span>
                <span className="badge-warning text-xs">Submitted</span>
              </div>
              <div className="preview-action-row">
                <span className="mini-btn btn-success-light">✓ Approve Itinerary</span>
                <span className="mini-btn btn-danger-light">✎ Request Changes</span>
              </div>
            </div>
          </div>

          {/* Card 3: Store Visit Verification */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-green" aria-hidden="true">
                📍
              </div>
              <span className="feature-status-tag tag-live">Active Capability</span>
            </div>

            <h3 className="feature-title">Store Visit Verification</h3>
            <p className="feature-desc">
              Record authorized GPS check-ins and check-outs with cryptographic timestamps and
              idempotent visit tokens. Location is strictly captured with employee consent at check-in.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-checkin">
              <div className="checkin-gps-pill">
                <span className="gps-live-dot" aria-hidden="true" />
                <span>GPS Check-in: 41.881832, -87.623177</span>
              </div>
              <div className="checkin-meta-row">
                <span>Distance to Door: 28 meters</span>
                <span className="text-success font-semibold">Authorized ✓</span>
              </div>
            </div>
          </div>

          {/* Card 4: Checklists and Evidence */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-purple" aria-hidden="true">
                📋
              </div>
              <span className="feature-status-tag tag-live">Active Capability</span>
            </div>

            <h3 className="feature-title">Checklists & Evidence Vault</h3>
            <p className="feature-desc">
              Standardize store visit inspections with mandatory checklist items, capture aisle
              observations, and upload photographic evidence directly into private storage buckets.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-checklist">
              <div className="mini-check-row">
                <span className="check-box-done">✓</span>
                <span>Planogram Compliance Verified</span>
              </div>
              <div className="mini-check-row">
                <span className="check-box-done">✓</span>
                <span>Endcap Photo Captured (2.4 MB)</span>
              </div>
            </div>
          </div>

          {/* Card 5: Manager Dashboard and Reports */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-blue" aria-hidden="true">
                📊
              </div>
              <span className="feature-status-tag tag-live">Active Capability</span>
            </div>

            <h3 className="feature-title">Manager Dashboard & CSV Reports</h3>
            <p className="feature-desc">
              Review live field execution, trip progress, exceptions, and planned vs. actual
              stop metrics. Export clean, formula-injection-safe CSV files for executive reporting.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-reports">
              <div className="mini-stat-bar">
                <span>Planned vs Actual: <strong>94.2%</strong></span>
                <span className="tag-green text-xs">Target Met</span>
              </div>
              <div className="mini-bar-track">
                <div className="mini-bar-fill" style={{ width: "94%" }} />
              </div>
            </div>
          </div>

          {/* Card 6: AI-Assisted Visit Summaries */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon-box icon-amber-dark" aria-hidden="true">
                ✨
              </div>
              <span className="feature-status-tag tag-live">Human-in-the-Loop</span>
            </div>

            <h3 className="feature-title">AI-Assisted Visit Summaries</h3>
            <p className="feature-desc">
              Transform unstructured rep notes and checklist responses into clear, concise draft
              briefings. Every draft requires human review and explicit acceptance before saving.
            </p>

            {/* Visual Micro Preview */}
            <div className="feature-micro-preview preview-ai">
              <div className="ai-badge-row">
                <span className="badge-ai-sparkle">AI Draft</span>
                <span className="text-xs text-muted">Pending Manager Acceptance</span>
              </div>
              <p className="ai-snippet-text">
                &ldquo;Competitor launched temporary 20% discount on shelf B. Cooler #2 temp flagged at 12°C.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

