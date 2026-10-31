import { cva, type VariantProps } from "class-variance-authority";

/**
 * Standardized FieldTrack Button Variants
 * Integrates with existing globals.css button rules while providing type-safe props via CVA.
 */
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      outline: "btn-outline",
      danger: "btn-danger",
      ghost: "btn-ghost",
      onDark: "btn-on-dark",
      onDarkOutline: "btn-on-dark-outline",
    },
    size: {
      default: "",
      sm: "btn-sm",
      lg: "btn-lg",
      icon: "icon-btn",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
});

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
