"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "modal-backdrop",
      "fixed inset-0 z-50 bg-[#152255]/45 backdrop-blur-[2px] transition-opacity",
      className
    )}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: "rgba(21, 34, 85, 0.45)",
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
    }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay>
      <DialogPrimitive.Content
        ref={ref}
        className={cn("modal-card", className)}
        style={{
          background: "var(--bg-surface, #ffffff)",
          borderRadius: "var(--radius-xl, 1.125rem)",
          boxShadow: "var(--shadow-neu-raised, 6px 6px 16px rgba(41, 63, 145, 0.07))",
          border: "1px solid var(--border-default, #e5e7eb)",
          width: "100%",
          maxWidth: "34rem",
          overflow: "hidden",
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogOverlay>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("modal-header", className)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--border-default, #e5e7eb)",
      }}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("card-title", className)}
    style={{
      fontSize: "1.125rem",
      fontWeight: 700,
      color: "var(--text-primary, #20243a)",
      margin: 0,
    }}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("card-meta", className)}
    style={{
      fontSize: "0.8125rem",
      color: "var(--text-muted, #6b7287)",
      margin: "0.25rem 0 0",
    }}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("modal-footer", className)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "0.75rem",
        padding: "1rem 1.5rem",
        borderTop: "1px solid var(--border-default, #e5e7eb)",
        background: "var(--bg-canvas, #f5f6fa)",
      }}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";
