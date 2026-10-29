import type { ReactNode } from "react";

export function WorkflowSection(): ReactNode {
  return (
    <section
      id="how-it-works"
      className="workflow-section"
      aria-labelledby="workflow-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">STEP-BY-STEP WORKFLOW</span>
          <h2 id="workflow-heading" className="section-title">
            From trip planning to verified execution.
          </h2>
          <p className="section-subtitle">
            A clear, four-phase operational cycle that ensures accountability before,
            during, and after every store visit.
          </p>
        </div>

        {/* 4-Step Sequence */}
        <div className="workflow-sequence">
          {/* Step 1 */}
          <div className="workflow-step-card">
            <div className="workflow-step-top">
              <span className="workflow-step-num">01</span>
              <span className="workflow-step-pill">Pre-Travel</span>
            </div>

            <h3 className="workflow-step-title">Plan the Route</h3>
            <p className="workflow-step-desc">
              Field employees build travel plans with clear objectives, start/end dates,
              and sequenced store stops chosen directly from the organization&apos;s
              verified store directory.
            </p>

            <div className="workflow-step-preview">
              <div className="step-preview-item">
                <span className="preview-indicator indicator-blue" />
                <span>Select Store Doors</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-blue" />
                <span>Estimate Allowances & Goals</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-blue" />
                <span>Submit for Manager Review</span>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="workflow-connector" aria-hidden="true">
            <span className="connector-line" />
            <span className="connector-arrow">→</span>
          </div>

          {/* Step 2 */}
          <div className="workflow-step-card">
            <div className="workflow-step-top">
              <span className="workflow-step-num">02</span>
              <span className="workflow-step-pill pill-amber">Oversight</span>
            </div>

            <h3 className="workflow-step-title">Manager Approves</h3>
            <p className="workflow-step-desc">
              The assigned manager inspects the proposed stops and dates in their approval
              queue. They can approve the itinerary, reject it, or request changes with
              mandatory notes.
            </p>

            <div className="workflow-step-preview">
              <div className="step-preview-item">
                <span className="preview-indicator indicator-amber" />
                <span>Validate Territory Coverage</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-amber" />
                <span>Prevent Duplicate Visits</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-amber" />
                <span>Enforce Travel Policy</span>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="workflow-connector" aria-hidden="true">
            <span className="connector-line" />
            <span className="connector-arrow">→</span>
          </div>

          {/* Step 3 */}
          <div className="workflow-step-card">
            <div className="workflow-step-top">
              <span className="workflow-step-num">03</span>
              <span className="workflow-step-pill pill-green">On-Site</span>
            </div>

            <h3 className="workflow-step-title">Execute & Verify</h3>
            <p className="workflow-step-desc">
              On arrival, the representative triggers an authorized GPS check-in, performs
              required shelf inspections, records observations, and uploads photo evidence
              before checkout.
            </p>

            <div className="workflow-step-preview">
              <div className="step-preview-item">
                <span className="preview-indicator indicator-green" />
                <span>Consent-Driven GPS Check-in</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-green" />
                <span>Mandatory Checklist Items</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-green" />
                <span>Signed Photographic Proof</span>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="workflow-connector" aria-hidden="true">
            <span className="connector-line" />
            <span className="connector-arrow">→</span>
          </div>

          {/* Step 4 */}
          <div className="workflow-step-card">
            <div className="workflow-step-top">
              <span className="workflow-step-num">04</span>
              <span className="workflow-step-pill pill-purple">Analytics</span>
            </div>

            <h3 className="workflow-step-title">Review & Insights</h3>
            <p className="workflow-step-desc">
              Managers review execution outcomes, inspect photos, resolve exceptions, and
              verify territory compliance. AI summaries provide structured briefings after
              human sign-off.
            </p>

            <div className="workflow-step-preview">
              <div className="step-preview-item">
                <span className="preview-indicator indicator-purple" />
                <span>Planned vs. Actual Stop Stats</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-purple" />
                <span>Human-Reviewed AI Summaries</span>
              </div>
              <div className="step-preview-item">
                <span className="preview-indicator indicator-purple" />
                <span>Export Formula-Safe CSV</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
