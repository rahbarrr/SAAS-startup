import { describe, expect, it } from "vitest";
import {
  FadeIn,
  SlideUp,
  StaggerContainer,
  StaggerItem,
  AnimatedCard,
  ScaleOnHover,
  PageTransition,
} from "@/components/animation";
import {
  WebGLCanvas,
  FloatingGeometry,
  InteractiveBackground,
  FloatingBrandElements,
  ThreeDHeroScene,
  ThreeDVisualCard,
  DynamicThreeDHeroScene,
  DynamicThreeDVisualCard,
} from "@/components/3d";
import {
  Dialog,
  DropdownMenu,
  Tooltip,
  Popover,
  SonnerToaster,
  toast,
  Icons,
  buttonVariants,
} from "@/components/ui";
import { StatusDistributionChart, PerformanceAreaChart } from "@/components/charts";
import { cn } from "@/lib/utils";
import { COLORS, GRADIENTS, SHADOWS, ANIMATION } from "@/lib/design-system/tokens";
import { createFieldTrackTimeline, prefersReducedMotion } from "@/lib/design-system/gsap";

describe("FieldTrack Premium UI/UX, 3D, and Animation Toolkit", () => {
  describe("Design System Tokens & Utilities", () => {
    it("exports authentic FieldTrack brand color tokens", () => {
      expect(COLORS.brand.royal).toBe("#293F91");
      expect(COLORS.brand.violet).toBe("#8875F7");
      expect(COLORS.brand.cyan).toBe("#38D9D6");
      expect(COLORS.surface.canvas).toBe("#F5F6FA");
      expect(COLORS.surface.surface).toBe("#FFFFFF");
      expect(COLORS.text.primary).toBe("#20243A");
    });

    it("exports premium brand gradients and neumorphic shadows", () => {
      expect(GRADIENTS.brand).toContain("135deg");
      expect(GRADIENTS.accent).toContain("#38D9D6");
      expect(SHADOWS.neuRaised).toContain("rgba(41, 63, 145, 0.07)");
      expect(SHADOWS.neuInset).toContain("inset");
    });

    it("cn utility merges class names and resolves conflicting Tailwind / standard classes", () => {
      const isHidden = false;
      expect(cn("btn", "btn-primary")).toBe("btn btn-primary");
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("modal", isHidden && "hidden", null, undefined)).toBe("modal");
    });

    it("buttonVariants generates correct CVA class compositions", () => {
      expect(buttonVariants({ variant: "primary" })).toContain("btn-primary");
      expect(buttonVariants({ variant: "secondary", size: "sm" })).toContain(
        "btn-secondary"
      );
      expect(buttonVariants({ variant: "outline", size: "icon" })).toContain("icon-btn");
    });
  });

  describe("Animation Architecture (Motion & GSAP)", () => {
    it("exports Motion animation components", () => {
      expect(FadeIn).toBeDefined();
      expect(SlideUp).toBeDefined();
      expect(StaggerContainer).toBeDefined();
      expect(StaggerItem).toBeDefined();
      expect(AnimatedCard).toBeDefined();
      expect(ScaleOnHover).toBeDefined();
      expect(PageTransition).toBeDefined();
    });

    it("GSAP timeline utility initializes safely with reduced-motion defaults", () => {
      expect(typeof prefersReducedMotion).toBe("function");
      const tl = createFieldTrackTimeline();
      expect(tl).toBeDefined();
      expect(typeof tl.to).toBe("function");
    });

    it("defines animation tokens with natural durations and easing", () => {
      expect(ANIMATION.duration.fast).toBe(0.15);
      expect(ANIMATION.duration.base).toBe(0.25);
      expect(ANIMATION.duration.smooth).toBe(0.35);
      expect(Array.isArray(ANIMATION.ease.standard)).toBe(true);
    });
  });

  describe("3D Architecture (Three.js & R3F)", () => {
    it("exports WebGL canvas and 3D scene components", () => {
      expect(WebGLCanvas).toBeDefined();
      expect(FloatingGeometry).toBeDefined();
      expect(InteractiveBackground).toBeDefined();
      expect(FloatingBrandElements).toBeDefined();
      expect(ThreeDHeroScene).toBeDefined();
      expect(ThreeDVisualCard).toBeDefined();
    });

    it("exports dynamic SSR-safe wrappers for client-side loading", () => {
      expect(DynamicThreeDHeroScene).toBeDefined();
      expect(DynamicThreeDVisualCard).toBeDefined();
    });
  });

  describe("Accessible UI Components & Primitives", () => {
    it("exports Radix dialog, dropdown, tooltip, and popover primitives", () => {
      expect(Dialog).toBeDefined();
      expect(DropdownMenu).toBeDefined();
      expect(Tooltip).toBeDefined();
      expect(Popover).toBeDefined();
    });

    it("exports Sonner toaster and toast dispatcher", () => {
      expect(SonnerToaster).toBeDefined();
      expect(typeof toast).toBe("function");
    });

    it("exports enterprise Lucide icon dictionary", () => {
      expect(Icons.check).toBeDefined();
      expect(Icons.clock).toBeDefined();
      expect(Icons.building).toBeDefined();
      expect(Icons.mapPin).toBeDefined();
      expect(Icons.shield).toBeDefined();
      expect(Icons.alert).toBeDefined();
    });
  });

  describe("Data Visualization (Recharts)", () => {
    it("exports StatusDistributionChart and PerformanceAreaChart", () => {
      expect(StatusDistributionChart).toBeDefined();
      expect(PerformanceAreaChart).toBeDefined();
    });
  });
});
