import type { ReactNode } from "react";

export function ProblemSection(): ReactNode {
  return (
    <section className="problem-section" aria-labelledby="problem-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">THE OPERATIONAL CHALLENGE</span>
          <h2 id="problem-heading" className="section-title">
            Managing field operations shouldn&apos;t mean chasing updates all day.
          </h2>
          <p className="section-subtitle">
            When field teams operate across dozens of stores, traditional communication channels
            break down—creating blind spots for managers and administrative friction for reps.
          </p>
        </div>

        {/* 3 Visually Distinct Problems */}
        <div className="problem-cards-grid">
          <div className="problem-card">
            <div className="problem-badge badge-danger">Problem 01</div>
            <h3 className="problem-card-title">Scattered Information</h3>
            <p className="problem-card-desc">
              Trip itineraries, store photos, manager approvals, and critical observations are
              scattered across chat groups, personal email inboxes, and fragile spreadsheets.
            </p>
            <div className="problem-impact-pill">
              <span className="impact-dot" aria-hidden="true" />
              <span>Result: Lost records & unsearchable history</span>
            </div>
          </div>

          <div className="problem-card">
            <div className="problem-badge badge-warning">Problem 02</div>
            <h3 className="problem-card-title">Limited Visibility</h3>
            <p className="problem-card-desc">
              Managers struggle to verify which store visits actually occurred, whether audits
              were completed thoroughly, and where urgent store follow-up is required.
            </p>
            <div className="problem-impact-pill">
              <span className="impact-dot" aria-hidden="true" />
              <span>Result: Delayed decisions & unchecked exceptions</span>
            </div>
          </div>

          <div className="problem-card">
            <div className="problem-badge badge-neutral">Problem 03</div>
            <h3 className="problem-card-title">Inconsistent Reporting</h3>
            <p className="problem-card-desc">
              Manual end-of-week summaries vary wildly in quality and detail between reps,
              making it impossible to fairly compare territory performance or identify trends.
            </p>
            <div className="problem-impact-pill">
              <span className="impact-dot" aria-hidden="true" />
              <span>Result: Inaccurate KPIs & flawed forecasting</span>
            </div>
          </div>
        </div>

        {/* Visual Workflow Comparison: Fragmented vs Centralized */}
        <div className="workflow-comparison-wrapper">
          <div className="comparison-card card-fragmented">
            <div className="comparison-header">
              <span className="comparison-badge badge-status-danger">Fragmented Traditional Workflow</span>
              <h4>Spreadsheet & Chat Chaos</h4>
            </div>

            <div className="comparison-flow-list">
              <div className="comparison-step step-bad">
                <span className="step-num">1</span>
                <div>
                  <strong>Unsynchronized Route Plans</strong>
                  <p>Reps propose travel via email threads with no link to store directories.</p>
                </div>
              </div>
              <div className="comparison-step step-bad">
                <span className="step-num">2</span>
                <div>
                  <strong>Informal Chat Approvals</strong>
                  <p>Managers send thumbs-up in WhatsApp without structured travel records.</p>
                </div>
              </div>
              <div className="comparison-step step-bad">
                <span className="step-num">3</span>
                <div>
                  <strong>Unverified On-Site Visits</strong>
                  <p>Photos sent with no verifiable GPS check-in or checklist validation.</p>
                </div>
              </div>
              <div className="comparison-step step-bad">
                <span className="step-num">4</span>
                <div>
                  <strong>Manual End-of-Month Consolidation</strong>
                  <p>Hours wasted copying numbers into executive presentations.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="comparison-divider-box" aria-hidden="true">
            <span>VS</span>
          </div>

          <div className="comparison-card card-centralized">
            <div className="comparison-header">
              <span className="comparison-badge badge-status-success">The FieldTrack Platform</span>
              <h4>Structured Field Operations</h4>
            </div>

            <div className="comparison-flow-list">
              <div className="comparison-step step-good">
                <span className="step-num">1</span>
                <div>
                  <strong>Multi-Stop Itinerary Sequencing</strong>
                  <p>Reps build structured trips selected directly from verified store directories.</p>
                </div>
              </div>
              <div className="comparison-step step-good">
                <span className="step-num">2</span>
                <div>
                  <strong>Audited Manager Approvals</strong>
                  <p>Dedicated approval inbox with mandatory decision notes and audit logging.</p>
                </div>
              </div>
              <div className="comparison-step step-good">
                <span className="step-num">3</span>
                <div>
                  <strong>Consent-Driven GPS Verification</strong>
                  <p>Authorized check-ins enforce required checklists and secure photo evidence.</p>
                </div>
              </div>
              <div className="comparison-step step-good">
                <span className="step-num">4</span>
                <div>
                  <strong>Automated Territory Analytics</strong>
                  <p>Live KPI dashboards, exception alerts, and formula-safe CSV exports.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

