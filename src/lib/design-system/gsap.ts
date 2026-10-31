import gsap from "gsap";

/**
 * Checks whether the user has requested reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Creates a GSAP timeline with reduced-motion awareness.
 * When reduced motion is preferred, animations complete immediately or are suppressed.
 */
export function createFieldTrackTimeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
  const tl = gsap.timeline({
    defaults: {
      duration: prefersReducedMotion() ? 0.01 : 0.4,
      ease: "power2.out",
    },
    ...vars,
  });

  return tl;
}

export { gsap };
