import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import type { OrgSwitcherOption } from "@/components/shell/OrgSwitcher";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "FieldTrack — Multi-Tenant Field Operations",
  description:
    "Plan field trips, manage approvals, record store visits, capture evidence, and review outcomes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FieldTrack",
  },
  icons: {
    apple: "/icons/icon-192.svg",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let activeOrgId: string | undefined;
  let activeOrgName: string | undefined;
  let activeRole: OrgRole | undefined;
  let organizations: OrgSwitcherOption[] = [];
  let userEmail: string | null = null;
  let userName: string | null = null;

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    if (user) {
      userEmail = user.email;
      userName = user.fullName ?? null;
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);

      try {
        const workspace = await resolveActiveWorkspaceForUser({
          user,
          preferredOrgId,
          repository: tenancyRepository,
        });

        if (workspace.activeOrganization) {
          activeOrgId = workspace.activeOrganization.organization.id;
          activeOrgName = workspace.activeOrganization.organization.name;
          activeRole = workspace.activeOrganization.membership.role;
        }
        organizations = workspace.organizations.map((item) => ({
          orgId: item.organization.id,
          orgName: item.organization.name,
          role: item.membership.role,
        }));
      } catch (err) {
        logger.warn("Failed to resolve active workspace in RootLayout", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch {
    // Non-blocking fallback for pre-auth states or unconfigured envs
  }

  return (
    <html lang="en">
      <body>
        <AppShell
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          activeRole={activeRole}
          organizations={organizations}
          userEmail={userEmail}
          userName={userName}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
