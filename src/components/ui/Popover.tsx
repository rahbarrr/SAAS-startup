"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn("popover-content", className)}
      style={{
        zIndex: 80,
        width: "18rem",
        borderRadius: "var(--radius-lg, 0.875rem)",
        border: "1px solid var(--border-default, #e5e7eb)",
        background: "var(--bg-surface, #ffffff)",
        padding: "1rem",
        color: "var(--text-primary, #20243a)",
        boxShadow: "var(--shadow-neu-raised, 6px 6px 16px rgba(41, 63, 145, 0.07))",
        outline: "none",
      }}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
