"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCurrentRole } from "@/components/ui/RoleContext";
import type { OrgRole } from "@/modules/tenancy/domain";

export interface NavItem {
  href: string;
  label: string;
}

export interface DetailedNavItem extends NavItem {
  icon: string;
  badge?: string;
  allowedRoles?: OrgRole[];
}

export interface NavSection {
  title: string;
  items: DetailedNavItem[];
}

// Preserved for automated unit test compatibility
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/stores", label: "Stores" },
  { href: "/trips", label: "Field Trips" },
  { href: "/visits", label: "Store Visits" },
  { href: "/approvals", label: "Approvals" },
  { href: "/notifications", label: "Notifications" },
  { href: "/team", label: "Organization Team" },
];

export const SIDEBAR_NAV_SECTIONS: NavSection[] = [
  {
    title: "Field Operations",
    items: [
      { href: "/dashboard", label: "Overview", icon: "grid" },
      { href: "/trips", label: "Trips", icon: "map-pin" },
      {
        href: "/approvals",
        label: "Approvals",
        icon: "check-circle",
        allowedRoles: ["admin", "manager"],
      },
      { href: "/visits", label: "Store Visits", icon: "clipboard-list" },
      { href: "/stores", label: "Stores & Territories", icon: "building" },
    ],
  },
  {
    title: "Intelligence & Team",
    items: [
      { href: "/team", label: "Team Directory", icon: "users" },
      { href: "/reports", label: "Reports & Analytics", icon: "bar-chart" },
      { href: "/ai-insights", label: "AI Insights", icon: "sparkles", badge: "AI" },
      { href: "/notifications", label: "Notifications", icon: "bell" },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/audit",
        label: "Audit Logs",
        icon: "shield",
        allowedRoles: ["admin", "manager"],
      },
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/", label: "Public Landing Page", icon: "external-link" },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "grid":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      );
    case "map-pin":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      );
    case "check-circle":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      );
    case "clipboard-list":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          <path d="M9 12h6"></path>
          <path d="M9 16h6"></path>
        </svg>
      );
    case "building":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <path d="M9 22v-4h6v4"></path>
          <path d="M8 6h.01"></path>
          <path d="M16 6h.01"></path>
          <path d="M8 10h.01"></path>
          <path d="M16 10h.01"></path>
          <path d="M8 14h.01"></path>
          <path d="M16 14h.01"></path>
        </svg>
      );
    case "users":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      );
    case "bar-chart":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
      );
    case "sparkles":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
        </svg>
      );
    case "bell":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      );
    case "settings":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      );
    case "shield":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      );
    default:
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      );
  }
}

export function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { currentRole } = useCurrentRole();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {SIDEBAR_NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.allowedRoles || item.allowedRoles.includes(currentRole)
        );

        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title}>
            <p className="sidebar-nav-group-label">{section.title}</p>
            <ul className="sidebar-nav-list">
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={onItemClick}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          color: isActive ? "var(--brand-primary)" : "var(--text-muted)",
                        }}
                      >
                        <NavIcon name={item.icon} />
                      </span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge ? (
                        <span className="nav-badge">{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Keep NavLinks for legacy / simple horizontal render
export function NavLinks(): ReactNode {
  const pathname = usePathname();

  return (
    <ul className="nav-list">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="nav-link"
              aria-current={isActive ? "page" : undefined}
            >
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
