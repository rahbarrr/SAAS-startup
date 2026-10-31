"use client";

import { useReducedMotion, motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  hoverElevation?: boolean;
  glow?: "none" | "cyan" | "violet";
  className?: string;
}

export function AnimatedCard({
  children,
  hoverElevation = true,
  glow = "none",
  className,
  ...props
}: AnimatedCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const getGlowShadow = () => {
    if (glow === "cyan") return "0 8px 24px rgba(56, 217, 214, 0.25)";
    if (glow === "violet") return "0 8px 24px rgba(136, 117, 247, 0.25)";
    return "0 8px 20px rgba(41, 63, 145, 0.08)";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={
        shouldReduceMotion || !hoverElevation
          ? undefined
          : {
              y: -3,
              boxShadow: getGlowShadow(),
              transition: {
                duration: ANIMATION.duration.fast,
                ease: ANIMATION.ease.smooth,
              },
            }
      }
      transition={{ duration: ANIMATION.duration.base, ease: ANIMATION.ease.standard }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
