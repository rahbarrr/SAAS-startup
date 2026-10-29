import Link from "next/link";
import type { ReactNode } from "react";
import { PLAN_CATALOG } from "@/modules/billing/domain";

export function PricingSection(): ReactNode {
  const pilot = PLAN_CATALOG.pilot;
  const pro = PLAN_CATALOG.pro;
  const enterprise = PLAN_CATALOG.enterprise;

  return (
    <section id="pricing" className="pricing-section" aria-labelledby="pricing-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">TRANSPARENT SUBSCRIPTION TIERS</span>
          <h2 id="pricing-heading" className="section-title">
            Predictable pricing for growing field teams.
          </h2>
          <p className="section-subtitle">
            Start with our 14-day structured evaluation pilot. Upgrade to Pro or Enterprise
            as your store directory, field headcount, and territory requirements scale.
          </p>
        </div>

        {/* 3 Pricing Cards */}
        <div className="pricing-grid">
          {/* Pilot Trial */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-tier-badge">EVALUATION</span>
              <h3 className="pricing-plan-name">{pilot.name}</h3>
              <p className="pricing-tagline">{pilot.tagline}</p>
            </div>

            <div className="pricing-cost-block">
              <div className="pricing-amount-row">
                <span className="price-currency">$</span>
                <span className="price-number">0</span>
              </div>
              <span className="price-period">14-day full pilot access</span>
            </div>

            <div className="pricing-entitlements-box">
              <div className="entitlement-item">
                <span className="entitlement-key">Included Seats:</span>
                <span className="entitlement-val">Up to 5 team members</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Active Stores:</span>
                <span className="entitlement-val">15 retail doors</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Monthly Visits:</span>
                <span className="entitlement-val">50 store visits</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Evidence Storage:</span>
                <span className="entitlement-val">2 GB secure vault</span>
              </div>
            </div>

            <ul className="pricing-features-list">
              {pilot.features.map((feature) => (
                <li key={feature}>
                  <span className="feature-check" aria-hidden="true">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="pricing-cta-wrapper">
              <Link
                href="/signup"
                className="btn btn-secondary pricing-btn"
              >
                <span>Start Free Pilot</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">Instant setup • No card required</small>
            </div>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="pricing-card pricing-card-featured">
            <div className="featured-banner-tag">MOST POPULAR FOR REGIONAL TEAMS</div>

            <div className="pricing-card-header">
              <span className="pricing-tier-badge badge-pro">PRODUCTION</span>
              <h3 className="pricing-plan-name">{pro.name}</h3>
              <p className="pricing-tagline">{pro.tagline}</p>
            </div>

            <div className="pricing-cost-block">
              <div className="pricing-amount-row">
                <span className="price-currency">$</span>
                <span className="price-number">{pro.monthlyBasePriceUsd}</span>
                <span className="price-frequency">/mo</span>
              </div>
              <span className="price-period">Base includes {pro.includedSeats} seats • +${pro.monthlySeatPriceUsd}/extra seat</span>
            </div>

            <div className="pricing-entitlements-box">
              <div className="entitlement-item">
                <span className="entitlement-key">Included Seats:</span>
                <span className="entitlement-val">15 included (expandable)</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Active Stores:</span>
                <span className="entitlement-val">Up to 150 retail doors</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Monthly Visits:</span>
                <span className="entitlement-val">1,000 completed visits</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Evidence Storage:</span>
                <span className="entitlement-val">50 GB secure vault</span>
              </div>
            </div>

            <ul className="pricing-features-list">
              {pro.features.map((feature) => (
                <li key={feature}>
                  <span className="feature-check check-accent" aria-hidden="true">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
              <li>
                <span className="feature-check check-accent" aria-hidden="true">✓</span>
                <span>Manager approval workflows &amp; live dashboards</span>
              </li>
              <li>
                <span className="feature-check check-accent" aria-hidden="true">✓</span>
                <span>CSV export with formula injection defense</span>
              </li>
            </ul>

            <div className="pricing-cta-wrapper">
              <Link
                href="/signup"
                className="btn btn-primary pricing-btn btn-pro"
              >
                <span>Get Started with Pro</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">Billed monthly via Stripe • Cancel anytime</small>
            </div>
          </div>

          {/* Enterprise Tier */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-tier-badge">HIGH-SCALE</span>
              <h3 className="pricing-plan-name">{enterprise.name}</h3>
              <p className="pricing-tagline">{enterprise.tagline}</p>
            </div>

            <div className="pricing-cost-block">
              <div className="pricing-amount-row">
                <span className="price-currency">$</span>
                <span className="price-number">{enterprise.monthlyBasePriceUsd}</span>
                <span className="price-frequency">/mo</span>
              </div>
              <span className="price-period">Base includes {enterprise.includedSeats} seats • +${enterprise.monthlySeatPriceUsd}/extra seat</span>
            </div>

            <div className="pricing-entitlements-box">
              <div className="entitlement-item">
                <span className="entitlement-key">Included Seats:</span>
                <span className="entitlement-val">50 included (up to 1,000)</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Active Stores:</span>
                <span className="entitlement-val">Up to 10,000 doors</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Monthly Visits:</span>
                <span className="entitlement-val">100,000 visits</span>
              </div>
              <div className="entitlement-item">
                <span className="entitlement-key">Evidence Storage:</span>
                <span className="entitlement-val">1 TB secure vault</span>
              </div>
            </div>

            <ul className="pricing-features-list">
              {enterprise.features.map((feature) => (
                <li key={feature}>
                  <span className="feature-check" aria-hidden="true">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
              <li>
                <span className="feature-check" aria-hidden="true">✓</span>
                <span>Dedicated account manager &amp; onboarding</span>
              </li>
            </ul>

            <div className="pricing-cta-wrapper">
              <Link
                href="/signup"
                className="btn btn-secondary pricing-btn"
              >
                <span>Contact Enterprise</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">Custom terms &amp; invoicing available</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

