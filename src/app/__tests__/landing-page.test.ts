import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLandingPage, { metadata } from "@/app/page";
import LandingPage from "@/app/landing/page";
import { PLAN_CATALOG } from "@/modules/billing/domain";
import { isAuthPublicRoute, isProtectedPath } from "@/lib/supabase/middleware";

describe("FieldTrack Enterprise Landing Page (Root Route '/')", () => {
  it("exports valid, SEO-optimized metadata with the established product name", () => {
    expect(metadata.title).toContain("FieldTrack");
    expect(metadata.description).toBeTruthy();
    expect(metadata.openGraph?.title).toContain("FieldTrack");
    expect(metadata.openGraph?.siteName).toBe("FieldTrack");
  });

  it("renders all core sections from Section A through Section O directly at '/' without authentication", () => {
    const html = renderToStaticMarkup(React.createElement(RootLandingPage));

    // Section A: Announcement Bar
    expect(html).toContain("Evaluation Pilot");
    expect(html).toContain("Now accepting FMCG &amp; retail operations teams");

    // Section B: Navigation Header
    expect(html).toContain("FieldTrack");
    expect(html).toContain('href="#product-capabilities"');
    expect(html).toContain('href="#roles"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('href="#security"');
    expect(html).toContain('href="#pricing"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');

    // Section C: Hero Section
    expect(html).toContain("Your field team is on the ground.");
    expect(html).toContain("Now see the work getting done.");
    expect(html).toContain("Structured trip planning and approvals");
    expect(html).toContain("Verified store visits and evidence");
    expect(html).toContain("Clear field activity and reporting");

    // Section D: Trust & Credibility
    expect(html).toContain("Eliminate Fragmented Tools");
    expect(html).toContain("Standardize Store Reporting");
    expect(html).toContain("Centralize Field Evidence");
    expect(html).toContain("Territory-Wide Visibility");

    // Section E: The Problem
    expect(html).toContain("Managing field operations shouldn&#x27;t mean chasing updates all day.");
    expect(html).toContain("Scattered Information");
    expect(html).toContain("Limited Visibility");
    expect(html).toContain("Inconsistent Reporting");
    expect(html).toContain("The FieldTrack Platform");

    // Section F: 6 Integrated Product Capabilities
    expect(html).toContain("Multi-Stop Trip Planning");
    expect(html).toContain("Multi-Tier Trip Approvals");
    expect(html).toContain("Store Visit Verification");
    expect(html).toContain("Checklists &amp; Evidence Vault");
    expect(html).toContain("Manager Dashboard &amp; CSV Reports");
    expect(html).toContain("AI-Assisted Visit Summaries");

    // Section G: How It Works
    expect(html).toContain("Plan the Route");
    expect(html).toContain("Manager Approves");
    expect(html).toContain("Execute &amp; Verify");
    expect(html).toContain("Review &amp; Insights");

    // Section H: Role-Based Value
    expect(html).toContain("Administrator");
    expect(html).toContain("Area &amp; Regional Manager");
    expect(html).toContain("Field Representative");

    // Section I: Product Showcase
    expect(html).toContain("Turn field activity into operational visibility.");
    expect(html).toContain("Trip Planning &amp; Approvals");
    expect(html).toContain("Store Visits &amp; Evidence");
    expect(html).toContain("Reports &amp; Performance");

    // Section J: Responsible Location & Security
    expect(html).toContain("Visibility for managers. Transparency for field teams.");
    expect(html).toContain("Multi-Tenant Row-Level Security");
    expect(html).toContain("Consent-Driven, Point-in-Time GPS");
    expect(html).toContain("Private Evidence Vault");
    expect(html).toContain("Immutable Audit Trails");

    // Section K: AI Reporting
    expect(html).toContain("Less time writing reports. More time acting on insights.");
    expect(html).toContain("Human-in-the-Loop Safeguard");
    expect(html).toContain("Detected Key Observations");

    // Section L: Pricing
    expect(html).toContain(PLAN_CATALOG.pilot.name);
    expect(html).toContain(PLAN_CATALOG.pro.name);
    expect(html).toContain(PLAN_CATALOG.enterprise.name);
    expect(html).toContain(String(PLAN_CATALOG.pro.monthlyBasePriceUsd));
    expect(html).toContain(String(PLAN_CATALOG.enterprise.monthlyBasePriceUsd));

    // Section M: FAQ
    expect(html).toContain("Frequently Asked Questions");
    expect(html).toContain("What is field operations management software?");
    expect(html).toContain("Which industries can use FieldTrack?");
    expect(html).toContain("Does the platform support AI-assisted reporting?");

    // Section N: Final CTA
    expect(html).toContain("Bring clarity to every field visit.");
    expect(html).toContain("Bring trip planning, store visit execution, and field reporting into one structured workflow.");

    // Section O: Footer
    expect(html).toContain("FieldTrack Inc.");
    expect(html).toContain(String(new Date().getFullYear()));
    expect(html).toContain('href="/dashboard"');
  });

  it("also renders the identical landing experience at '/landing'", () => {
    const rootHtml = renderToStaticMarkup(React.createElement(RootLandingPage));
    const landingHtml = renderToStaticMarkup(React.createElement(LandingPage));
    expect(landingHtml).toEqual(rootHtml);
  });

  it("does not contain broken empty anchor hashes (href='#')", () => {
    const html = renderToStaticMarkup(React.createElement(RootLandingPage));
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('href=""');
  });

  it("verifies routing policy: '/' is public and not blocked, while '/dashboard' is strictly protected", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/landing")).toBe(false);
    expect(isProtectedPath("/welcome")).toBe(false);
    expect(isProtectedPath("/invite/12345")).toBe(false);

    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/filters")).toBe(true);
    expect(isProtectedPath("/trips")).toBe(true);
    expect(isProtectedPath("/approvals")).toBe(true);

    expect(isAuthPublicRoute("/")).toBe(false);
    expect(isAuthPublicRoute("/dashboard")).toBe(false);
    expect(isAuthPublicRoute("/login")).toBe(true);
    expect(isAuthPublicRoute("/signup")).toBe(true);
  });
});
