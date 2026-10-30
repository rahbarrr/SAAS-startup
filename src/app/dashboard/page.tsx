import Link from "next/link";
import type { ReactNode } from "react";
import { ManagerDashboardClient } from "@/components/dashboard/ManagerDashboardClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { listAuditEventsForOrg } from "@/modules/audit/service";
import {
  DASHBOARD_METRIC_DEFINITIONS,
  type DashboardMetricsSummary,
  type PlannedVsActualStopRow,
} from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getManagerDashboardForOrg } from "@/modules/reporting/service";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg, listTripsForOrg } from "@/modules/trips/service";
import type { Visit } from "@/modules/visits/domain";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { listVisitsForOrg } from "@/modules/visits/service";

export const metadata = {
  title: "Operations Dashboard | FieldTrack",
  description: "FieldTrack operational oversight, field visits, approvals, and metrics.",
};

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function pickSingleParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function buildEmptyMetricsSummary(referenceDateUtc: string): DashboardMetricsSummary {
  return {
    tripsAwaitingApproval: 0,
    approvedTrips: 0,
    approvedTripsBreakdown: {
      approvedNotStarted: 0,
      inProgress: 0,
      completedAllStopsCheckedOut: 0,
    },
    tripsByStatus: {
      draft: 0,
      submitted: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
      changes_requested: 0,
      rejected: 0,
    },
    completedVisits: 0,
    pendingVisits: 0,
    exceptionsRequiringAttention: 0,
    definitions: DASHBOARD_METRIC_DEFINITIONS,
    timezoneBoundaryNote:
      "All date boundaries (startDateFrom, startDateTo, trip start_date/end_date) are evaluated as ISO-8601 calendar dates in UTC (YYYY-MM-DD), and all check-in/check-out timestamps are recorded in UTC.",
    referenceDateUtc,
  };
}

