"use client";

import { useReducedMotion, motion } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
      transition={{
        duration: shouldReduceMotion ? 0.01 : ANIMATION.duration.smooth,
        ease: ANIMATION.ease.smooth,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
