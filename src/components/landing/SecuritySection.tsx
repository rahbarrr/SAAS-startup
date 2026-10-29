import type { ReactNode } from "react";

export function SecuritySection(): ReactNode {
  return (
    <section
      id="security"
      className="security-section"
      aria-labelledby="security-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">TRUST & TRANSPARENCY</span>
          <h2 id="security-heading" className="section-title">
            Visibility for managers. Transparency for field teams.
          </h2>
          <p className="section-subtitle">
            We believe enterprise operational visibility shouldn&apos;t compromise
            employee dignity or data boundaries. FieldTrack is built on strict data
            isolation and ethical, purpose-specific location practices.
          </p>
        </div>

        {/* 4 Security Architecture Pillars */}
        <div className="security-grid">
          {/* Item 1 */}
          <div className="security-card">
            <div className="security-icon-circle icon-shield" aria-hidden="true">
              🛡️
            </div>
            <h3 className="security-card-title">Multi-Tenant Row-Level Security</h3>
            <p className="security-card-desc">
              Every database query and storage request is isolated at the PostgreSQL
              engine level. Row-Level Security (RLS) policies mathematically prevent one
              organization from ever reading or modifying another tenant&apos;s data.
            </p>
            <div className="security-tag-pill">
              <span>PostgreSQL RLS Hardened</span>
            </div>
          </div>

          {/* Item 2 */}
          <div className="security-card">
            <div className="security-icon-circle icon-location" aria-hidden="true">
              📍
            </div>
            <h3 className="security-card-title">Consent-Driven, Point-in-Time GPS</h3>
            <p className="security-card-desc">
              Location coordinates are collected <em>only</em> at the exact second a field
              employee actively taps &ldquo;Check In&rdquo; or &ldquo;Check Out&rdquo;.
              FieldTrack does not run background location tracking or continuous
              monitoring.
            </p>
            <div className="security-tag-pill">
              <span>Zero Background Tracking</span>
            </div>
          </div>

          {/* Item 3 */}
          <div className="security-card">
            <div className="security-icon-circle icon-lock" aria-hidden="true">
              🔒
            </div>
            <h3 className="security-card-title">Private Evidence Vault</h3>
            <p className="security-card-desc">
              Store photos and checklist documents are stored in private Supabase Storage
              buckets. Access requires signed, time-limited URLs that automatically expire
              within 15 minutes and are restricted strictly to authorized workspace
              members.
            </p>
            <div className="security-tag-pill">
              <span>15-Minute Signed URLs</span>
            </div>
          </div>

          {/* Item 4 */}
          <div className="security-card">
            <div className="security-icon-circle icon-history" aria-hidden="true">
              📜
            </div>
            <h3 className="security-card-title">Immutable Audit Trails</h3>
            <p className="security-card-desc">
              Key operational events—including trip submissions, manager approval
              decisions, rejections, and store check-ins—are committed to append-only
              audit tables. Database triggers prevent retroactive alteration of historic
              records.
            </p>
            <div className="security-tag-pill">
              <span>Append-Only Event Ledger</span>
            </div>
          </div>
        </div>

        {/* Security Transparency Callout Box */}
        <div className="security-transparency-banner">
          <div className="transparency-icon-box" aria-hidden="true">
            ⚖️
          </div>
          <div className="transparency-content">
            <h4 className="transparency-title">Our Operational Security Commitment</h4>
            <p className="transparency-text">
              We never fabricate compliance badges or claim unverified third-party
              certifications. Our security architecture is founded on transparent
              engineering: cryptographically signed sessions, HttpOnly cookies, verified
              least-privilege database roles, and formula-injection protection on every
              CSV data export.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
