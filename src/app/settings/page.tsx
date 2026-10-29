import type { ReactNode } from "react";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";

export const metadata = {
  title: "Workspace Settings | FieldTrack",
  description:
    "Enterprise workspace settings, user preferences, notification rules, security, and subscription.",
};

export default async function SettingsPage(): Promise<ReactNode> {
  const { user, activeOrg, role } = await requireActiveWorkspace();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section className="page-header" aria-labelledby="settings-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Workspace Configuration</p>
          <h1 id="settings-heading" className="page-title">
            Workspace &amp; Organization Settings
          </h1>
          <p className="page-subtitle">
            Configure company parameters, notification rules, territory defaults, security
            policies, and subscription tiers.
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
