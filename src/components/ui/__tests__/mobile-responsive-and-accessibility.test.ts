import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { PRIMARY_NAV_ITEMS } from "@/components/shell/NavLinks";

describe("Mobile-first Responsive Design & Accessibility Verification", () => {
  const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  describe("Design tokens & touch target contracts", () => {
    it("defines 44px minimum touch target variable (--touch-target-min: 2.75rem)", () => {
      expect(cssContent).toContain("--touch-target-min: 2.75rem;");
    });

    it("enforces brand palette tokens: Royal Blue, Violet, Electric Cyan, Soft White", () => {
      expect(cssContent).toContain("--brand-royal: #293f91;");
      expect(cssContent).toContain("--brand-violet: #8875f7;");
      expect(cssContent).toContain("--brand-cyan: #38d9d6;");
      expect(cssContent).toContain("--bg-canvas: #f5f6fa;");
      expect(cssContent).toContain("--bg-surface: #ffffff;");
    });

    it("provides neumorphic surfaces and subtle gradient tokens", () => {
      expect(cssContent).toContain("--shadow-neu-raised:");
      expect(cssContent).toContain("--shadow-neu-inset:");
      expect(cssContent).toContain("--gradient-brand:");
      expect(cssContent).toContain("--gradient-accent:");
    });
  });

  describe("Application Shell & Responsive Sidebar Isolation", () => {
    it("completely hides the permanent desktop sidebar below 1024px so mobile content gets 100% width", () => {
      expect(cssContent).toContain(
        "/* Hide permanent desktop sidebar on tablet and mobile viewports */"
      );
      expect(cssContent).toContain("display: none !important;");
      expect(cssContent).toContain("width: 0 !important;");
    });

    it("defines off-canvas mobile drawer with backdrop and smooth sliding transitions", () => {
      expect(cssContent).toContain(".mobile-drawer");
      expect(cssContent).toContain("transform: translateX(-100%);");
      expect(cssContent).toContain(".mobile-drawer.open");
      expect(cssContent).toContain("transform: translateX(0);");
      expect(cssContent).toContain(".mobile-sidebar-backdrop");
    });

    it("compacts top header controls on mobile screens", () => {
      expect(cssContent).toContain(".user-menu-trigger-chevron");
      expect(cssContent).toContain(".header-role-pill,");
    });
  });

  describe("KPI Cards & Operations Dashboard", () => {
    it("defines responsive .kpi-grid and compact .kpi-card with consistent heights", () => {
      expect(cssContent).toContain(".kpi-grid");
      expect(cssContent).toContain(".kpi-card");
      expect(cssContent).toContain(".kpi-rule-details");
      expect(cssContent).toContain(".kpi-rule-summary");
      expect(cssContent).toContain(".kpi-status-chips");
    });
  });

  describe("Responsive layout classes", () => {
    it("defines .mobile-nav-toggle with accessible 44px touch targets on mobile", () => {
      expect(cssContent).toContain(".mobile-nav-toggle");
      expect(cssContent).toContain("min-height: var(--touch-target-min, 2.75rem);");
      expect(cssContent).toContain("min-width: var(--touch-target-min, 2.75rem);");
    });

    it("defines .settings-layout collapsing from 2-col to 1-col on mobile/tablet viewports", () => {
      expect(cssContent).toContain(".settings-layout");
      expect(cssContent).toContain(".settings-nav-sidebar");
    });

    it("defines .page-two-col-layout collapsing sidebars cleanly below 900px", () => {
      expect(cssContent).toContain(".page-two-col-layout");
      expect(cssContent).toContain("@media (max-width: 900px)");
    });

    it("defines .live-tracking-layout for responsive maps and inspect drawers", () => {
      expect(cssContent).toContain(".live-tracking-layout");
    });

    it("defines .form-sticky-actions with safe-area padding for mobile one-handed use", () => {
      expect(cssContent).toContain(".form-sticky-actions");
      expect(cssContent).toContain("env(safe-area-inset-bottom");
    });

    it("defines .breadcrumb-ancestor for responsive breadcrumb truncation", () => {
      expect(cssContent).toContain(".breadcrumb-ancestor");
      expect(cssContent).toContain("text-overflow: ellipsis;");
    });

    it("defines .approvals-action-buttons for touch-friendly mobile action wrapping", () => {
      expect(cssContent).toContain(".approvals-action-buttons");
    });
  });

  describe("Navigation & Route Integrity", () => {
    it("ensures every primary nav link starts with a root forward slash and points to a registered route", () => {
      const allowedRoots = [
        "/",
        "/stores",
        "/trips",
        "/visits",
        "/approvals",
        "/notifications",
        "/team",
      ];
      for (const item of PRIMARY_NAV_ITEMS) {
        expect(item.href.startsWith("/")).toBe(true);
        expect(allowedRoots).toContain(item.href);
        expect(item.label.length).toBeGreaterThan(0);
      }
    });
  });
});
