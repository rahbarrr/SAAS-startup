/**
 * FieldTrack Enterprise Design Tokens
 *
 * Grounded craft palette:
 * Slate neutral ramp, Deep Cobalt accent (#1E40AF), purposeful semantic status,
 * quiet elevation hairlines, and strict 4px grid nested radii.
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
  brand: "linear-gradient(135deg, #293F91 0%, #152255 100%)",
  accent: "linear-gradient(135deg, #1E40AF 0%, #38D9D6 100%)",
  brandSubtle: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
  cyanSubtle: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
  sidebar: "linear-gradient(180deg, #1C2B66 0%, #152255 100%)",
  glass:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)",
} as const;

export const SHADOWS = {
  neuRaised: "0 1px 3px rgba(41, 63, 145, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)",
  neuRaisedSm: "0 1px 2px rgba(15, 23, 42, 0.04)",
  neuRaisedHover: "0 4px 12px rgba(41, 63, 145, 0.1), 0 2px 4px rgba(15, 23, 42, 0.04)",
  neuInset: "inset 0 1px 2px rgba(15, 23, 42, 0.05)",
  glowCyan: "0 1px 2px rgba(15, 23, 42, 0.05)",
  glowViolet: "0 1px 2px rgba(15, 23, 42, 0.05)",
  card: "0 1px 3px rgba(32, 36, 58, 0.07), 0 1px 2px -1px rgba(32, 36, 58, 0.04)",
  cardHover: "0 4px 12px rgba(41, 63, 145, 0.1), 0 2px 4px -1px rgba(41, 63, 145, 0.06)",
} as const;

export const RADII = {
  xs: "0.25rem", // 4px
  sm: "0.375rem", // 6px
  md: "0.5rem", // 8px
  lg: "0.75rem", // 12px
  xl: "1rem", // 16px
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
    bounce: [0.2, 0, 0, 1] as const,
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
