import type { ReactNode } from "react";
import { AiInsightsClient } from "@/components/ai/AiInsightsClient";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { ManagerDailyBriefing } from "@/modules/ai-intelligence/domain";
import { getManagerDailyBriefingForOrg } from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

export const metadata = {
  title: "AI Operations Insights | FieldTrack",
  description: "AI-assisted field operations analysis, retail cluster observations, and automated follow-ups.",
};

export default async function AiInsightsPage(): Promise<ReactNode> {
  let activeOrgId = "22222222-2222-4222-8222-222222222222";
  let userRole = "manager";
  let initialBriefing: ManagerDailyBriefing | null = null;

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);
      const workspace = await resolveActiveWorkspaceForUser({
        user,
        preferredOrgId,
        repository: tenancyRepository,
      });

      if (workspace.activeOrganization) {
        activeOrgId = workspace.activeOrganization.organization.id;
        userRole = workspace.activeOrganization.membership.role;

        const reportingRepository = new SupabaseReportingRepository(supabase);
        const auditRepository = new SupabaseAuditRepository(supabase);

        initialBriefing = await getManagerDailyBriefingForOrg({
          user,
          candidateOrgId: activeOrgId,
          tenancyRepository,
          reportingRepository,
          auditRepository,
        });
      }
    }
  } catch {
    // If running unauthenticated or in offline demo, client gracefully handles empty/fetch states
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section aria-labelledby="ai-insights-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="ai-insights-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              AI Field Intelligence & Insights
            </h1>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Automated synthesis of daily operations, overdue visits, pending approvals, and suggested managerial follow-ups.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive AI Insights Client */}
      <AiInsightsClient
        orgId={activeOrgId}
        userRole={userRole}
        initialBriefing={initialBriefing}
      />
    </div>
  );
}
