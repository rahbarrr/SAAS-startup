import type { ReactNode } from "react";

export function AIReportingSection(): ReactNode {
  return (
    <section className="ai-reporting-section" aria-labelledby="ai-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">HUMAN-IN-THE-LOOP INTELLIGENCE</span>
          <h2 id="ai-heading" className="section-title">
            Less time writing reports. More time acting on insights.
          </h2>
          <p className="section-subtitle">
            FieldTrack transforms unstructured field notes and checklist responses into clear,
            actionable visit briefings. Every AI draft requires employee or manager review and
            explicit sign-off before entering formal audit records.
          </p>
        </div>

        {/* Side-by-Side Example: Source Input vs Generated Draft */}
        <div className="ai-demonstration-card">
          {/* Top Banner explaining the Human-in-the-Loop Principle */}
          <div className="ai-demo-banner">
            <span className="ai-sparkle-pill">✨ AI Synthesis Feature</span>
            <span className="ai-banner-note">
              <strong>Human-in-the-Loop Safeguard:</strong> The AI never independently verifies physical
              visits. It drafts summaries to accelerate reporting; human review is mandatory before saving.
            </span>
          </div>

          <div className="ai-demo-split">
            {/* Left Column: Raw Field Notes & Checklist */}
            <div className="ai-column-input">
              <div className="ai-col-header">
                <span className="ai-col-tag tag-input">SOURCE FIELD DATA</span>
                <h4>Raw Store Notes &amp; Responses</h4>
              </div>

              <div className="ai-input-box">
                <div className="input-meta-row">
                  <span className="text-xs text-muted">Door: HyperCity #104</span>
                  <span className="text-xs text-muted">Rep: Sarah Jenkins</span>
                </div>

                <div className="input-raw-text">
                  &ldquo;Aisle 4 endcap fully restocked with promotional cereal displays.
                  Store manager noted competitor brand launched a flash 20% discount on adjacent aisle 5.
                  Refrigeration unit #2 temp read 12°C on digital gauge, well above the 5°C threshold.
                  Informed floor supervisor Dan about the temperature variance.
                  Manager requested a follow-up restock audit next Tuesday afternoon.&rdquo;
                </div>

                <div className="input-checklist-summary">
                  <span className="text-xs font-semibold text-secondary">Checklist Responses:</span>
                  <ul className="input-checks-list">
                    <li>✓ Planogram Display: 100% compliant</li>
                    <li>⚠️ Cooler Temperature: 12.0°C (Variance Flagged)</li>
                    <li>✓ Stockout Count: 0 missing SKUs</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column: AI-Generated Draft Summary */}
            <div className="ai-column-output">
              <div className="ai-col-header">
                <span className="ai-col-tag tag-ai">AI-GENERATED DRAFT</span>
                <h4>Structured Executive Briefing</h4>
              </div>

              <div className="ai-output-box">
                <div className="ai-draft-status-pill">
                  <span className="draft-dot-pending" aria-hidden="true" />
                  <span>Draft Status: Pending Human Acceptance</span>
                </div>

                <div className="ai-summary-body">
                  <p className="ai-summary-text">
                    <strong>Executive Summary:</strong> Merchandising execution at HyperCity #104 was
                    successfully completed with 100% planogram compliance. However, an equipment variance
                    was detected on Cooler #2 (12°C vs &lt;5°C limit), and competitor discounting was recorded on Aisle 5.
                  </p>

                  <div className="ai-tags-section">
                    <span className="ai-tag-title">Detected Key Observations:</span>
                    <div className="ai-tags-row">
                      <span className="ai-tag tag-success">✓ Planogram Compliant</span>
                      <span className="ai-tag tag-danger">⚠️ Cooler Temp Variance (12°C)</span>
                      <span className="ai-tag tag-info">ℹ️ Competitor Discount (-20%)</span>
                    </div>
                  </div>

                  <div className="ai-actions-section">
                    <span className="ai-tag-title">Suggested Follow-Up Items:</span>
                    <ol className="ai-suggested-actions">
                      <li>Escalate Cooler #2 temperature variance to facility operations.</li>
                      <li>Schedule territory follow-up visit for Tuesday, Nov 3.</li>
                    </ol>
                  </div>
                </div>

                {/* Human Review & Accept Buttons */}
                <div className="ai-action-bar">
                  <button type="button" className="btn btn-primary btn-sm" disabled>
                    <span>✓ Review &amp; Accept Draft</span>
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled>
                    <span>✎ Edit Notes Before Saving</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

