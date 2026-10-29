import Link from "next/link";
import type { ReactNode } from "react";

export interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return (
    <div className="auth-layout">
      {/* Brand Hero Panel (Desktop) */}
      <aside className="auth-brand-panel" aria-label="FieldTrack overview">
        <div>
          <Link href="/" className="auth-brand-link">
            <div className="brand-icon-box">F</div>
            <span>FieldTrack</span>
          </Link>
        </div>

        <div>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#c9c0ff",
              marginBottom: "0.75rem",
            }}
          >
            ENTERPRISE FIELD OPERATIONS
          </span>
          <h2 className="auth-brand-headline">
            Operational visibility for distributed field teams.
          </h2>
          <p className="auth-brand-copy">
            Plan field visits, streamline trip approvals, capture on-site evidence, and
            understand store execution from one unified platform.
          </p>

          <ul className="auth-feature-list">
            <li className="auth-feature-item">
              <span className="auth-feature-icon" aria-hidden="true">
                ✓
              </span>
              <span>Multi-stop trip planning with hierarchical manager approvals</span>
            </li>
            <li className="auth-feature-item">
              <span className="auth-feature-icon" aria-hidden="true">
                ✓
              </span>
              <span>Point-in-time GPS check-ins and structured store checklists</span>
            </li>
            <li className="auth-feature-item">
              <span className="auth-feature-icon" aria-hidden="true">
                ✓
              </span>
              <span>Strict organization isolation enforced with Row-Level Security</span>
            </li>
          </ul>
        </div>

        <div>
          <p className="auth-brand-footnote">
            © {new Date().getFullYear()} FieldTrack Inc. Enterprise field operations
            platform.
          </p>
        </div>
      </aside>

      {/* Auth Form Panel */}
      <main className="auth-form-panel">
        <div className="auth-form-inner">
          {/* Mobile Brand Link */}
          <div className="auth-mobile-brand">
            <Link href="/" className="auth-brand-link">
              <div className="brand-icon-box">F</div>
              <span>FieldTrack</span>
            </Link>
          </div>

          {children}

          <div style={{ textAlign: "center" }}>
            <Link href="/" className="auth-back-link">
              <span aria-hidden="true">←</span>
              <span>Back to home</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
