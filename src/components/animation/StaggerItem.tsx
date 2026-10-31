"use client";

import { useReducedMotion, motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { ANIMATION } from "@/lib/design-system/tokens";

export interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  distance?: number;
  className?: string;
}

export function StaggerItem({
  children,
  distance = 16,
  className,
  ...props
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : distance },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : ANIMATION.duration.base,
        ease: ANIMATION.ease.standard,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className} {...props}>
      {children}
    </motion.div>
  );
}
