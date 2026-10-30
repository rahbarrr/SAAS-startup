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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header Section */}
      <section className="page-header" aria-labelledby="overview-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Workspace Telemetry</p>
          <h1 id="overview-heading" className="page-title">
            {role === "field_employee"
              ? `My Field Operations — ${activeOrg.name}`
              : `Operations Dashboard — ${activeOrg.name}`}
          </h1>
          <p className="page-subtitle">
            Operational metrics computed from committed database state. All check-ins and
            evidence strictly isolated per tenant.
          </p>
        </div>

        <div className="page-actions">
          <Link href="/trips/new" className="btn btn-primary">
            + Plan New Trip
          </Link>
          {role === "manager" || role === "admin" ? (
            <a href={exportHref} className="btn btn-secondary">
              Export CSV
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
                  🗺️
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
                  📍
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
                  🏢
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
          {/* KPI Cards Grid */}
          <section
            className="kpi-grid"
            aria-label="Documented operational metrics summary"
          >
            <article className="kpi-card kpi-card--warning">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  ⏳
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
                  ✓
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
                  📍
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
                  🕒
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
                  ⚠️
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

            <article className="kpi-card kpi-card--neutral">
              <div className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">
                  📊
                </span>
                <Link
                  href="/reports"
                  className="btn btn-sm btn-outline kpi-action-btn"
                  style={{ minHeight: "auto", padding: "0.2rem 0.5rem" }}
                >
                  Reports →
                </Link>
              </div>
              <h2 className="kpi-label">Trips by Status</h2>
              <p className="kpi-subtitle">Lifecycle distribution for active scope</p>
              <div className="kpi-status-chips">
                <span className="status-chip">
                  Submitted: <strong>{metrics.tripsByStatus.submitted}</strong>
                </span>
                <span className="status-chip">
                  Approved: <strong>{metrics.tripsByStatus.approved}</strong>
                </span>
                <span className="status-chip">
                  Active: <strong>{metrics.tripsByStatus.in_progress}</strong>
                </span>
                <span className="status-chip">
                  Done: <strong>{metrics.tripsByStatus.completed}</strong>
                </span>
                <span className="status-chip">
                  Draft: <strong>{metrics.tripsByStatus.draft}</strong>
                </span>
              </div>
            </article>
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
