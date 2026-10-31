"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PLAN_CATALOG } from "@/modules/billing/domain";
import { Check, HelpCircle } from "lucide-react";

export function PricingSection(): ReactNode {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const shouldReduceMotion = useReducedMotion();

  const pilot = PLAN_CATALOG.pilot;
  const pro = PLAN_CATALOG.pro;
  const enterprise = PLAN_CATALOG.enterprise;

  // Annual discount calculation (15% savings when billed annually)
  const proAnnualMonthly = Math.round((pro.monthlyBasePriceUsd ?? 149) * 0.85);
  const enterpriseAnnualMonthly = Math.round(
    (enterprise.monthlyBasePriceUsd ?? 499) * 0.85
  );

  const pricingFaqs = [
    {
      q: "How does the 14-day Pilot Trial work?",
      a: "The Pilot Trial is 100% free with no credit card required. You receive full access for up to 5 team members and 15 stores to test itineraries, geofenced visits, and manager approvals with real field data.",
    },
    {
      q: "Can I add more seats as my field team grows?",
      a: "Yes. Pro includes 15 seats and allows adding additional seats at $19/member/month. Enterprise includes 50 seats and allows adding seats at $15/member/month. Seat allocations can be updated anytime in Workspace Settings.",
    },
    {
      q: "How is payment processing handled?",
      a: "Payments are securely processed via Stripe Customer Portal. We accept all major credit cards and offer corporate invoicing for Enterprise accounts.",
    },
    {
      q: "What happens when our evaluation period ends?",
      a: "Your data remains safe in our tenant vault. You can upgrade to Pro directly from your dashboard or export all visit records and photos before transitioning.",
    },
  ];

  return (
    <section id="pricing" className="pricing-section" aria-labelledby="pricing-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <motion.div
          className="section-header-centered"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">TRANSPARENT SUBSCRIPTION TIERS</span>
          <h2 id="pricing-heading" className="section-title">
            Predictable pricing for growing field operations.
          </h2>
          <p className="section-subtitle">
            Start with our 14-day structured evaluation pilot. Upgrade to Pro or
            Enterprise as your store directory, field headcount, and territory
            requirements scale.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pricing-cadence-toggle-wrap">
            <div
              className="pricing-cadence-toggle"
              role="group"
              aria-label="Billing frequency"
            >
              <button
                type="button"
                className={`cadence-btn ${billingCycle === "monthly" ? "active" : ""}`}
                onClick={() => setBillingCycle("monthly")}
                aria-pressed={billingCycle === "monthly"}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                className={`cadence-btn ${billingCycle === "annual" ? "active" : ""}`}
                onClick={() => setBillingCycle("annual")}
                aria-pressed={billingCycle === "annual"}
              >
                <span>Annual Billing</span>
                <span className="save-badge">Save 15%</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* 3 Pricing Cards Grid */}
        <div className="pricing-grid">
          {/* Card 1: Pilot Trial */}
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
              <span className="price-period">14-day full pilot evaluation</span>
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
                  <Check size={16} className="feature-check" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="pricing-cta-wrapper">
              <Link href="/signup" className="btn btn-secondary pricing-btn">
                <span>Start Free Pilot</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">
                Instant setup • No credit card required
              </small>
            </div>
          </div>

          {/* Card 2: Pro Tier (Featured) */}
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
                <span className="price-number">
                  {billingCycle === "annual" ? proAnnualMonthly : pro.monthlyBasePriceUsd}
                </span>
                <span className="price-frequency">/mo</span>
              </div>
              <span className="price-period">
                {billingCycle === "annual"
                  ? `Billed annually ($${proAnnualMonthly * 12}/yr)`
                  : `Base includes ${pro.includedSeats} seats • +$${pro.monthlySeatPriceUsd}/extra seat`}
              </span>
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
                  <Check
                    size={16}
                    className="feature-check check-accent"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
              <li>
                <Check
                  size={16}
                  className="feature-check check-accent"
                  aria-hidden="true"
                />
                <span>Manager approval workflows &amp; live dashboards</span>
              </li>
              <li>
                <Check
                  size={16}
                  className="feature-check check-accent"
                  aria-hidden="true"
                />
                <span>CSV export with formula injection defense</span>
              </li>
            </ul>

            <div className="pricing-cta-wrapper">
              <Link href="/signup" className="btn btn-primary pricing-btn btn-pro">
                <span>Get Started with Pro</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">
                Billed via Stripe Customer Portal • Cancel anytime
              </small>
            </div>
          </div>

          {/* Card 3: Enterprise Tier */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-tier-badge">HIGH-SCALE</span>
              <h3 className="pricing-plan-name">{enterprise.name}</h3>
              <p className="pricing-tagline">{enterprise.tagline}</p>
            </div>

            <div className="pricing-cost-block">
              <div className="pricing-amount-row">
                <span className="price-currency">$</span>
                <span className="price-number">
                  {billingCycle === "annual"
                    ? enterpriseAnnualMonthly
                    : enterprise.monthlyBasePriceUsd}
                </span>
                <span className="price-frequency">/mo</span>
              </div>
              <span className="price-period">
                {billingCycle === "annual"
                  ? `Billed annually ($${enterpriseAnnualMonthly * 12}/yr)`
                  : `Base includes ${enterprise.includedSeats} seats • +$${enterprise.monthlySeatPriceUsd}/extra seat`}
              </span>
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
                  <Check size={16} className="feature-check" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
              <li>
                <Check size={16} className="feature-check" aria-hidden="true" />
                <span>Dedicated account manager &amp; custom onboarding</span>
              </li>
            </ul>

            <div className="pricing-cta-wrapper">
              <Link href="/signup" className="btn btn-secondary pricing-btn">
                <span>Contact Enterprise</span>
                <span aria-hidden="true">→</span>
              </Link>
              <small className="pricing-note">
                Custom terms &amp; invoice payment available
              </small>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="pricing-comparison-section">
          <h3 className="comparison-table-title">Detailed Feature Comparison</h3>
          <div className="table-container">
            <table className="pricing-matrix-table">
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">Pilot Trial</th>
                  <th scope="col">Pro (Recommended)</th>
                  <th scope="col">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Included User Seats</th>
                  <td>5 seats</td>
                  <td>15 seats included (+ $19/seat)</td>
                  <td>50 seats included (+ $15/seat)</td>
                </tr>
                <tr>
                  <th scope="row">Active Stores & Doors</th>
                  <td>Up to 15 stores</td>
                  <td>Up to 150 stores</td>
                  <td>Up to 10,000 stores</td>
                </tr>
                <tr>
                  <th scope="row">Monthly Completed Visits</th>
                  <td>50 visits/month</td>
                  <td>1,000 visits/month</td>
                  <td>100,000 visits/month</td>
                </tr>
                <tr>
                  <th scope="row">GPS Geofencing Verification</th>
                  <td>✓ Point-in-time check-in</td>
                  <td>✓ Radius-verified geofencing</td>
                  <td>✓ Precision threshold tuning</td>
                </tr>
                <tr>
                  <th scope="row">Route Optimization</th>
                  <td>Sequential routing</td>
                  <td>Google Maps API optimized</td>
                  <td>Advanced multi-territory</td>
                </tr>
                <tr>
                  <th scope="row">Manager Approval Inboxes</th>
                  <td>Basic single queue</td>
                  <td>✓ Hierarchical + anti-tamper</td>
                  <td>✓ Multi-level governance</td>
                </tr>
                <tr>
                  <th scope="row">Photo Evidence Storage</th>
                  <td>2 GB private vault</td>
                  <td>50 GB signed-URL vault</td>
                  <td>1 TB enterprise vault</td>
                </tr>
                <tr>
                  <th scope="row">Data Export Security</th>
                  <td>Basic CSV</td>
                  <td>✓ Formula-injection safe CSV</td>
                  <td>✓ Sanitized CSV + audit logs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing FAQ */}
        <div className="pricing-faq-block">
          <div className="pricing-faq-header">
            <HelpCircle size={20} className="text-accent" aria-hidden="true" />
            <h3 className="pricing-faq-title">Billing &amp; Subscription Questions</h3>
          </div>
          <div className="pricing-faq-grid">
            {pricingFaqs.map((faq) => (
              <div key={faq.q} className="pricing-faq-item">
                <strong className="faq-q">{faq.q}</strong>
                <p className="faq-a">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
