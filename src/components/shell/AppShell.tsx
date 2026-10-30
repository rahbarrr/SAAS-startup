"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { PwaOfflineSyncIndicator } from "@/components/pwa/PwaOfflineSyncIndicator";
import { RoleProvider, useCurrentRole } from "@/components/ui/RoleContext";
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
  userName?: string | null;
}

function PageBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return (
      <div className="flex-row-center">
        <span className="header-page-title">Operations Dashboard</span>
      </div>
    );
  }

  const formatSegment = (seg: string) => {
    if (seg === "dashboard") return "Operations Dashboard";
    if (seg === "trips") return "Field Trips";
    if (seg === "visits") return "Store Visits";
    if (seg === "approvals") return "Approvals";
    if (seg === "stores") return "Stores & Doors";
    if (seg === "team") return "Team Directory";
    if (seg === "reports") return "Reports & Analytics";
    if (seg === "ai-insights") return "AI Insights";
    if (seg === "settings") return "Workspace Settings";
    if (seg === "notifications") return "In-App Notifications";
    if (seg === "audit") return "Audit Logs";
    if (seg === "new") return "New";
    if (seg === "edit") return "Edit";
    if (seg === "landing") return "Product Tour";
    return seg.length > 14 ? `${seg.slice(0, 12)}…` : seg;
  };

  return (
    <nav aria-label="Breadcrumb" className="header-breadcrumb">
      <span className="breadcrumb-ancestor">
        <Link href="/dashboard">Dashboard</Link>
      </span>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const href = "/" + segments.slice(0, idx + 1).join("/");
        return (
          <span
            key={href}
            className={`flex-row-center ${isLast ? "breadcrumb-current-wrap" : "breadcrumb-ancestor"}`}
          >
            <span className="header-breadcrumb-sep" aria-hidden="true">
              /
            </span>
            {isLast ? (
              <span className="header-breadcrumb-current" aria-current="page">
                {formatSegment(seg)}
              </span>
            ) : (
              <Link href={href}>{formatSegment(seg)}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function VerifiedRoleBadge() {
  const { currentRole, isAuthenticated, authenticatedEmail } = useCurrentRole();

  if (!isAuthenticated) return null;

  return (
    <div
      className="header-role-pill"
      title={`Verified role for ${authenticatedEmail ?? "session"} enforced via Row-Level Security`}
    >
      <span className="header-role-dot" aria-hidden="true" />
      <span>{currentRole.replace("_", " ")}</span>
    </div>
  );
}

function UserProfileMenu({
  userEmail,
  activeOrgName,
}: {
  userEmail: string | null;
  activeOrgName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, startSignOut] = useTransition();
  const { profile, currentRole } = useCurrentRole();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleSignOut() {
    startSignOut(async () => {
      await signOutAction();
    });
  }

  if (!userEmail) {
    return (
      <Link href="/login" className="btn btn-sm btn-primary">
        Sign In
      </Link>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User profile and account settings"
      >
        <div className="user-avatar">{profile.avatarInitials}</div>
        <span
          className="user-menu-trigger-name"
          style={{ fontSize: "0.8125rem", fontWeight: 600 }}
        >
          {profile.userName}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="user-menu-trigger-chevron"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            <span className="user-menu-name">{profile.userName}</span>
            <span className="user-menu-email">{userEmail}</span>
            <span className="user-menu-org">
              {activeOrgName || "Workspace"} •{" "}
              <strong style={{ textTransform: "capitalize" }}>
                {currentRole.replace("_", " ")}
              </strong>
            </span>
          </div>

          <Link
            href="/settings"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Workspace Settings</span>
          </Link>

          <Link
            href="/notifications"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifications</span>
          </Link>

          <button
            type="button"
            className="user-menu-item user-menu-item--danger"
            role="menuitem"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{isSigningOut ? "Signing out…" : "Sign Out"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function InnerShell({
  children,
  activeOrgId,
  activeOrgName = "",
  activeRole,
  organizations = [],
  userEmail = null,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { profile } = useCurrentRole();
  const pathname = usePathname();

  // Close mobile drawer whenever the active route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock background body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isPublicLanding =
    pathname === "/" || pathname === "/landing" || pathname === "/welcome";

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname?.startsWith("/invite") ||
    pathname === "/onboarding";

  if (isPublicLanding) {
    return (
      <div className="landing-viewport">
        <PwaOfflineSyncIndicator />
        {children}
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <div className="bare-viewport">
        <PwaOfflineSyncIndicator />
        {children}
      </div>
    );
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <PwaOfflineSyncIndicator />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="app-container">
        {/* Desktop Fixed Left Sidebar */}
        <aside
          className="app-sidebar"
          aria-label="Sidebar navigation"
          aria-expanded={!isSidebarCollapsed}
        >
          <div className="sidebar-header">
            <Link href="/dashboard" className="brand-badge" title="FieldTrack Operations">
              <div className="brand-icon-box">F</div>
              <span>FieldTrack</span>
            </Link>

            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={
                isSidebarCollapsed
                  ? "Expand sidebar navigation"
                  : "Collapse sidebar navigation"
              }
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>

          <div className="sidebar-content">
            {/* Workspace & Org context */}
            <OrgSwitcher
              activeOrgId={activeOrgId}
              activeOrgName={activeOrgName}
              activeRole={activeRole}
              organizations={organizations}
              userEmail={userEmail}
              inSidebar
            />

            {/* Navigation links */}
            <SidebarNav />
          </div>

          {/* Sidebar Footer with current user profile */}
          <div className="sidebar-footer">
            {userEmail ? (
              <div className="user-profile-badge">
                <div className="user-avatar">{profile.avatarInitials}</div>
                <div
                  className="user-profile-text"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span className="user-profile-name text-truncate">
                    {profile.userName}
                  </span>
                  <span className="user-profile-role text-truncate">
                    {profile.role ? profile.role.replace("_", " ") : "No Workspace"}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: "0.25rem", textAlign: "center" }}>
                <Link
                  href="/login"
                  className="btn btn-sm btn-primary"
                  style={{ width: "100%" }}
                >
                  Sign In
                </Link>
              </div>
            )}
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
              href="/dashboard"
              className="brand-badge"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="brand-icon-box">F</div>
              <span>FieldTrack</span>
            </Link>
            <button
              type="button"
              className="icon-btn mobile-drawer-close-btn"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              style={{
                width: "var(--touch-target-min)",
                height: "var(--touch-target-min)",
                minWidth: "var(--touch-target-min)",
                minHeight: "var(--touch-target-min)",
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          <div className="sidebar-content">
            <OrgSwitcher
              activeOrgId={activeOrgId}
              activeOrgName={activeOrgName}
              activeRole={activeRole}
              organizations={organizations}
              userEmail={userEmail}
              inSidebar
            />
            <SidebarNav onItemClick={() => setMobileMenuOpen(false)} />
          </div>
          <div className="sidebar-footer">
            {userEmail ? (
              <div className="user-profile-badge">
                <div className="user-avatar">{profile.avatarInitials}</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span className="user-profile-name text-truncate">
                    {profile.userName}
                  </span>
                  <span className="user-profile-role text-truncate">
                    {profile.role ? profile.role.replace("_", " ") : "No Workspace"}
                  </span>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="btn btn-sm btn-primary"
                style={{ width: "100%" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
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
                className="icon-btn mobile-nav-toggle"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open mobile navigation menu"
                id="mobile-nav-toggle"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <PageBreadcrumb />

              {activeOrgName ? (
                <div
                  className="header-org-pill"
                  title={`Active Tenant Workspace: ${activeOrgName}`}
                >
                  <span className="header-org-dot" aria-hidden="true" />
                  <span className="header-org-name text-truncate">{activeOrgName}</span>
                </div>
              ) : null}
            </div>

            <div className="top-header-right">
              {/* Verified Role Badge */}
              <VerifiedRoleBadge />

              {/* In-app notification bell */}
              <Link
                href="/notifications"
                className="icon-btn header-notification-btn"
                aria-label="View notifications"
                title="Notifications"
                style={{ position: "relative" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="header-notification-dot" aria-hidden="true" />
              </Link>

              {/* User profile dropdown menu */}
              <UserProfileMenu userEmail={userEmail} activeOrgName={activeOrgName} />
            </div>
          </header>

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
      authenticatedEmail={props.userEmail}
      authenticatedRole={props.activeRole}
      userName={props.userName}
    >
      <ToastProvider>
        <InnerShell {...props} />
      </ToastProvider>
    </RoleProvider>
  );
}
