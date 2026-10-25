import type { ReactNode } from "react";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata = {
  title: "Workspace Settings | FieldTrack",
  description: "Enterprise workspace settings, user preferences, notification rules, security, and subscription.",
};

export default function SettingsPage(): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section aria-labelledby="settings-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="settings-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Workspace & Organization Settings
            </h1>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Configure company parameters, notification rules, territory defaults, security policies, and subscription tiers.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Settings Client */}
      <SettingsClient />
    </div>
  );
}
