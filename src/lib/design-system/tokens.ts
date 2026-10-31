/**
 * FieldTrack Enterprise Design Tokens
 *
 * Strict palette tokens reflecting the FieldTrack four-color identity:
 * Royal Blue (#293F91), Violet (#8875F7), Electric Cyan (#38D9D6), Soft White (#F5F6FA)
 */

export const COLORS = {
  brand: {
    royal: "#293F91",
    royalHover: "#223579",
    royalSoft: "#EEF1FA",
    royalBorder: "#CFD6EE",
    dark: "#1C2B66",
    darker: "#152255",
    violet: "#8875F7",
    violetHover: "#7663F0",
    violetStrong: "#5B47D6",
    violetSoft: "#F2F0FF",
    violetBorder: "#DCD5FE",
    cyan: "#38D9D6",
    cyanStrong: "#0E9F9C",
    cyanSoft: "rgba(56, 217, 214, 0.12)",
    cyanBorder: "rgba(56, 217, 214, 0.35)",
  },
  surface: {
    canvas: "#F5F6FA",
    surface: "#FFFFFF",
    subtle: "#F0F2F8",
    hover: "#ECEFF8",
    muted: "#F8F9FC",
  },
  text: {
    primary: "#20243A",
    secondary: "#626B80",
    muted: "#6B7287",
    light: "#9AA1B2",
    onDark: "#FFFFFF",
    onDarkMuted: "rgba(255, 255, 255, 0.72)",
  },
  border: {
    default: "#E5E7EB",
    strong: "#CDD2DE",
    subtle: "#EEF0F4",
  },
  status: {
    success: "#15803D",
    successBg: "#F0FDF4",
    successText: "#166534",
    successBorder: "#BBF7D0",
    warning: "#B45309",
    warningBg: "#FFFBEB",
    warningText: "#92400E",
    warningBorder: "#FDE68A",
    danger: "#B91C1C",
    dangerBg: "#FEF2F2",
    dangerText: "#991B1B",
    dangerBorder: "#FECACA",
    info: "#2563EB",
    infoBg: "#EFF6FF",
    infoText: "#1E40AF",
    infoBorder: "#BFDBFE",
  },
} as const;

export const GRADIENTS = {
  brand: "linear-gradient(135deg, #293F91 0%, #5B47D6 55%, #8875F7 100%)",
  accent: "linear-gradient(135deg, #8875F7 0%, #38D9D6 100%)",
  brandSubtle: "linear-gradient(135deg, #F2F0FF 0%, #EEF1FA 100%)",
  cyanSubtle:
    "linear-gradient(135deg, rgba(136, 117, 247, 0.08) 0%, rgba(56, 217, 214, 0.12) 100%)",
  sidebar: "linear-gradient(180deg, #293F91 0%, #1E2F75 100%)",
  glass:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 246, 250, 0.8) 100%)",
} as const;

export const SHADOWS = {
  neuRaised:
    "6px 6px 16px rgba(41, 63, 145, 0.07), -6px -6px 16px rgba(255, 255, 255, 0.95)",
  neuRaisedSm:
    "3px 3px 8px rgba(41, 63, 145, 0.06), -3px -3px 8px rgba(255, 255, 255, 0.9)",
  neuRaisedHover:
    "8px 8px 22px rgba(41, 63, 145, 0.1), -8px -8px 22px rgba(255, 255, 255, 1)",
  neuInset:
    "inset 2px 2px 5px rgba(41, 63, 145, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.95)",
  glowCyan: "0 0 16px rgba(56, 217, 214, 0.45)",
  glowViolet: "0 0 16px rgba(136, 117, 247, 0.4)",
  card: "0 1px 3px rgba(32, 36, 58, 0.07), 0 1px 2px -1px rgba(32, 36, 58, 0.04)",
  cardHover: "0 4px 12px rgba(41, 63, 145, 0.1), 0 2px 4px -1px rgba(41, 63, 145, 0.06)",
} as const;

export const RADII = {
  xs: "0.25rem",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.875rem",
  xl: "1.125rem",
  full: "9999px",
} as const;

export const ANIMATION = {
  duration: {
    fast: 0.15,
    base: 0.25,
    smooth: 0.35,
    slow: 0.5,
  },
  ease: {
    standard: [0.2, 0, 0, 1] as const,
    smooth: [0.25, 0.1, 0.25, 1] as const,
    bounce: [0.34, 1.56, 0.64, 1] as const,
  },
} as const;

export const Z_INDEX = {
  dropdown: 20,
  sticky: 30,
  drawerBackdrop: 40,
  drawer: 50,
  modalBackdrop: 60,
  modal: 70,
  popover: 80,
  tooltip: 90,
  toast: 100,
} as const;
