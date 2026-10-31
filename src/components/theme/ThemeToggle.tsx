"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme, type Theme } from "./ThemeProvider";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "dropdown" | "segmented";
  ariaLabel?: string;
}

export function ThemeToggle({
  className = "",
  variant = "dropdown",
  ariaLabel = "Toggle color theme",
}: ThemeToggleProps): ReactNode {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (variant === "segmented") {
    return (
      <div
        className={`theme-segmented-group ${className}`}
        role="group"
        aria-label={ariaLabel}
      >
        <button
          type="button"
          className={`theme-segment-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          aria-pressed={theme === "light"}
          title="Light theme"
        >
          <Sun size={15} aria-hidden="true" />
          <span>Light</span>
        </button>
        <button
          type="button"
          className={`theme-segment-btn ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
          aria-pressed={theme === "dark"}
          title="Dark theme"
        >
          <Moon size={15} aria-hidden="true" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          className={`theme-segment-btn ${theme === "system" ? "active" : ""}`}
          onClick={() => setTheme("system")}
          aria-pressed={theme === "system"}
          title="Match system preference"
        >
          <Monitor size={15} aria-hidden="true" />
          <span>System</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`theme-toggle-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className="icon-btn theme-toggle-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${ariaLabel}. Current theme: ${theme} (${resolvedTheme})`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Current theme: ${theme} (Click to change)`}
      >
        {resolvedTheme === "dark" ? (
          <Moon size={18} className="theme-icon moon-icon" aria-hidden="true" />
        ) : (
          <Sun size={18} className="theme-icon sun-icon" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="theme-dropdown-menu" role="menu" aria-label="Color theme options">
          <button
            type="button"
            className={`theme-menu-item ${theme === "light" ? "selected" : ""}`}
            role="menuitemradio"
            aria-checked={theme === "light"}
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
          >
            <div className="theme-item-left">
              <Sun size={16} aria-hidden="true" />
              <span>Light Mode</span>
            </div>
            {theme === "light" && (
              <Check size={14} className="theme-check-icon" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className={`theme-menu-item ${theme === "dark" ? "selected" : ""}`}
            role="menuitemradio"
            aria-checked={theme === "dark"}
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
          >
            <div className="theme-item-left">
              <Moon size={16} aria-hidden="true" />
              <span>Dark Mode</span>
            </div>
            {theme === "dark" && (
              <Check size={14} className="theme-check-icon" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className={`theme-menu-item ${theme === "system" ? "selected" : ""}`}
            role="menuitemradio"
            aria-checked={theme === "system"}
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
          >
            <div className="theme-item-left">
              <Monitor size={16} aria-hidden="true" />
              <span>System Default</span>
            </div>
            {theme === "system" && (
              <Check size={14} className="theme-check-icon" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Visual card selector for Account/Workspace Settings
 */
export function ThemeSettingsCards(): ReactNode {
  const { theme, setTheme } = useTheme();

  const themes: Array<{
    id: Theme;
    title: string;
    description: string;
    icon: typeof Sun;
    bgClass: string;
  }> = [
    {
      id: "light",
      title: "Light Theme",
      description: "Crisp white & soft-slate surfaces with royal blue accents.",
      icon: Sun,
      bgClass: "preview-light",
    },
    {
      id: "dark",
      title: "Dark Theme",
      description: "Deep navy #0B1020 surfaces with violet & electric cyan highlights.",
      icon: Moon,
      bgClass: "preview-dark",
    },
    {
      id: "system",
      title: "System Preference",
      description: "Automatically synchronizes with your device OS dark/light mode.",
      icon: Monitor,
      bgClass: "preview-system",
    },
  ];

  return (
    <div
      className="theme-settings-cards-grid"
      role="radiogroup"
      aria-label="Interface theme preference"
    >
      {themes.map((t) => {
        const Icon = t.icon;
        const isSelected = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`theme-card-option ${isSelected ? "is-selected" : ""}`}
            onClick={() => setTheme(t.id)}
          >
            <div className={`theme-card-preview ${t.bgClass}`}>
              <div className="preview-top-bar" />
              <div className="preview-body">
                <div className="preview-sidebar" />
                <div className="preview-content">
                  <div className="preview-line-title" />
                  <div className="preview-cards-row">
                    <div className="preview-mini-card" />
                    <div className="preview-mini-card" />
                  </div>
                </div>
              </div>
            </div>

            <div className="theme-card-info">
              <div className="theme-card-title-row">
                <Icon size={16} className="theme-card-icon" aria-hidden="true" />
                <span className="theme-card-title">{t.title}</span>
                {isSelected && (
                  <span className="theme-selected-badge" aria-label="Currently active">
                    <Check size={12} aria-hidden="true" />
                  </span>
                )}
              </div>
              <p className="theme-card-desc">{t.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