export default async function DashboardPage(
  props: DashboardPageProps
): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const resolvedParams = (await props.searchParams) ?? {};
  const startDateFrom = pickSingleParam(resolvedParams.startDateFrom);
  const startDateTo = pickSingleParam(resolvedParams.startDateTo);
  const employeeUserId = pickSingleParam(resolvedParams.employeeUserId);
  const tripStatus = pickSingleParam(resolvedParams.tripStatus);
  const visitStatus = pickSingleParam(resolvedParams.visitStatus);
  const storeId = pickSingleParam(resolvedParams.storeId);
  const onlyExceptions = pickSingleParam(resolvedParams.onlyExceptions);
  const cursor = pickSingleParam(resolvedParams.cursor);

  const referenceDateUtc = new Date().toISOString().slice(0, 10);
  let metrics: DashboardMetricsSummary = buildEmptyMetricsSummary(referenceDateUtc);
  let items: PlannedVsActualStopRow[] = [];
  let nextCursor: string | null = null;
  let accessNote: string | null = null;
  let dashboardError: string | null = null;

  let pendingApprovals: readonly Trip[] = [];
  let inProgressTrips: readonly Trip[] = [];
  let recentVisits: readonly Visit[] = [];
  let recentAuditEvents: readonly OrganizationAuditEvent[] = [];

  let employeeTrips: readonly Trip[] = [];
  let employeeVisits: readonly Visit[] = [];

  const tripsRepository = new SupabaseTripsRepository(supabase);
  const visitsRepository = new SupabaseVisitsRepository(supabase);

  try {
    if (role === "manager" || role === "admin") {
      const reportingRepository = new SupabaseReportingRepository(supabase);
      const dashboard = await getManagerDashboardForOrg({
        user,
        candidateOrgId: activeOrgId,
        rawQuery: {
          startDateFrom,
          startDateTo,
          employeeUserId,
          tripStatus,
          visitStatus,
          storeId,
          onlyExceptions,
          cursor,
        },
        tenancyRepository,
        reportingRepository,
      });
      metrics = dashboard.metrics;
      items = dashboard.items;
      nextCursor = dashboard.pagination.nextCursor;

      const auditRepository = new SupabaseAuditRepository(supabase);

      const [pendingResult, inProgressResult, visitsResult, auditResult] =
        await Promise.all([
          listManagerApprovalInboxForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { status: "submitted", limit: 10 },
            tenancyRepository,
            tripsRepository,
          }).catch(() => ({ items: [] })),
          listTripsForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { status: "in_progress", limit: 10 },
            tenancyRepository,
            tripsRepository,
          }).catch(() => ({ items: [] })),
          listVisitsForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { limit: 5 },
            tenancyRepository,
            visitsRepository,
          }).catch(() => ({ items: [] })),
          listAuditEventsForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { limit: 5 },
            tenancyRepository,
            auditRepository,
          }).catch(() => ({ items: [] })),
        ]);

      pendingApprovals = pendingResult.items;
      inProgressTrips = inProgressResult.items;
      recentVisits = visitsResult.items;
      recentAuditEvents = auditResult.items;
    } else {
      // Role is field_employee — load employee's own trips and visits
      accessNote =
        "You are signed in as a field representative. Showing your assigned trips and recorded visits. Organization-wide dashboard aggregates and CSV export require an active manager or admin membership.";

      const [myTripsResult, myVisitsResult] = await Promise.all([
        listTripsForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 10 },
          tenancyRepository,
          tripsRepository,
        }).catch(() => ({ items: [] })),
        listVisitsForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 10 },
          tenancyRepository,
          visitsRepository,
        }).catch(() => ({ items: [] })),
      ]);

      employeeTrips = myTripsResult.items;
      employeeVisits = myVisitsResult.items;
    }
  } catch (err) {
    dashboardError =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while loading dashboard operational metrics.";
  }

  const exportQuery = new URLSearchParams();
  if (startDateFrom) exportQuery.set("startDateFrom", startDateFrom);
  if (startDateTo) exportQuery.set("startDateTo", startDateTo);
  if (employeeUserId) exportQuery.set("employeeUserId", employeeUserId);
  if (tripStatus) exportQuery.set("tripStatus", tripStatus);
  if (visitStatus) exportQuery.set("visitStatus", visitStatus);
  if (storeId) exportQuery.set("storeId", storeId);
  if (onlyExceptions) exportQuery.set("onlyExceptions", onlyExceptions);

  const exportHref = `/api/orgs/${activeOrgId}/dashboard/export${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`;

  const totalTrips =
    metrics.tripsByStatus.draft +
    metrics.tripsByStatus.submitted +
    metrics.tripsByStatus.approved +
    metrics.tripsByStatus.in_progress +
    metrics.tripsByStatus.completed +
    metrics.tripsByStatus.changes_requested +
    metrics.tripsByStatus.rejected;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Workspace Context & Header Section */}
      <section className="dashboard-hero" aria-labelledby="overview-heading">
        <div className="dashboard-hero-content">
          <div className="workspace-context-chips">
            <span className="workspace-context-pill">
              <span className="workspace-context-dot" aria-hidden="true" />
              {activeOrg.name}
            </span>
            <span className="workspace-isolation-pill">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Tenant Isolated (RLS)
            </span>
            <span className="workspace-date-pill">
              UTC Reference: <code>{referenceDateUtc}</code>
            </span>
          </div>

          <div className="dashboard-hero-titles">
            <h1 id="overview-heading" className="dashboard-hero-title">
              {role === "field_employee"
                ? `My Field Operations — ${activeOrg.name}`
                : `Operations Dashboard — ${activeOrg.name}`}
            </h1>
            <p className="dashboard-hero-subtitle">
              Live operational telemetry computed from committed database state. All
              check-ins and evidence strictly isolated per tenant.
            </p>
          </div>
        </div>

        <div className="dashboard-hero-actions">
          <Link href="/trips/new" className="btn btn-primary dashboard-primary-cta">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Plan New Trip</span>
          </Link>
          {role === "manager" || role === "admin" ? (
            <a
              href={exportHref}
              className="btn btn-secondary dashboard-export-cta"
              title="Export authorized dataset as CSV"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </a>
          ) : null}
        </div>
      </section>

      {dashboardError ? (
        <ErrorState
          title="Dashboard operational data unavailable"
          message={dashboardError}
        />
      ) : null}

      {accessNote ? (
        <div role="note" className="alert alert--info">
          <span aria-hidden="true">ℹ️</span>
          <div>
            <strong>Role Scope Notice:</strong> {accessNote}
          </div>
        </div>
      ) : null}

      {/* Field Employee View */}
      {role === "field_employee" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="kpi-grid">
            <div className="kpi-card kpi-card--primary">
              <div className="kpi-card-top">
                <span className="kpi-label">My Field Trips</span>
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                    <line x1="9" y1="3" x2="9" y2="18" />
                    <line x1="15" y1="6" x2="15" y2="21" />
                  </svg>
                </span>
              </div>
              <div className="kpi-value">{employeeTrips.length}</div>
              <p className="kpi-subtitle">Assigned itineraries</p>
              <div className="kpi-card-footer">
                <Link href="/trips" className="btn btn-sm btn-outline kpi-action-btn">
                  View Trips →
                </Link>
              </div>
            </div>

            <div className="kpi-card kpi-card--success">
              <div className="kpi-card-top">
                <span className="kpi-label">Recorded Visits</span>
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
              </div>
              <div className="kpi-value">{employeeVisits.length}</div>
              <p className="kpi-subtitle">Recent store executions</p>
              <div className="kpi-card-footer">
                <Link href="/visits" className="btn btn-sm btn-outline kpi-action-btn">
                  View Visits →
                </Link>
              </div>
            </div>

            <div className="kpi-card kpi-card--violet">
              <div className="kpi-card-top">
                <span className="kpi-label">Stores Directory</span>
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </span>
              </div>
              <div className="kpi-value">Directory</div>
              <p className="kpi-subtitle">Browse retail accounts</p>
              <div className="kpi-card-footer">
                <Link href="/stores" className="btn btn-sm btn-outline kpi-action-btn">
                  Browse Stores →
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <Link href="/trips/new" className="quick-action">
              <div className="quick-action-icon">➕</div>
              <div className="quick-action-text">
                <span>Plan Field Trip</span>
                <span className="quick-action-desc">Create multi-stop route</span>
              </div>
            </Link>
            <Link href="/trips" className="quick-action">
              <div className="quick-action-icon">🗺️</div>
              <div className="quick-action-text">
                <span>My Field Itineraries</span>
                <span className="quick-action-desc">Check status and stops</span>
              </div>
            </Link>
            <Link href="/visits" className="quick-action">
              <div className="quick-action-icon">📋</div>
              <div className="quick-action-text">
                <span>Store Visit Checklists</span>
                <span className="quick-action-desc">Execute on-site evidence</span>
              </div>
            </Link>
          </div>

          {/* Employee Trips List */}
          <section className="card" aria-labelledby="my-trips-heading">
            <div className="card-header">
              <h2 id="my-trips-heading" className="card-title">
                My Recent Field Trips
              </h2>
              <Link href="/trips" className="btn btn-sm btn-secondary">
                View All Trips →
              </Link>
            </div>

            {employeeTrips.length === 0 ? (
              <EmptyState
                title="No field trips planned yet"
                description="Create your first itinerary to schedule store visits and request approval."
                actionLabel="Plan New Trip"
                actionHref="/trips/new"
              />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Trip Title</th>
                      <th scope="col">Schedule</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeTrips.map((trip) => (
                      <tr key={trip.id}>
                        <td>
                          <strong>{trip.title}</strong>
                        </td>
                        <td>
                          {trip.startDate} to {trip.endDate}
                        </td>
                        <td>
                          <StatusBadge
                            descriptor={getApprovalStatusDescriptor(trip.status)}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/trips/${trip.id}`}
                            className="btn btn-sm btn-secondary"
                          >
                            View Itinerary →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Manager / Admin View */
        <>
          {/* Section 5: Operational KPI Cards Grid */}
          <section
            className="kpi-grid"
            aria-label="Documented operational metrics summary"
          >
            <article className="kpi-card kpi-card--warning">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <Link href="/approvals" style={{ textDecoration: "none" }}>
                  <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
                </Link>
              </div>
              <h2 className="kpi-label">
                {metrics.definitions.tripsAwaitingApproval.label}
              </h2>
              <div className="kpi-value" style={{ color: "var(--status-warning-text)" }}>
                {metrics.tripsAwaitingApproval}
              </div>
              <p className="kpi-subtitle">Awaiting manager review</p>
              <div className="kpi-card-footer">
                <Link href="/approvals" className="btn btn-sm btn-outline kpi-action-btn">
                  Review →
                </Link>
                <details className="kpi-rule-details">
                  <summary className="kpi-rule-summary" title="View calculation rule">
                    Rule
                  </summary>
                  <div className="kpi-rule-content">
                    <strong>Rule:</strong>{" "}
                    {metrics.definitions.tripsAwaitingApproval.formulaSummary}
                  </div>
                </details>
              </div>
            </article>

            <article className="kpi-card kpi-card--primary">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <Link
                  href="/dashboard?tripStatus=approved"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
                </Link>
              </div>
              <h2 className="kpi-label">{metrics.definitions.approvedTrips.label}</h2>
              <div className="kpi-value">{metrics.approvedTrips}</div>
              <p className="kpi-subtitle">
                {metrics.approvedTripsBreakdown.approvedNotStarted} not started •{" "}
                {metrics.approvedTripsBreakdown.inProgress} active •{" "}
                {metrics.approvedTripsBreakdown.completedAllStopsCheckedOut} done
              </p>
              <div className="kpi-card-footer">
                <Link
                  href="/dashboard?tripStatus=approved"
                  className="btn btn-sm btn-outline kpi-action-btn"
                >
                  Filter →
                </Link>
                <details className="kpi-rule-details">
                  <summary className="kpi-rule-summary" title="View calculation rule">
                    Rule
                  </summary>
                  <div className="kpi-rule-content">
                    <strong>Rule:</strong>{" "}
                    {metrics.definitions.approvedTrips.completionRuleNote}
                  </div>
                </details>
              </div>
            </article>

            <article className="kpi-card kpi-card--success">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <Link
                  href="/dashboard?visitStatus=submitted"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("completed")} />
                </Link>
              </div>
              <h2 className="kpi-label">{metrics.definitions.completedVisits.label}</h2>
              <div className="kpi-value" style={{ color: "var(--status-success)" }}>
                {metrics.completedVisits}
              </div>
              <p className="kpi-subtitle">Completed &amp; submitted visits</p>
              <div className="kpi-card-footer">
                <Link
                  href="/dashboard?visitStatus=submitted"
                  className="btn btn-sm btn-outline kpi-action-btn"
                >
                  Filter →
                </Link>
                <details className="kpi-rule-details">
                  <summary className="kpi-rule-summary" title="View calculation rule">
                    Rule
                  </summary>
                  <div className="kpi-rule-content">
                    <strong>Rule:</strong>{" "}
                    {metrics.definitions.completedVisits.formulaSummary}
                  </div>
                </details>
              </div>
            </article>

            <article className="kpi-card kpi-card--info">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <Link
                  href="/dashboard?visitStatus=in_progress"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("in_progress")} />
                </Link>
              </div>
              <h2 className="kpi-label">{metrics.definitions.pendingVisits.label}</h2>
              <div className="kpi-value">{metrics.pendingVisits}</div>
              <p className="kpi-subtitle">Scheduled or active in field</p>
              <div className="kpi-card-footer">
                <Link
                  href="/dashboard?visitStatus=in_progress"
                  className="btn btn-sm btn-outline kpi-action-btn"
                >
                  Filter →
                </Link>
                <details className="kpi-rule-details">
                  <summary className="kpi-rule-summary" title="View calculation rule">
                    Rule
                  </summary>
                  <div className="kpi-rule-content">
                    <strong>Rule:</strong>{" "}
                    {metrics.definitions.pendingVisits.formulaSummary}
                  </div>
                </details>
              </div>
            </article>

            <article className="kpi-card kpi-card--danger">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <Link
                  href="/dashboard?onlyExceptions=true"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge
                    descriptor={getApprovalStatusDescriptor("changes_requested")}
                  />
                </Link>
              </div>
              <h2 className="kpi-label">
                {metrics.definitions.exceptionsRequiringAttention.label}
              </h2>
              <div className="kpi-value" style={{ color: "var(--status-danger)" }}>
                {metrics.exceptionsRequiringAttention}
              </div>
              <p className="kpi-subtitle">Discrepancies needing action</p>
              <div className="kpi-card-footer">
                <Link
                  href="/dashboard?onlyExceptions=true"
                  className="btn btn-sm btn-outline kpi-action-btn"
                >
                  Exceptions →
                </Link>
                <details className="kpi-rule-details">
                  <summary className="kpi-rule-summary" title="View calculation rule">
                    Rule
                  </summary>
                  <div className="kpi-rule-content">
                    <strong>Rule:</strong>{" "}
                    {metrics.definitions.exceptionsRequiringAttention.formulaSummary}
                  </div>
                </details>
              </div>
            </article>
          </section>

          {/* Section 6: Trips by Status Lifecycle Visualization */}
          <section
            className="status-distribution-card"
            aria-labelledby="status-distribution-heading"
          >
            <div className="status-distribution-header">
              <div>
                <h2 id="status-distribution-heading" className="card-title">
                  Trip Lifecycle Distribution
                </h2>
                <p className="card-meta">
                  Fleet status breakdown across {totalTrips} scheduled itineraries in
                  active scope
                </p>
              </div>
              <div className="status-distribution-actions">
                <Link href="/trips" className="btn btn-sm btn-outline">
                  All Itineraries ({totalTrips}) →
                </Link>
              </div>
            </div>

            {/* Segmented Distribution Progress Bar */}
            <div
              className="status-bar-track"
              role="progressbar"
              aria-label="Trip status distribution"
              aria-valuenow={totalTrips}
            >
              {totalTrips > 0 ? (
                <>
                  {metrics.tripsByStatus.approved > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--approved"
                      style={{
                        width: `${(metrics.tripsByStatus.approved / totalTrips) * 100}%`,
                      }}
                      title={`Approved: ${metrics.tripsByStatus.approved} (${Math.round((metrics.tripsByStatus.approved / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.in_progress > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--in-progress"
                      style={{
                        width: `${(metrics.tripsByStatus.in_progress / totalTrips) * 100}%`,
                      }}
                      title={`In Progress: ${metrics.tripsByStatus.in_progress} (${Math.round((metrics.tripsByStatus.in_progress / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.completed > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--completed"
                      style={{
                        width: `${(metrics.tripsByStatus.completed / totalTrips) * 100}%`,
                      }}
                      title={`Completed: ${metrics.tripsByStatus.completed} (${Math.round((metrics.tripsByStatus.completed / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.submitted > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--submitted"
                      style={{
                        width: `${(metrics.tripsByStatus.submitted / totalTrips) * 100}%`,
                      }}
                      title={`Submitted: ${metrics.tripsByStatus.submitted} (${Math.round((metrics.tripsByStatus.submitted / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.changes_requested > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--changes"
                      style={{
                        width: `${(metrics.tripsByStatus.changes_requested / totalTrips) * 100}%`,
                      }}
                      title={`Changes Requested: ${metrics.tripsByStatus.changes_requested} (${Math.round((metrics.tripsByStatus.changes_requested / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.rejected > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--rejected"
                      style={{
                        width: `${(metrics.tripsByStatus.rejected / totalTrips) * 100}%`,
                      }}
                      title={`Rejected: ${metrics.tripsByStatus.rejected} (${Math.round((metrics.tripsByStatus.rejected / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                  {metrics.tripsByStatus.draft > 0 ? (
                    <div
                      className="status-bar-segment status-bar-segment--draft"
                      style={{
                        width: `${(metrics.tripsByStatus.draft / totalTrips) * 100}%`,
                      }}
                      title={`Draft: ${metrics.tripsByStatus.draft} (${Math.round((metrics.tripsByStatus.draft / totalTrips) * 100)}%)`}
                    />
                  ) : null}
                </>
              ) : (
                <div
                  className="status-bar-segment status-bar-segment--empty"
                  style={{ width: "100%" }}
                />
              )}
            </div>

            {/* Status Tiles Grid */}
            <div className="status-tiles-grid kpi-status-chips">
              <Link
                href="/dashboard?tripStatus=submitted"
                className={`status-tile ${tripStatus === "submitted" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--warning" />
                  <span className="status-tile-name">Submitted</span>
                </div>
                <div className="status-tile-count">{metrics.tripsByStatus.submitted}</div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.submitted / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=approved"
                className={`status-tile ${tripStatus === "approved" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--primary" />
                  <span className="status-tile-name">Approved</span>
                </div>
                <div className="status-tile-count">{metrics.tripsByStatus.approved}</div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.approved / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=in_progress"
                className={`status-tile ${tripStatus === "in_progress" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--info" />
                  <span className="status-tile-name">In Progress</span>
                </div>
                <div className="status-tile-count">
                  {metrics.tripsByStatus.in_progress}
                </div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.in_progress / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=completed"
                className={`status-tile ${tripStatus === "completed" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--success" />
                  <span className="status-tile-name">Completed</span>
                </div>
                <div className="status-tile-count">{metrics.tripsByStatus.completed}</div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.completed / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=draft"
                className={`status-tile ${tripStatus === "draft" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--neutral" />
                  <span className="status-tile-name">Draft</span>
                </div>
                <div className="status-tile-count">{metrics.tripsByStatus.draft}</div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.draft / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=changes_requested"
                className={`status-tile ${tripStatus === "changes_requested" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--warning" />
                  <span className="status-tile-name">Changes Req.</span>
                </div>
                <div className="status-tile-count">
                  {metrics.tripsByStatus.changes_requested}
                </div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.changes_requested / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>

              <Link
                href="/dashboard?tripStatus=rejected"
                className={`status-tile ${tripStatus === "rejected" ? "status-tile--active" : ""}`}
              >
                <div className="status-tile-header">
                  <span className="status-tile-dot status-tile-dot--danger" />
                  <span className="status-tile-name">Rejected</span>
                </div>
                <div className="status-tile-count">{metrics.tripsByStatus.rejected}</div>
                <span className="status-tile-pct">
                  {totalTrips > 0
                    ? `${Math.round((metrics.tripsByStatus.rejected / totalTrips) * 100)}%`
                    : "0%"}
                </span>
              </Link>
            </div>
          </section>

          {/* Database-Driven Manager Operations Telemetry */}
          <ManagerDashboardClient
            pendingApprovals={pendingApprovals}
            inProgressTrips={inProgressTrips}
            recentVisits={recentVisits}
            timelineEvents={recentAuditEvents}
            activeOrgId={activeOrgId}
          />

          {/* Filter and CSV Export Section */}
          <section className="card" aria-labelledby="dashboard-filters-heading">
            <div className="card-header">
              <div>
                <h2 id="dashboard-filters-heading" className="card-title">
                  Filter Authorized Results &amp; Export CSV
                </h2>
                <p className="card-meta">
                  {metrics.timezoneBoundaryNote} Reference Date (UTC):{" "}
                  <code>{metrics.referenceDateUtc}</code>
                </p>
              </div>
              {exportHref ? (
                <a href={exportHref} className="btn btn-secondary">
                  Export Filtered Result Set (CSV)
                </a>
              ) : null}
            </div>

            <form
              method="get"
              action="/dashboard"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                marginTop: "0.5rem",
              }}
            >
              <div className="card-grid">
                <div className="form-group">
                  <label htmlFor="filter-start-from" className="form-label">
                    Trip Start Date From (UTC)
                  </label>
                  <input
                    id="filter-start-from"
                    name="startDateFrom"
                    type="date"
                    defaultValue={startDateFrom ?? ""}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="filter-start-to" className="form-label">
                    Trip Start Date To (UTC)
                  </label>
                  <input
                    id="filter-start-to"
                    name="startDateTo"
                    type="date"
                    defaultValue={startDateTo ?? ""}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="filter-trip-status" className="form-label">
                    Trip Status
                  </label>
                  <select
                    id="filter-trip-status"
                    name="tripStatus"
                    defaultValue={tripStatus ?? ""}
                    className="form-select"
                  >
                    <option value="">All Trip Statuses</option>
                    <option value="submitted">Submitted (Awaiting Approval)</option>
                    <option value="approved">Approved</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="changes_requested">Changes Requested</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="filter-visit-status" className="form-label">
                    Visit Status
                  </label>
                  <select
                    id="filter-visit-status"
                    name="visitStatus"
                    defaultValue={visitStatus ?? ""}
                    className="form-select"
                  >
                    <option value="">All Visit Statuses</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="submitted">Submitted (Checked Out)</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-default)",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    minHeight: "var(--touch-target-min)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    name="onlyExceptions"
                    value="true"
                    defaultChecked={onlyExceptions === "true"}
                  />
                  <span>Show only records requiring attention / exceptions</span>
                </label>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button type="submit" className="btn btn-primary">
                    Apply Filters
                  </button>
                  <Link href="/dashboard" className="btn btn-secondary">
                    Clear Filters
                  </Link>
                </div>
              </div>
            </form>
          </section>

          {/* Planned vs Actual Stop Execution Table */}
          <section className="card" aria-labelledby="planned-vs-actual-heading">
            <div className="card-header">
              <div>
                <h2 id="planned-vs-actual-heading" className="card-title">
                  Planned vs Actual Trip Stop Execution ({items.length})
                </h2>
                <p className="card-meta">
                  Location is displayed strictly as a point-in-time check-in/out record,
                  not live tracking. Device coordinates are unverified device-reported
                  values.
                </p>
              </div>
              <span className="badge-info">Server-verified check-in/out records</span>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="No matching trip or visit records"
                description="No authorized records in your active organization match the selected filters."
                actionLabel="View Field Trips"
                actionHref="/trips"
              />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Trip</th>
                      <th scope="col">Stop</th>
                      <th scope="col">Store / Territory</th>
                      <th scope="col">Planned At (UTC)</th>
                      <th scope="col">Check-In / Out</th>
                      <th scope="col">Checklist</th>
                      <th scope="col">Evidence</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.tripStopId}
                        className={row.requiresAttention ? "is-attention" : undefined}
                      >
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "0.875rem" }}>
                              {row.tripTitle}
                            </strong>
                            <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                              Rep: {row.ownerUserId}
                            </span>
                          </div>
                        </td>
                        <td>Stop #{row.sequenceNumber}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{row.storeName}</span>
                            <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                              {row.storeRegion}
                            </span>
                          </div>
                        </td>
                        <td>{row.plannedAt}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              fontSize: "0.75rem",
                            }}
                          >
                            <span>In: {row.checkedInAt ?? "—"}</span>
                            <span>Out: {row.checkedOutAt ?? "—"}</span>
                          </div>
                        </td>
                        <td>
                          {row.requiredChecklistCompletedCount} /{" "}
                          {row.requiredChecklistTotalCount}
                          {row.flaggedChecklistCount > 0 ? (
                            <span
                              style={{
                                color: "var(--status-danger)",
                                marginLeft: "0.25rem",
                                fontWeight: 700,
                              }}
                            >
                              ({row.flaggedChecklistCount} flagged)
                            </span>
                          ) : null}
                        </td>
                        <td>{row.evidenceCount} photos</td>
                        <td>
                          <span
                            className={
                              row.requiresAttention
                                ? "status-badge status-badge--danger"
                                : "status-badge status-badge--info"
                            }
                          >
                            {row.actualVisitStatus ?? row.plannedStopStatus}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/trips/${row.tripId}`}
                            className="btn btn-sm btn-secondary"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                          >
                            Trip →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {nextCursor ? (
              <div style={{ padding: "1rem 0 0", textAlign: "center" }}>
                <Link
                  href={`/dashboard?cursor=${encodeURIComponent(nextCursor)}`}
                  className="btn btn-secondary"
                >
                  Load Next Page
                </Link>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
