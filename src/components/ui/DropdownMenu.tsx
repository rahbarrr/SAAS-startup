"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("dropdown-menu-content", className)}
      style={{
        zIndex: 50,
        minWidth: "12rem",
        overflow: "hidden",
        borderRadius: "var(--radius-md, 0.5rem)",
        border: "1px solid var(--border-default, #e5e7eb)",
        background: "var(--bg-surface, #ffffff)",
        padding: "0.375rem",
        color: "var(--text-primary, #20243a)",
        boxShadow: "var(--shadow-neu-raised, 6px 6px 16px rgba(41, 63, 145, 0.07))",
      }}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "danger";
  }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "dropdown-item",
      inset && "dropdown-item--inset",
      variant === "danger" && "dropdown-item--danger",
      className
    )}
    style={{
      position: "relative",
      display: "flex",
      cursor: "pointer",
      userSelect: "none",
      alignItems: "center",
      gap: "0.5rem",
      borderRadius: "var(--radius-xs, 0.25rem)",
      padding: inset ? "0.5rem 0.75rem 0.5rem 2rem" : "0.5rem 0.75rem",
      fontSize: "0.8125rem",
      fontWeight: 500,
      color:
        variant === "danger"
          ? "var(--status-danger, #b91c1c)"
          : "var(--text-primary, #20243a)",
      outline: "none",
      transition: "background var(--duration-fast, 0.15s) ease",
    }}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    style={{
      margin: "0.375rem -0.375rem",
      height: "1px",
      background: "var(--border-default, #e5e7eb)",
    }}
    className={className}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    style={{
      padding: "0.375rem 0.75rem",
      fontSize: "0.75rem",
      fontWeight: 600,
      color: "var(--text-muted, #6b7287)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}
    className={className}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;
