"use client";

import { useReducedMotion, motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface SlideUpProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  distance?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function SlideUp({
  children,
  distance = 20,
  duration = ANIMATION.duration.smooth,
  delay = 0,
  className,
  ...props
}: SlideUpProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : distance }}
      transition={{
        duration: shouldReduceMotion ? 0.01 : duration,
        delay,
        ease: ANIMATION.ease.smooth,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
