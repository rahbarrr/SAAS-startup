import type { ReactNode } from "react";

export function RoleBasedSection(): ReactNode {
  return (
    <section id="roles" className="roles-section" aria-labelledby="roles-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">TAILORED ACCESS & PERMISSIONS</span>
          <h2 id="roles-heading" className="section-title">
            One platform. A clearer workflow for every role.
          </h2>
          <p className="section-subtitle">
            Strict PostgreSQL Row-Level Security ensures that each stakeholder operates with
            exact permissions, dedicated views, and zero unauthorized data exposure.
          </p>
        </div>

        {/* 3 Role Cards */}
        <div className="roles-grid">
          {/* Admin */}
          <div className="role-card">
            <div className="role-card-header">
              <span className="role-badge badge-role-admin">Administrator</span>
              <span className="role-scope">Governance & Control</span>
            </div>

            <h3 className="role-title">Workspace Governance</h3>
            <p className="role-desc">
              Manage organization accounts, maintain store master data, configure territory boundaries,
              and enforce compliance across all company workspaces.
            </p>

            <ul className="role-feature-list">
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Multi-Tenant Workspace Management:</strong> Configure organizations, seats, and billing tiers.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Master Store Directory:</strong> Import, geocode, and organize retail doors and chains.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Team Onboarding & Roles:</strong> Invite managers and reps with granular RLS authorization.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Security & Audit Trails:</strong> Review immutable audit logs of every system transaction.</span>
              </li>
            </ul>
          </div>

          {/* Manager */}
          <div className="role-card role-card-featured">
            <div className="role-card-header">
              <span className="role-badge badge-role-manager">Area & Regional Manager</span>
              <span className="role-scope">Oversight & Decisions</span>
            </div>

            <h3 className="role-title">Field Operations Oversight</h3>
            <p className="role-desc">
              Review and decide travel requests, monitor real-time visit pacing, inspect photo
              evidence, and act on out-of-stock and merchandising exceptions.
            </p>

            <ul className="role-feature-list">
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Approval Queue:</strong> Inspect itineraries and approve travel with mandatory audit notes.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Live Visit Monitoring:</strong> Track check-ins, check-outs, and stop completion rates.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Exception Handling:</strong> Receive instant alerts for missing checklist items or stockouts.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Territory Analytics:</strong> Filter planned vs. actual performance and export CSV audits.</span>
              </li>
            </ul>
          </div>

          {/* Field Employee */}
          <div className="role-card">
            <div className="role-card-header">
              <span className="role-badge badge-role-employee">Field Representative</span>
              <span className="role-scope">Aisle-Side Execution</span>
            </div>

            <h3 className="role-title">Frictionless Ground Execution</h3>
            <p className="role-desc">
              View scheduled itineraries, check in at retail doors with consent-driven GPS,
              complete standardized checklists, and capture photo proof on-site.
            </p>

            <ul className="role-feature-list">
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Daily Itineraries:</strong> Sequenced store routes with door addresses and contact info.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Consent-Based GPS Check-in:</strong> Verify physical arrival without background tracking.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Aisle Checklists:</strong> Step-by-step audit forms with offline resilience and sync.</span>
              </li>
              <li>
                <span className="role-check" aria-hidden="true">✓</span>
                <span><strong>Instant Photo Upload:</strong> Securely capture and submit endcap and shelf evidence.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

