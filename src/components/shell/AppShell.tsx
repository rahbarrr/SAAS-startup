"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { PwaOfflineSyncIndicator } from "@/components/pwa/PwaOfflineSyncIndicator";
import {
  getSyncStatusDescriptor,
  StatusBadge,
  type SyncState,
} from "@/components/ui/StatusBadge";
import { RoleProvider, useCurrentRole, ROLE_PROFILES } from "@/components/ui/RoleContext";
import { ToastProvider } from "@/components/ui/Toast";
import { signOutAction } from "@/modules/auth/actions";
import type { OrgRole } from "@/modules/tenancy/domain";
import { SidebarNav } from "./NavLinks";
import { OrgSwitcher, type OrgSwitcherOption } from "./OrgSwitcher";

export interface AppShellProps {
  children: ReactNode;
  activeOrgId?: string;
  activeOrgName?: string;
  activeRole?: OrgRole;
  organizations?: readonly OrgSwitcherOption[];
  userEmail?: string | null;
  syncState?: SyncState;
}

function PageBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="flex-row-center">
        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.125rem" }}>
          Manager Operations Dashboard
        </span>
      </div>
    );
  }

  const formatSegment = (seg: string) => {
    if (seg === "trips") return "Field Trips";
    if (seg === "visits") return "Store Visits";
    if (seg === "approvals") return "Approvals";
    if (seg === "stores") return "Stores & Territories";
    if (seg === "team") return "Team Directory";
    if (seg === "reports") return "Reports & Analytics";
    if (seg === "ai-insights") return "AI Insights";
    if (seg === "settings") return "Workspace Settings";
    if (seg === "notifications") return "In-App Notifications";
    if (seg === "new") return "New";
    if (seg === "edit") return "Edit";
    if (seg === "landing") return "Product Tour";
    return seg.length > 12 ? `${seg.slice(0, 10)}...` : seg;
  };

  return (
    <nav aria-label="Breadcrumb" className="flex-row-center" style={{ fontSize: "0.875rem" }}>
      <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        Home
      </Link>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const href = "/" + segments.slice(0, idx + 1).join("/");
        return (
          <span key={href} className="flex-row-center">
            <span style={{ color: "var(--border-strong)", margin: "0 0.375rem" }}>/</span>
            {isLast ? (
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {formatSegment(seg)}
              </span>
            ) : (
              <Link href={href} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                {formatSegment(seg)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function RoleSwitcherMenu() {
  const { currentRole, setRole, isAuthenticated, authenticatedEmail } = useCurrentRole();
  const [isOpen, setIsOpen] = useState(false);

  if (isAuthenticated) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.75rem",
          padding: "0.3125rem 0.625rem",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-default)",
          fontWeight: 600,
        }}
        title={`Verified role for ${authenticatedEmail ?? "session"} enforced via Row-Level Security`}
      >
        <span style={{ color: "var(--status-success)", fontSize: "0.625rem" }}>●</span>
        <span style={{ color: "var(--text-muted)" }}>Verified:</span>
        <span style={{ textTransform: "capitalize", color: "var(--brand-dark)", fontWeight: 700 }}>
          {currentRole.replace("_", " ")}
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-sm btn-secondary"
        style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
        title="Switch simulated user role for testing"
        aria-label="Switch simulated role"
      >
        <span style={{ color: "var(--brand-accent)", fontWeight: 700, fontSize: "0.6875rem", marginRight: "0.125rem" }}>
          DEMO
        </span>
        <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>Role:</span>
        <span style={{ textTransform: "capitalize" }}>{currentRole.replace("_", " ")}</span>
        <span style={{ fontSize: "0.625rem" }}>▼</span>
      </button>

      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.375rem",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            padding: "0.375rem",
            zIndex: 60,
            minWidth: "13rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Simulate User Role (Demo Mode)
          </div>
          {(["admin", "manager", "field_employee"] as OrgRole[]).map((r) => {
            const p = ROLE_PROFILES[r];
            const isSelected = r === currentRole;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setIsOpen(false);
                }}
                style={{
                  textAlign: "left",
                  padding: "0.375rem 0.5rem",
                  background: isSelected ? "var(--status-info-bg)" : "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "0.8125rem", color: isSelected ? "var(--brand-primary)" : "var(--text-primary)", textTransform: "capitalize" }}>
                    {r.replace("_", " ")}
                  </strong>
                  {isSelected ? <span style={{ color: "var(--brand-primary)", fontSize: "0.75rem" }}>✓</span> : null}
                </div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{p.userName}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InnerShell({
  children,
  activeOrgId,
  activeOrgName = "Apex Retail Solutions Ltd",
  activeRole = "manager",
  organizations = [],
  userEmail = null,
  syncState = "synced",
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, startSignOut] = useTransition();
  const { profile } = useCurrentRole();
  const syncDescriptor = getSyncStatusDescriptor(syncState);

  function handleSignOut() {
    startSignOut(async () => {
      await signOutAction();
    });
  }

  return (
    <div className="app-shell">
      <PwaOfflineSyncIndicator />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="app-container">
        {/* Desktop Fixed Left Sidebar */}
        <aside className="app-sidebar" aria-label="Sidebar navigation">
          <div className="sidebar-header">
            <Link href="/" className="brand-badge">
              <div className="brand-icon-box">F</div>
              <span>FieldTrack</span>
            </Link>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                background: "var(--status-info-bg)",
                color: "var(--brand-primary)",
                padding: "0.125rem 0.375rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--status-info-border)",
              }}
            >
              PRO
            </span>
          </div>

          <div className="sidebar-content">
            {/* Workspace & Org context */}
            <div style={{ padding: "0 0.25rem" }}>
              <OrgSwitcher
                activeOrgId={activeOrgId}
                activeOrgName={activeOrgName}
                activeRole={activeRole}
                organizations={organizations}
                userEmail={userEmail}
              />
            </div>

            {/* Navigation links */}
            <SidebarNav />
          </div>

          {/* Sidebar Footer with current user profile */}
          <div className="sidebar-footer">
            <div className="user-profile-badge">
              <div className="user-avatar">{profile.avatarInitials}</div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <span className="text-truncate" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {profile.userName}
                </span>
                <span className="text-truncate text-muted" style={{ fontSize: "0.6875rem", textTransform: "capitalize" }}>
                  {profile.role.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer */}
        <div
          className={`mobile-sidebar-backdrop ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div className="sidebar-header">
            <Link
              href="/"
              className="brand-badge"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="brand-icon-box">F</div>
              <span>FieldTrack</span>
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              style={{ width: "2rem", height: "2rem", minHeight: "2rem", minWidth: "2rem", padding: 0 }}
            >
              ✕
            </button>
          </div>
          <div className="sidebar-content">
            <SidebarNav onItemClick={() => setMobileMenuOpen(false)} />
          </div>
          <div className="sidebar-footer">
            <div className="user-profile-badge">
              <div className="user-avatar">{profile.avatarInitials}</div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span className="text-truncate" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {profile.userName}
                </span>
                <span className="text-truncate text-muted" style={{ fontSize: "0.6875rem", textTransform: "capitalize" }}>
                  {profile.role.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Application Area */}
        <div className="app-main-area">
          {/* Top Header */}
          <header className="app-top-header" role="banner">
            <div className="top-header-left">
              {/* Mobile hamburger button */}
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open mobile navigation menu"
                style={{ display: "none" }}
                id="mobile-nav-toggle"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              <PageBreadcrumb />
            </div>

            <div className="top-header-right">
              {/* Role Indicator / Switcher */}
              <RoleSwitcherMenu />

              {/* Quick Auth Action */}
              {userEmail ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                  title={`Signed in as ${userEmail}`}
                  aria-label="Sign out of current account"
                >
                  {isSigningOut ? "Signing out…" : "Sign Out"}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                  aria-label="Sign in to your organization account"
                >
                  Sign In
                </Link>
              )}

              {/* In-app notification bell */}
              <Link
                href="/notifications"
                className="icon-btn"
                aria-label="View notifications"
                style={{ position: "relative" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span
                  style={{
                    position: "absolute",
                    top: "0.375rem",
                    right: "0.375rem",
                    width: "0.5rem",
                    height: "0.5rem",
                    borderRadius: "50%",
                    background: "var(--brand-accent)",
                  }}
                />
              </Link>

              {/* Status Indicator */}
              <div className="header-status-group">
                <StatusBadge descriptor={syncDescriptor} liveRegion />
              </div>
            </div>
          </header>

          {/* Quick Field Actions Bar on narrow views */}
          <main id="main-content" className="app-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps): ReactNode {
  return (
    <RoleProvider
      initialRole={props.activeRole || "manager"}
      authenticatedEmail={props.userEmail}
      authenticatedRole={props.activeRole}
    >
      <ToastProvider>
        <InnerShell {...props} />
      </ToastProvider>
    </RoleProvider>
  );
}
