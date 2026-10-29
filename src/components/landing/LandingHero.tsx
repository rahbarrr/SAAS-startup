import Link from "next/link";
import type { ReactNode } from "react";
import { ProductDashboardPreview } from "./ProductDashboardPreview";

export function LandingHero(): ReactNode {
  return (
    <section className="landing-hero" aria-labelledby="hero-heading">
      <div className="landing-hero-container">
        {/* Top Eyebrow Pill */}
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          <span className="eyebrow-text">Field Operations & Travel Tracking SaaS</span>
          <span className="eyebrow-separator" aria-hidden="true">
            •
          </span>
          <span className="eyebrow-highlight">Retail & FMCG Specialized</span>
        </div>

        {/* Main Headline */}
        <h1 id="hero-heading" className="hero-headline">
          Bring Every Field Trip, Store Visit{" "}
          <span className="headline-accent">and Team Activity Into One Place.</span>
        </h1>

        {/* Supporting Copy */}
        <p className="hero-subhead">
          Plan field visits, streamline trip approvals, capture on-site evidence and
          understand execution through one organized field operations platform.
        </p>

        {/* Dual CTAs */}
        <div className="hero-cta-group">
          <Link href="/signup" className="btn btn-primary hero-primary-btn">
            <span>Get Started</span>
            <span aria-hidden="true">→</span>
          </Link>
          <a href="#how-it-works" className="btn btn-secondary hero-secondary-btn">
            Explore How It Works
          </a>
        </div>

        {/* Evaluation note */}
        <p className="hero-guarantee-note">
          14-day full evaluation pilot • No credit card required • Instant workspace setup
        </p>

        {/* 3 Core Value Pills */}
        <div className="hero-benefits-row" role="list">
          <div className="hero-benefit-item" role="listitem">
            <span className="benefit-icon" aria-hidden="true">
              ✓
            </span>
            <span>Structured trip planning and approvals</span>
          </div>
          <div className="hero-benefit-item" role="listitem">
            <span className="benefit-icon" aria-hidden="true">
              ✓
            </span>
            <span>Verified store visits and evidence</span>
          </div>
          <div className="hero-benefit-item" role="listitem">
            <span className="benefit-icon" aria-hidden="true">
              ✓
            </span>
            <span>Clear field activity and reporting</span>
          </div>
        </div>

        {/* Interactive / Realistic Product Composition */}
        <div className="hero-visual-container">
          <ProductDashboardPreview />
        </div>
      </div>
    </section>
  );
}
