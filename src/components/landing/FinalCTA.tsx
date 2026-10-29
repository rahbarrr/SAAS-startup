import Link from "next/link";
import type { ReactNode } from "react";

export function FinalCTA(): ReactNode {
  return (
    <section className="final-cta-section" aria-labelledby="final-cta-heading">
      <div className="landing-section-container">
        <div className="final-cta-card">
          {/* Subtle Decorative Elements */}
          <div className="cta-glow-element" aria-hidden="true" />

          <div className="final-cta-content">
            <span className="final-cta-tag">ENTERPRISE FIELD VISIBILITY</span>
            <h2 id="final-cta-heading" className="final-cta-title">
              Bring clarity to every field visit.
            </h2>
            <p className="final-cta-subhead">
              Bring trip planning, store visit execution, and field reporting into one
              structured workflow. Equip your managers with operational oversight and your
              field team with a modern tool they enjoy using.
            </p>

            <div className="final-cta-buttons">
              <Link
                href="/signup"
                className="btn btn-primary cta-btn-white"
              >
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary cta-btn-outline"
              >
                Sign In to Workspace
              </Link>
            </div>

            <div className="final-cta-meta">
              <span>✓ 14-day evaluation pilot</span>
              <span>•</span>
              <span>✓ Instant multi-tenant organization setup</span>
              <span>•</span>
              <span>✓ No credit card required</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

