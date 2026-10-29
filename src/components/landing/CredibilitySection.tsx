import type { ReactNode } from "react";

export function CredibilitySection(): ReactNode {
  return (
    <section className="credibility-section" aria-labelledby="credibility-heading">
      <div className="credibility-container">
        <h2 id="credibility-heading" className="sr-only">
          Operational Credibility and Design Principles
        </h2>

        <div className="credibility-header">
          <span className="credibility-tag">OPERATIONAL CLARITY AT SCALE</span>
          <p className="credibility-title">
            Purpose-built to solve the operational friction of distributed field teams.
          </p>
        </div>

        <div className="credibility-grid">
          <div className="credibility-card">
            <div className="credibility-icon-box" aria-hidden="true">
              📑
            </div>
            <h3 className="credibility-card-title">Eliminate Fragmented Tools</h3>
            <p className="credibility-card-desc">
              Replace messy WhatsApp groups, email threads, and loose spreadsheets with a
              single source of truth for itineraries, visit logs, and manager decisions.
            </p>
          </div>

          <div className="credibility-card">
            <div className="credibility-icon-box" aria-hidden="true">
              📋
            </div>
            <h3 className="credibility-card-title">Standardize Store Reporting</h3>
            <p className="credibility-card-desc">
              Enforce consistent, itemized checklists across every retail territory so
              regional managers evaluate compliance and execution with equal standards.
            </p>
          </div>

          <div className="credibility-card">
            <div className="credibility-icon-box" aria-hidden="true">
              🗄️
            </div>
            <h3 className="credibility-card-title">Centralize Field Evidence</h3>
            <p className="credibility-card-desc">
              Organize store display photos, stock notes, and checklist receipts into
              private, tenant-isolated storage vaults accessible only by authorized team
              members.
            </p>
          </div>

          <div className="credibility-card">
            <div className="credibility-icon-box" aria-hidden="true">
              🗺️
            </div>
            <h3 className="credibility-card-title">Territory-Wide Visibility</h3>
            <p className="credibility-card-desc">
              Give headquarters and regional leaders live visibility into visit progress,
              route adherence, and store exceptions without micro-managing field reps.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
