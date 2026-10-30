import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildRootOAuthCallbackRedirect } from "@/modules/auth/root-oauth-callback";
import {
  LandingAnnouncement,
  LandingHeader,
  LandingHero,
  CredibilitySection,
  ProblemSection,
  FeatureGrid,
  WorkflowSection,
  RoleBasedSection,
  ProductShowcase,
  SecuritySection,
  AIReportingSection,
  PricingSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "FieldTrack — Field Operations & Travel Tracking SaaS for Retail & FMCG",
  description:
    "Plan store visits, approve field trips, capture on-site evidence, and review execution from one place. Purpose-built field operations and travel tracking platform for distributed retail, FMCG, and sales teams.",
  keywords: [
    "field operations software",
    "retail store visits",
    "FMCG field sales tracking",
    "merchandising audit",
    "trip planning and approval",
    "GPS store check-in",
    "field team management",
    "store visit verification",
  ],
  openGraph: {
    title: "FieldTrack — See Your Field Operations Getting Done",
    description:
      "Plan store visits, approve travel, record authorized GPS check-ins, and review field performance from one structured dashboard.",
    type: "website",
    siteName: "FieldTrack",
  },
};

interface RootLandingPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RootLandingPage({
  searchParams,
}: RootLandingPageProps): Promise<ReactNode> {
  const callbackRedirect = buildRootOAuthCallbackRedirect((await searchParams) ?? {});
  if (callbackRedirect) {
    // Supabase can fall back to the Site URL ("/") for OAuth responses.
    // Exchange the code on this same origin so the PKCE cookie remains available.
    redirect(callbackRedirect);
  }

  return (
    <div className="landing-page-root" aria-labelledby="hero-heading">
      <h1 className="sr-only">
        FieldTrack — Field Operations &amp; Travel Tracking SaaS
      </h1>

      {/* Section A: Announcement Bar */}
      <LandingAnnouncement />

      {/* Section B: Navigation Bar */}
      <LandingHeader />

      {/* Main Content Landmark */}
      <main id="main-content" tabIndex={-1}>
        {/* Section C: Hero Section with Live Product Composition */}
        <LandingHero />

        {/* Section D: Operational Trust and Credibility */}
        <CredibilitySection />

        {/* Section E: The Problem (Scattered Tools vs Centralized Workflow) */}
        <ProblemSection />

        {/* Section F: 6 Integrated Product Capabilities */}
        <FeatureGrid />

        {/* Section G: 4-Step Operational Workflow (Plan -> Approve -> Execute -> Review) */}
        <WorkflowSection />

        {/* Section H: Role-Based Value (Admin, Manager, Field Representative) */}
        <RoleBasedSection />

        {/* Section I: Interactive Product Showcase (Planning, Visits, Reports) */}
        <ProductShowcase />

        {/* Section J: Responsible Location & Data Security Architecture */}
        <SecuritySection />

        {/* Section K: AI-Assisted Reporting & Human-in-the-Loop Synthesis */}
        <AIReportingSection />

        {/* Section L: Real Subscription Pricing & Evaluation Pilot */}
        <PricingSection />

        {/* Section M: Accessible Frequently Asked Questions Accordion */}
        <FAQSection />

        {/* Section N: Final High-Impact Conversion CTA */}
        <FinalCTA />
      </main>

      {/* Section O: Enterprise Responsive Footer */}
      <LandingFooter />
    </div>
  );
}
