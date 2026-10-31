import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  LandingHeader,
  LandingHero,
  ProductOverviewSection,
  FeatureGrid,
  ProductShowcase,
  WorkflowSection,
  RoleBasedSection,
  PricingSection,
  SecuritySection,
  CredibilitySection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "FieldTrack | Enterprise Field Operations & Trip Management",
  description:
    "Plan field trips, manage approvals, coordinate store visits and gain visibility into team execution with FieldTrack.",
  keywords: [
    "field operations software",
    "trip management",
    "store visit verification",
    "retail field operations",
    "FMCG territory tracking",
    "field trip approvals",
    "GPS store check-in",
    "field execution management",
    "merchandising audits",
    "route optimization",
  ],
  openGraph: {
    title: "FieldTrack | Enterprise Field Operations & Trip Management",
    description:
      "Plan field trips, manage approvals, coordinate store visits and gain visibility into team execution with FieldTrack.",
    type: "website",
    siteName: "FieldTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "FieldTrack | Enterprise Field Operations & Trip Management",
    description:
      "Plan field trips, manage approvals, coordinate store visits and gain visibility into team execution with FieldTrack.",
  },
};

export default function RootLandingPage(): ReactNode {
  return (
    <div className="landing-page-root" aria-labelledby="hero-heading">
      <h1 className="sr-only">
        FieldTrack | Enterprise Field Operations & Trip Management
      </h1>

      {/* Section 1: Premium Navigation */}
      <LandingHeader />

      {/* Main Content Landmark */}
      <main id="main-content" tabIndex={-1}>
        {/* Section 2: Hero Section */}
        <LandingHero />

        {/* Section 3: Product Overview */}
        <ProductOverviewSection />

        {/* Section 4: Core Features */}
        <FeatureGrid />

        {/* Section 5: Interactive Product Showcase */}
        <ProductShowcase />

        {/* Section 6: How It Works */}
        <WorkflowSection />

        {/* Section 7: Solutions by Role */}
        <RoleBasedSection />

        {/* Section 8: Pricing Section */}
        <PricingSection />

        {/* Section 9: Security and Platform Trust */}
        <SecuritySection />

        {/* Section 10: Operational Impact & Credibility */}
        <CredibilitySection />

        {/* Section 11: Resources & FAQ */}
        <FAQSection />

        {/* Section 12: Final CTA */}
        <FinalCTA />
      </main>

      {/* Section 13: Complete Footer */}
      <LandingFooter />
    </div>
  );
}
