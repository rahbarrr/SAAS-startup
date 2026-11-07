import type { ReactNode } from "react";
import { AiInsightsClient } from "@/components/ai/AiInsightsClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { ManagerDailyBriefing } from "@/modules/ai-intelligence/domain";
import { getManagerDailyBriefingForOrg } from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { hasPermission } from "@/modules/tenancy/authorization";

export const metadata = {
  title: "AI Operations Insights | FieldTrack",
  description:
    "AI-assisted field operations analysis, retail cluster observations, and automated follow-ups.",
};

export default async function AiInsightsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  if (!hasPermission(role, "ai.insights")) {
    return (
      <PermissionDeniedState
        title="AI Insights Restricted to Organization Administrators"
        message="Organization-wide AI operational intelligence and executive briefings are only accessible to organization administrators."
        currentRole={role}
        requiredPermission="ai.insights"
      />
    );
  }

  let initialBriefing: ManagerDailyBriefing | null = null;

  try {
    const reportingRepository = new SupabaseReportingRepository(supabase);
    const auditRepository = new SupabaseAuditRepository(supabase);

    initialBriefing = await getManagerDailyBriefingForOrg({
      user,
      candidateOrgId: activeOrgId,
      tenancyRepository,
      reportingRepository,
      auditRepository,
    });
  } catch {
    // Handled cleanly by AiInsightsClient empty/error states
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section className="page-header" aria-labelledby="ai-insights-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Operational Intelligence</p>
          <h1 id="ai-insights-heading" className="page-title">
            AI Field Intelligence &amp; Insights
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrg.name}</strong> • Automated synthesis of daily
            operations, overdue visits, pending approvals, and suggested managerial
            follow-ups.
          </p>
        </div>
      </section>

      {/* Interactive AI Insights Client */}
      <AiInsightsClient
        orgId={activeOrgId}
        userRole={role}
        initialBriefing={initialBriefing}
      />
    </div>
  );
}
