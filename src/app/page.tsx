import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  LandingHeader,
  LandingHero,
  ProductShowcase,
  FeatureGrid,
  WorkflowSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "FieldTrack | Field Operations and Trip Management",
  description:
    "Plan field trips, manage approvals, execute store visits and monitor field team operations with FieldTrack.",
  keywords: [
    "field operations software",
    "trip management",
    "store visit verification",
    "retail field operations",
    "FMCG territory tracking",
    "field trip approvals",
    "GPS store check-in",
    "field execution management",
  ],
  openGraph: {
    title: "FieldTrack | Field Operations and Trip Management",
    description:
      "Plan field trips, manage approvals, execute store visits and monitor field team operations with FieldTrack.",
    type: "website",
    siteName: "FieldTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "FieldTrack | Field Operations and Trip Management",
    description:
      "Plan field trips, manage approvals, execute store visits and monitor field team operations with FieldTrack.",
  },
};

export default function RootLandingPage(): ReactNode {
  return (
    <div className="landing-page-root" aria-labelledby="hero-heading">
      <h1 className="sr-only">FieldTrack | Field Operations and Trip Management</h1>

      {/* Section 1: Premium Navigation */}
      <LandingHeader />

      {/* Main Content Landmark */}
      <main id="main-content" tabIndex={-1}>
        {/* Section 2: Hero Section */}
        <LandingHero />

        {/* Section 3: Product Showcase */}
        <ProductShowcase />

        {/* Section 4: Core Features */}
        <FeatureGrid />

        {/* Section 5: How FieldTrack Works */}
        <WorkflowSection />

        {/* Section 6: FAQ */}
        <FAQSection />

        {/* Section 7: Final CTA */}
        <FinalCTA />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
