"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme";
import { ShieldCheck } from "lucide-react";

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
              retail, FMCG sales, and store merchandising organizations.
            </p>
            <div className="footer-security-badge">
              <ShieldCheck size={16} className="text-success" aria-hidden="true" />
              <span>PostgreSQL Row-Level Security Enforced</span>
            </div>
            <div className="footer-theme-toggle-wrap">
              <span className="footer-toggle-label">Appearance:</span>
              <ThemeToggle ariaLabel="Switch site color theme" />
            </div>
          </div>

          {/* Product Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Platform</h4>
            <ul className="footer-nav-list">
              <li>
                <a href="#product">Product Overview</a>
              </li>
              <li>
                <a href="#features">Core Features</a>
              </li>
              <li>
                <a href="#showcase">Interactive Showcase</a>
              </li>
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#solutions">Solutions by Role</a>
              </li>
              <li>
                <a href="#pricing">Subscription Pricing</a>
              </li>
            </ul>
          </div>

          {/* Operations & App Links */}
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
                <Link href="/approvals">Approval Inboxes</Link>
              </li>
              <li>
                <Link href="/visits">Store Visits</Link>
              </li>
              <li>
                <Link href="/stores">Store Directory</Link>
              </li>
              <li>
                <Link href="/reports">Territory Reports</Link>
              </li>
            </ul>
          </div>

          {/* Account & Resources Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Account &amp; Support</h4>
            <ul className="footer-nav-list">
              <li>
                <Link href="/login">Sign In</Link>
              </li>
              <li>
                <Link href="/signup">Start Free Pilot</Link>
              </li>
              <li>
                <a href="#faq">Frequently Asked Questions</a>
              </li>
              <li>
                <a href="#security">Security &amp; Privacy</a>
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
            &copy; {currentYear} FieldTrack Inc. All rights reserved. Enterprise field
            operations platform.
          </p>
          <div className="footer-legal-links">
            <a href="#security" className="footer-legal-link">
              Privacy &amp; Location Ethics
            </a>
            <span className="footer-legal-sep" aria-hidden="true">
              •
            </span>
            <a href="#security" className="footer-legal-link">
              Terms &amp; Multi-Tenant SLA
            </a>
            <span className="footer-legal-sep" aria-hidden="true">
              •
            </span>
            <a href="#pricing" className="footer-legal-link">
              Commercial Entitlements
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
