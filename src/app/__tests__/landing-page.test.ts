import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLandingPage, { metadata } from "@/app/page";
import LandingPage from "@/app/landing/page";
import { isAuthPublicRoute, isProtectedPath } from "@/lib/supabase/middleware";

describe("FieldTrack Enterprise Landing Page (Root Route '/')", () => {
  it("exports valid, SEO-optimized metadata matching the updated enterprise specification", () => {
    expect(metadata.title).toBe(
      "FieldTrack | Enterprise Field Operations & Trip Management"
    );
    expect(metadata.description).toBe(
      "Plan field trips, manage approvals, coordinate store visits and gain visibility into team execution with FieldTrack."
    );
    expect(metadata.openGraph?.title).toBe(
      "FieldTrack | Enterprise Field Operations & Trip Management"
    );
    expect(metadata.openGraph?.siteName).toBe("FieldTrack");
  });

  it("renders all 13 complete enterprise sections directly at '/' without authentication", () => {
    const html = renderToStaticMarkup(React.createElement(RootLandingPage));

    // Section 1: Premium Navigation Header
    expect(html).toContain("FieldTrack");
    expect(html).toContain('href="#product"');
    expect(html).toContain('href="#features"');
    expect(html).toContain('href="#solutions"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('href="#pricing"');
    expect(html).toContain('href="#faq"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');

    // Section 2: Hero Section
    expect(html).toContain("FIELD OPERATIONS MANAGEMENT PLATFORM");
    expect(html).toContain("Take Control of Every");
    expect(html).toContain("Field Operation.");
    expect(html).toContain(
      "Plan field trips, streamline approvals, coordinate store visits and gain visibility into team execution — all from one centralized platform."
    );
    expect(html).toContain("Get Started");
    expect(html).toContain("Explore Platform");
    expect(html).toContain("Multi-stop route planning");
    expect(html).toContain("Hierarchical manager approvals");
    expect(html).toContain("GPS geofenced check-ins");

    // Section 3: Product Overview (6 operational challenges & synthesis)
    expect(html).toContain(
      "From fragmented field chaos to centralized operational control."
    );
    expect(html).toContain("Disconnected Field Operations");
    expect(html).toContain("Unorganized Trip Planning");
    expect(html).toContain("Manual Approval Processes");
    expect(html).toContain("Limited Store Visit Visibility");
    expect(html).toContain("Difficulty Monitoring Field Execution");
    expect(html).toContain("Fragmented Operational Reporting");
    expect(html).toContain("One connected loop: Plan, Approve, Execute, and Analyze.");

    // Section 4: Core Features (8 items)
    expect(html).toContain("Trip Planning &amp; Management");
    expect(html).toContain("Manager Approval Workflows");
    expect(html).toContain("Live Location Visibility");
    expect(html).toContain("Geofencing &amp; Store Visits");
    expect(html).toContain("Checklists &amp; Evidence Vault");
    expect(html).toContain("Team &amp; Employee Management");
    expect(html).toContain("Operational Reporting &amp; Analytics");
    expect(html).toContain("Organization &amp; Role Management");

    // Section 5: Interactive Product Showcase (All 6 capabilities)
    expect(html).toContain("Turn field activity into operational visibility.");
    expect(html).toContain("Operations Dashboard");
    expect(html).toContain("Trip Planning");
    expect(html).toContain("Manager Approvals");
    expect(html).toContain("Store Visit Execution");
    expect(html).toContain("Live Location View");
    expect(html).toContain("Reports &amp; Analytics");

    // Section 6: How It Works (4 clear stages: PLAN, APPROVE, EXECUTE, MONITOR)
    expect(html).toContain("PLAN");
    expect(html).toContain("Create trips and organize store visits.");
    expect(html).toContain("APPROVE");
    expect(html).toContain("Managers review and approve requests.");
    expect(html).toContain("EXECUTE");
    expect(html).toContain("Employees complete visits and capture evidence.");
    expect(html).toContain("MONITOR");
    expect(html).toContain("Administrators review progress and performance.");

    // Section 7: Solutions by Role (3 roles)
    expect(html).toContain("Tailored workflows for every level of field operations.");
    expect(html).toContain("Administrator");
    expect(html).toContain("Area &amp; Regional Manager");
    expect(html).toContain("Field Representative");

    // Section 8: Pricing Section (Pilot, Pro, Enterprise, Feature Matrix, FAQ)
    expect(html).toContain("Predictable pricing for growing field operations.");
    expect(html).toContain("Pilot Trial");
    expect(html).toContain("Pro");
    expect(html).toContain("Enterprise");
    expect(html).toContain("Monthly Billing");
    expect(html).toContain("Annual Billing");
    expect(html).toContain("Detailed Feature Comparison");
    expect(html).toContain("Billing &amp; Subscription Questions");

    // Section 9: Security and Platform Trust
    expect(html).toContain("Enterprise security and ethical location practices.");
    expect(html).toContain("Multi-Tenant Row-Level Security");
    expect(html).toContain("Consent-Driven, Point-in-Time GPS");
    expect(html).toContain("Private Evidence Vault");
    expect(html).toContain("Immutable Operational Audit Trails");

    // Section 10: Operational Impact & Credibility
    expect(html).toContain(
      "Purpose-built to solve the real friction of distributed field teams."
    );
    expect(html).toContain("Eliminate Fragmented Tools");
    expect(html).toContain("Standardize Store Reporting");
    expect(html).toContain("Centralize Field Evidence");
    expect(html).toContain("Territory-Wide Visibility");

    // Section 11: Resources & FAQ (All 8 questions)
    expect(html).toContain("What is FieldTrack?");
    expect(html).toContain("Who can use FieldTrack?");
    expect(html).toContain("How does trip planning work?");
    expect(html).toContain("How do managers approve trips?");
    expect(html).toContain("How do store visits work?");
    expect(html).toContain("How is location tracking handled?");
    expect(html).toContain("What pricing plans are available?");
    expect(html).toContain("How can an organization get started?");

    // Section 12: Final CTA
    expect(html).toContain("Bring Your Field Operations Together.");
    expect(html).toContain(
      "Coordinate trips, streamline field execution and gain better visibility into your operations with FieldTrack."
    );
    expect(html).toContain("Explore Pricing");

    // Section 13: Complete Footer
    expect(html).toContain("FieldTrack Inc.");
    expect(html).toContain(String(new Date().getFullYear()));
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/settings"');
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
