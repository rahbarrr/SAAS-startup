"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "fieldtrack-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

/**
 * Inline snippet injected into <head> in layout.tsx to prevent Flash of Unstyled Content (FOUC).
 */
export const THEME_INITIALIZER_SCRIPT = `(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage on client mount
  useEffect(() => {
    let saved: Theme = "system";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        saved = stored;
      }
    } catch {
      // localStorage unavailable or restricted
    }

    const resolved = saved === "system" ? getSystemPreference() : saved;
    setThemeState(saved);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
    setMounted(true);
  }, []);

  // Listen to system media query changes when theme is "system"
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemChange(e: MediaQueryListEvent) {
      if (theme === "system") {
        const nextResolved: ResolvedTheme = e.matches ? "dark" : "light";
        setResolvedTheme(nextResolved);
        applyThemeToDocument(nextResolved);
      }
    }

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore storage errors
    }

    const nextResolved = newTheme === "system" ? getSystemPreference() : newTheme;
    setResolvedTheme(nextResolved);
    applyThemeToDocument(nextResolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for non-wrapped environments or unit tests
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}
