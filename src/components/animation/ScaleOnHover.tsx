"use client";

import { useReducedMotion, motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface ScaleOnHoverProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  scale?: number;
  tapScale?: number;
  className?: string;
}

export function ScaleOnHover({
  children,
  scale = 1.03,
  tapScale = 0.97,
  className,
  ...props
}: ScaleOnHoverProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale }}
      whileTap={shouldReduceMotion ? undefined : { scale: tapScale }}
      transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.smooth }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
