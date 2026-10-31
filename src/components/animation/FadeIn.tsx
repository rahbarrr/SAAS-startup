"use client";

import { useReducedMotion, motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function FadeIn({
  children,
  direction = "none",
  distance = 16,
  duration = ANIMATION.duration.base,
  delay = 0,
  className,
  ...props
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  const getOffset = () => {
    if (shouldReduceMotion) return { x: 0, y: 0 };
    switch (direction) {
      case "up":
        return { x: 0, y: distance };
      case "down":
        return { x: 0, y: -distance };
      case "left":
        return { x: distance, y: 0 };
      case "right":
        return { x: -distance, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const offset = getOffset();

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: offset.x, y: offset.y }}
      transition={{
        duration: shouldReduceMotion ? 0.01 : duration,
        delay,
        ease: ANIMATION.ease.standard,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
