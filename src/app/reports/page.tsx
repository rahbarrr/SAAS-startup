import type { ReactNode } from "react";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  DEMO_PLANNED_VS_ACTUAL_ROWS,
  DEMO_REPORTING_METRICS,
} from "@/lib/mock-data/fieldtrack-demo-data";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { OperationsReportSummary } from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getOperationsReportForOrg } from "@/modules/reporting/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

import type { TripStatus } from "@/modules/trips/domain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports & Analytics | FieldTrack Operations",
  description:
    "Enterprise field operations performance, trip execution velocity, and compliance audit reports.",
};

function buildDemoOperationsReport(): OperationsReportSummary {
  return {
    timeWindow: {
      range: "30d",
      startDateFrom: "2026-09-25",
      startDateTo: "2026-10-25",
      label: "Trailing 30 Days (Demo)",
    },
    kpis: {
      visitCompletionRate: DEMO_REPORTING_METRICS.kpis.visitCompletionRate,
      auditComplianceScore: DEMO_REPORTING_METRICS.kpis.auditComplianceScore,
      totalFieldHours: DEMO_REPORTING_METRICS.kpis.totalFieldHours,
      exceptionsLogged: DEMO_REPORTING_METRICS.kpis.exceptionsLogged,
      approvalTurnaroundHoursAvg: 3.4,
      totalTrips: 35,
      completedTrips: 18,
      activeStoresCount: 38,
      evidenceCompletionRate: 94,
      overdueVisitsCount: 2,
      checkInOutComplianceRate: 98,
    },
    tripsByStatus: DEMO_REPORTING_METRICS.tripsByStatus.map((t) => ({
      status: t.status as TripStatus,
      label: t.status,
      count: t.count,
      percentage: t.percentage,
      color: t.color,
    })),
    weeklyVisitsTrend: DEMO_REPORTING_METRICS.weeklyVisitsTrend,
    territorySummary: DEMO_REPORTING_METRICS.territorySummary.map((t) => ({
      ...t,
      visitedStores: t.completedVisits,
      coveragePercentage: Math.round(
        (t.completedVisits / Math.max(1, t.storeCount)) * 100
      ),
      missedVisits: Math.max(0, t.scheduledVisits - t.completedVisits),
    })),
    repPerformance: DEMO_REPORTING_METRICS.repPerformance.map((r, i) => ({
      userId: `rep-demo-${i + 1}`,
      name: r.name,
      role: r.role,
      territory: r.territory,
      assignedTrips: 8,
      plannedStops: Math.round(r.completedVisits * 1.1),
      completedVisits: r.completedVisits,
      completionRate: r.completionRate,
      avgVisitDurationMin: r.avgVisitDurationMin,
      exceptionsFlagged: r.exceptionsFlagged,
      outstandingAssignments: Math.round(r.completedVisits * 0.1),
      overdueStops: i === 0 ? 1 : 0,
    })),
    storeVisitAnalytics: [],
    definitions: {
      visitCompletionRate:
        "Percentage of planned store visit stops with verified check-out.",
      auditComplianceScore:
        "Percentage of completed store visits with zero flagged audit checklist items.",
      totalFieldHours:
        "Cumulative time in hours elapsed between check-in and check-out.",
      approvalTurnaroundHoursAvg:
        "Average turnaround time in hours from trip submission to manager decision.",
      exceptionsLogged:
        "Count of store visits or trips with at least one operational anomaly.",
    },
    rows: DEMO_PLANNED_VS_ACTUAL_ROWS,
  };
}

export default async function ReportsPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let isDemo = true;
  let userRole: string = "visitor";
  let initialReport: OperationsReportSummary = buildDemoOperationsReport();

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
        activeOrgName = workspace.activeOrganization.organization.name;
        userRole = workspace.activeOrganization.membership.role;

        if (userRole === "manager" || userRole === "admin") {
          const reportingRepository = new SupabaseReportingRepository(supabase);
          initialReport = await getOperationsReportForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { range: "30d" },
            tenancyRepository,
            reportingRepository,
          });
          isDemo = false;
        }
      }
    }
  } catch (error) {
    // Graceful fallback to demo data on unhandled session/connectivity errors
    console.error("Failed to load initial operational report:", error);
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
              Operations &amp; Compliance Reports
              {activeOrgName ? ` — ${activeOrgName}` : ""}
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
          {isDemo ? (
            <span
              style={{
                background: "var(--status-info-bg)",
                color: "var(--brand-primary)",
                padding: "0.25rem 0.625rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem",
                fontWeight: 700,
                border: "1px solid var(--status-info-border)",
              }}
            >
              ⚡ Live Demo State
            </span>
          ) : null}
        </div>
      </section>

      {/* Interactive Reports Client Component */}
      <ReportsClient
        initialReport={initialReport}
        orgId={activeOrgId}
        isDemo={isDemo}
        userRole={userRole}
      />
    </div>
  );
}
