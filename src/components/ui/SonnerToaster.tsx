"use client";

import { Toaster as Sonner, toast } from "sonner";
import { COLORS, RADII, SHADOWS, Z_INDEX } from "@/lib/design-system/tokens";

export { toast };

export function SonnerToaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: COLORS.surface.surface,
          color: COLORS.text.primary,
          border: `1px solid ${COLORS.border.default}`,
          borderRadius: RADII.lg,
          boxShadow: SHADOWS.neuRaised,
          fontSize: "0.875rem",
          fontWeight: 500,
          zIndex: Z_INDEX.toast,
        },
        classNames: {
          title: "font-semibold text-text-primary",
          description: "text-text-secondary text-xs",
          actionButton: "btn btn-sm btn-primary",
          cancelButton: "btn btn-sm btn-secondary",
          success: "border-status-success text-status-successText",
          error: "border-status-danger text-status-dangerText",
          warning: "border-status-warning text-status-warningText",
          info: "border-status-info text-status-infoText",
        },
      }}
    />
  );
}
