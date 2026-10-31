import Link from "next/link";
import type { ReactNode } from "react";

export function LandingFooter(): ReactNode {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-section-container">
        <div className="footer-top-grid">
          {/* Brand Column */}
          <div className="footer-brand-col">
            <Link href="/" className="landing-brand-link">
              <div className="landing-brand-icon" aria-hidden="true">
                F
              </div>
              <span className="landing-brand-name">FieldTrack</span>
            </Link>
            <p className="footer-brand-mission">
              Enterprise B2B field operations and travel tracking platform for distributed
              retail, FMCG, and merchandising organizations.
            </p>
            <div className="footer-security-badge">
              <span className="security-shield-icon" aria-hidden="true">
                🔒
              </span>
              <span>PostgreSQL Row-Level Security Enforced</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Platform</h4>
            <ul className="footer-nav-list">
              <li>
                <a href="#product">Product Capabilities</a>
              </li>
              <li>
                <a href="#features">Core Features</a>
              </li>
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#faq">Frequently Asked Questions</a>
              </li>
            </ul>
          </div>

          {/* Operations Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Operations</h4>
            <ul className="footer-nav-list">
              <li>
                <Link href="/dashboard">Manager Dashboard</Link>
              </li>
              <li>
                <Link href="/trips">Trip Planning</Link>
              </li>
              <li>
                <Link href="/approvals">Approval Queue</Link>
              </li>
              <li>
                <Link href="/visits">Store Visits</Link>
              </li>
              <li>
                <Link href="/stores">Stores &amp; Territories</Link>
              </li>
              <li>
                <Link href="/reports">Territory Analytics</Link>
              </li>
            </ul>
          </div>

          {/* Access & Account */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Account &amp; Access</h4>
            <ul className="footer-nav-list">
              <li>
                <Link href="/login">Sign In</Link>
              </li>
              <li>
                <Link href="/signup">Get Started / Register</Link>
              </li>
              <li>
                <Link href="/onboarding">Join via Invitation</Link>
              </li>
              <li>
                <Link href="/forgot-password">Reset Password</Link>
              </li>
              <li>
                <Link href="/settings">Workspace Settings</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom-bar">
          <p className="footer-copyright">
            © {currentYear} FieldTrack Inc. Multi-tenant architecture with row-level
            security, consent-driven point-in-time GPS check-ins, and tamper-evident audit
            trails.
          </p>

          <div className="footer-bottom-links">
            <a href="#product" className="footer-bottom-link">
              Platform Overview
            </a>
            <span className="bottom-divider" aria-hidden="true">
              •
            </span>
            <a href="#faq" className="footer-bottom-link">
              Privacy &amp; Security FAQ
            </a>
            <span className="bottom-divider" aria-hidden="true">
              •
            </span>
            <Link href="/login" className="footer-bottom-link">
              Member Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
