import type { ReactNode } from "react";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { OperationsReportSummary } from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getOperationsReportForOrg } from "@/modules/reporting/service";
import { hasPermission } from "@/modules/tenancy/authorization";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports & Analytics | FieldTrack Operations",
  description:
    "Enterprise field operations performance, trip execution velocity, and compliance audit reports.",
};

export default async function ReportsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const isOrgReports = hasPermission(role, "reports.view.organization");
  const isTeamReports = hasPermission(role, "reports.view.team");
  const isManagerOrAdmin = isOrgReports || isTeamReports;
  let report: OperationsReportSummary | null = null;
  let errorMessage: string | null = null;

  if (!isManagerOrAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PermissionDeniedState
          currentRole={role}
          title="Reports & Analytics Restricted"
          message={`Organization and team analytics for ${activeOrg.name} are restricted to Administrators and Managers. Use My Activity (/visits?view=activity) to review your personal trip and visit records.`}
          requiredPermission="reports.view.team"
        />
      </div>
    );
  }

  try {
    const reportingRepository = new SupabaseReportingRepository(supabase);
    report = await getOperationsReportForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { range: "30d" },
      tenancyRepository,
      reportingRepository,
    });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load operations report.";
  }

  if (errorMessage || !report) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <section aria-labelledby="reports-heading">
          <h1
            id="reports-heading"
            style={{
              margin: "0 0 0.25rem",
              fontSize: "1.625rem",
              fontFamily: "var(--font-heading)",
              color: "var(--brand-dark)",
            }}
          >
            Operations &amp; Compliance Reports — {activeOrg.name}
          </h1>
        </section>
        <ErrorState
          title="Operations report unavailable"
          message={
            errorMessage ?? "Unable to calculate operations report for this workspace."
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Heading Section */}
      <section className="page-header" aria-labelledby="reports-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">
            {isOrgReports ? "Organization Analytics" : "Team Operations Analytics"}
          </p>
          <h1 id="reports-heading" className="page-title">
            {isOrgReports
              ? "Reports & Analytics — Organization Overview"
              : "Team Reports & Analytics"}
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrg.name}</strong> •{" "}
            {isOrgReports
              ? "Organization-wide field trip velocity, store visit audit scores, and representative performance analytics."
              : "Assigned team performance, territory coverage, and store visit completion analytics."}
          </p>
        </div>
      </section>

      {/* Interactive Reports Client Component */}
      <ReportsClient initialReport={report} orgId={activeOrgId} userRole={role} />
    </div>
  );
}
