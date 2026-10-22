import Link from "next/link";
import type { ReactNode } from "react";
import {
  getSyncStatusDescriptor,
  StatusBadge,
  type SyncState,
} from "@/components/ui/StatusBadge";
import type { OrgRole } from "@/modules/tenancy/domain";
import { NavLinks } from "./NavLinks";
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

export function AppShell({
  children,
  activeOrgId,
  activeOrgName = "Unselected Organization",
  activeRole = "field_employee",
  organizations = [],
  userEmail = null,
  syncState = "synced",
}: AppShellProps): ReactNode {
  const syncDescriptor = getSyncStatusDescriptor(syncState);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <div className="app-header-inner">
          <div className="brand-group">
            <Link href="/" className="brand-link">
              <span>FieldTrack</span>
            </Link>
            <OrgSwitcher
              activeOrgId={activeOrgId}
              activeOrgName={activeOrgName}
              activeRole={activeRole}
              organizations={organizations}
              userEmail={userEmail}
            />
          </div>

          <div className="header-status-group">
            <StatusBadge descriptor={syncDescriptor} liveRegion />
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav className="primary-nav" aria-label="Primary navigation">
          <NavLinks />
        </nav>

        <main id="main-content" className="main-content" tabIndex={-1}>
          <section className="quick-actions-bar" aria-label="Quick field actions">
            <div>
              <strong style={{ display: "block", fontSize: "1rem" }}>
                Quick Field Actions
              </strong>
              <span className="card-meta">
                One-tap entry for store visits and trip planning
              </span>
            </div>
            <div className="quick-actions-buttons">
              <Link href="/visits" className="btn btn-primary">
                + Record Store Visit
              </Link>
              <Link href="/trips" className="btn btn-secondary">
                + Plan Field Trip
              </Link>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
