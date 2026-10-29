import type { ReactNode } from "react";
import { AiInsightsClient } from "@/components/ai/AiInsightsClient";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { ManagerDailyBriefing } from "@/modules/ai-intelligence/domain";
import { getManagerDailyBriefingForOrg } from "@/modules/ai-intelligence/service";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";

export const metadata = {
  title: "AI Operations Insights | FieldTrack",
  description:
    "AI-assisted field operations analysis, retail cluster observations, and automated follow-ups.",
};

export default async function AiInsightsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const isManagerOrAdmin = role === "manager" || role === "admin";
  let initialBriefing: ManagerDailyBriefing | null = null;

  if (isManagerOrAdmin) {
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
  }

  if (!isManagerOrAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <section aria-labelledby="ai-insights-heading">
          <h1
            id="ai-insights-heading"
            style={{
              margin: "0 0 0.25rem",
              fontSize: "1.625rem",
              fontFamily: "var(--font-heading)",
              color: "var(--brand-dark)",
            }}
          >
            AI Field Intelligence &amp; Insights — {activeOrg.name}
          </h1>
        </section>
        <div
          role="note"
          className="card"
          style={{ padding: "1.25rem", fontSize: "0.9375rem" }}
        >
          <strong>Role Notice:</strong> You are currently signed in as a{" "}
          <code>{role}</code>. AI operational briefings and managerial recommendations
          require an active manager or admin workspace membership.
        </div>
      </div>
    );
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
