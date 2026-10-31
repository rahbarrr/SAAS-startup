import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLandingPage, { metadata } from "@/app/page";
import LandingPage from "@/app/landing/page";
import { isAuthPublicRoute, isProtectedPath } from "@/lib/supabase/middleware";

describe("FieldTrack Enterprise Landing Page (Root Route '/')", () => {
  it("exports valid, SEO-optimized metadata matching the updated concise specification", () => {
    expect(metadata.title).toBe("FieldTrack | Field Operations and Trip Management");
    expect(metadata.description).toBe(
      "Plan field trips, manage approvals, execute store visits and monitor field team operations with FieldTrack."
    );
    expect(metadata.openGraph?.title).toBe(
      "FieldTrack | Field Operations and Trip Management"
    );
    expect(metadata.openGraph?.siteName).toBe("FieldTrack");
  });

  it("renders the 7 conversion-optimized sections directly at '/' without authentication", () => {
    const html = renderToStaticMarkup(React.createElement(RootLandingPage));

    // Section 1: Navigation Header
    expect(html).toContain("FieldTrack");
    expect(html).toContain('href="#product"');
    expect(html).toContain('href="#features"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('href="#faq"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');

    // Section 2: Hero Section
    expect(html).toContain("FIELD OPERATIONS MANAGEMENT PLATFORM");
    expect(html).toContain("Every Field Visit. Every Trip.");
    expect(html).toContain("One Platform.");
    expect(html).toContain(
      "Plan field trips, manage approvals, track store visits and monitor team execution from one centralized workspace."
    );
    expect(html).toContain("Get Started");
    expect(html).toContain("Explore Platform");
    expect(html).toContain(
      "Built for teams that need visibility, accountability and efficient field operations."
    );

    // Section 3: Product Showcase
    expect(html).toContain("Turn field activity into operational visibility.");
    expect(html).toContain("Trip Planning");
    expect(html).toContain("Manager Approvals");
    expect(html).toContain("Store Visit Execution");
    expect(html).toContain("Location Visibility");
    expect(html).toContain("Operational Reporting");

    // Section 4: Core Features (4 compact cards)
    expect(html).toContain("Trip Management");
    expect(html).toContain(
      "Plan trips, organize destinations and manage field schedules."
    );
    expect(html).toContain("Approval Workflows");
    expect(html).toContain("Review and manage employee trip requests.");
    expect(html).toContain("Store Visit Execution");
    expect(html).toContain("Record visits, complete checklists and capture evidence.");
    expect(html).toContain("Operational Visibility");
    expect(html).toContain("Monitor team activity and review operational performance.");

    // Section 5: How It Works (3 clear steps)
    expect(html).toContain("Step 1");
    expect(html).toContain("Plan");
    expect(html).toContain("Create trips and organize store visits.");
    expect(html).toContain("Step 2");
    expect(html).toContain("Execute");
    expect(html).toContain("Complete field visits, checklists and evidence capture.");
    expect(html).toContain("Step 3");
    expect(html).toContain("Monitor");
    expect(html).toContain(
      "Review approvals, team activity and operational performance."
    );

    // Section 6: FAQ (6 compact questions)
    expect(html).toContain("What is FieldTrack?");
    expect(html).toContain("Who can use FieldTrack?");
    expect(html).toContain("How does trip approval work?");
    expect(html).toContain("Can employees record store visits?");
    expect(html).toContain("Does FieldTrack support location tracking?");
    expect(html).toContain("How do I get started?");

    // Section 7: Final CTA
    expect(html).toContain("Bring Your Field Operations Together.");
    expect(html).toContain(
      "Plan better, execute efficiently and stay informed with FieldTrack."
    );

    // Footer
    expect(html).toContain("FieldTrack Inc.");
    expect(html).toContain(String(new Date().getFullYear()));
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
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
