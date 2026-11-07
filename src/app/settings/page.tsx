import type { ReactNode } from "react";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/modules/tenancy/authorization";

export const metadata = {
  title: "Settings & Profile | FieldTrack",
  description:
    "Enterprise workspace settings, user preferences, notification rules, security, and subscription.",
};

export default async function SettingsPage(): Promise<ReactNode> {
  const { user, activeOrg, role } = await requireActiveWorkspace();
  const canManageOrg = hasPermission(role, "settings.organization");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section className="page-header" aria-labelledby="settings-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">
            {canManageOrg ? "Workspace Configuration" : "Personal Account"}
          </p>
          <h1 id="settings-heading" className="page-title">
            {canManageOrg
              ? "Workspace & Organization Settings"
              : "My Profile & Permitted Settings"}
          </h1>
          <p className="page-subtitle">
            {canManageOrg
              ? "Configure company parameters, notification rules, territory defaults, security policies, and subscription tiers."
              : "View your personal profile, role membership, display theme, and notification preferences."}
          </p>
        </div>
      </section>

      {/* Interactive Settings Client */}
      <SettingsClient
        activeOrg={{
          id: activeOrg.id,
          name: activeOrg.name,
          slug: activeOrg.slug,
          status: activeOrg.status,
        }}
        userEmail={user.email ?? ""}
        userRole={role}
      />
    </div>
  );
}
