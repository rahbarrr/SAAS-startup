import type { ReactNode } from "react";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { OperationsReportSummary } from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getOperationsReportForOrg } from "@/modules/reporting/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports & Analytics | FieldTrack Operations",
  description:
    "Enterprise field operations performance, trip execution velocity, and compliance audit reports.",
};

export default async function ReportsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const isManagerOrAdmin = role === "manager" || role === "admin";
  let report: OperationsReportSummary | null = null;
  let errorMessage: string | null = null;

  try {
    if (isManagerOrAdmin) {
      const reportingRepository = new SupabaseReportingRepository(supabase);
      report = await getOperationsReportForOrg({
        user,
        candidateOrgId: activeOrgId,
        rawQuery: { range: "30d" },
        tenancyRepository,
        reportingRepository,
      });
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load operations report.";
  }

  if (!isManagerOrAdmin) {
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
        <div
          role="note"
          className="card"
          style={{ padding: "1.25rem", fontSize: "0.9375rem" }}
        >
          <strong>Role Notice:</strong> You are currently signed in as a{" "}
          <code>{role}</code>. Viewing organization-wide operations and compliance reports
          requires an active manager or admin workspace membership.
        </div>
      </div>
    );
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
      <section aria-labelledby="reports-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
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
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              Cross-territory field trip velocity, store visit audit scores, and
              representative performance analytics.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Reports Client Component */}
      <ReportsClient initialReport={report} orgId={activeOrgId} userRole={role} />
    </div>
  );
}
