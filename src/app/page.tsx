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

interface HomePageProps {
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

export default async function HomePage(props: HomePageProps): Promise<ReactNode> {
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

      const tripsRepository = new SupabaseTripsRepository(supabase);
      const visitsRepository = new SupabaseVisitsRepository(supabase);
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
      accessNote =
        "You are signed in with a field_employee role. Organization-wide dashboard aggregates and CSV export require an active manager or admin membership.";
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
      <section aria-labelledby="overview-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="overview-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Manager Field Operations Dashboard — {activeOrg.name}
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Operational metrics computed from committed database state. All check-ins
              and evidence strictly isolated per tenant.
            </p>
          </div>
        </div>
      </section>

      {dashboardError ? (
        <ErrorState
          title="Dashboard operational data unavailable"
          message={dashboardError}
        />
      ) : null}

      {accessNote ? (
        <div
          role="note"
          className="card"
          style={{ padding: "0.875rem 1rem", fontSize: "0.875rem" }}
        >
          <strong>Role Scope Notice:</strong> {accessNote}
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <section className="card-grid" aria-label="Documented operational metrics summary">
        <article className="card" style={{ borderTop: "3px solid var(--brand-accent)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.tripsAwaitingApproval.label}
            </h2>
            <Link href="/approvals" style={{ textDecoration: "none" }}>
              <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
            </Link>
          </div>
          <p
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: "0.25rem 0",
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {metrics.tripsAwaitingApproval}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.25rem",
            }}
          >
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong>{" "}
              {metrics.definitions.tripsAwaitingApproval.formulaSummary}
            </p>
            <Link
              href="/approvals"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Review →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid var(--brand-primary)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.approvedTrips.label}
            </h2>
            <Link href="/?tripStatus=approved" style={{ textDecoration: "none" }}>
              <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
            </Link>
          </div>
          <p
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: "0.25rem 0",
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {metrics.approvedTrips}
          </p>
          <p className="card-meta" style={{ margin: "0 0 0.25rem", fontSize: "0.75rem" }}>
            Not Started: {metrics.approvedTripsBreakdown.approvedNotStarted} • In
            Progress: {metrics.approvedTripsBreakdown.inProgress} • Completed:{" "}
            {metrics.approvedTripsBreakdown.completedAllStopsCheckedOut}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong>{" "}
              {metrics.definitions.approvedTrips.completionRuleNote}
            </p>
            <Link
              href="/?tripStatus=approved"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Filter →
            </Link>
          </div>
        </article>

        <article
          className="card"
          style={{ borderTop: "3px solid var(--status-success)" }}
        >
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.completedVisits.label}
            </h2>
            <Link href="/?visitStatus=submitted" style={{ textDecoration: "none" }}>
              <StatusBadge descriptor={getApprovalStatusDescriptor("completed")} />
            </Link>
          </div>
          <p
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: "0.25rem 0",
              fontFamily: "var(--font-heading)",
              color: "var(--status-success)",
            }}
          >
            {metrics.completedVisits}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.completedVisits.formulaSummary}
            </p>
            <Link
              href="/?visitStatus=submitted"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Filter →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid #3B82F6" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.pendingVisits.label}
            </h2>
            <Link href="/?visitStatus=in_progress" style={{ textDecoration: "none" }}>
              <StatusBadge descriptor={getApprovalStatusDescriptor("in_progress")} />
            </Link>
          </div>
          <p
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: "0.25rem 0",
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {metrics.pendingVisits}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.pendingVisits.formulaSummary}
            </p>
            <Link
              href="/?visitStatus=in_progress"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Filter →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid var(--status-danger)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.exceptionsRequiringAttention.label}
            </h2>
            <Link href="/?onlyExceptions=true" style={{ textDecoration: "none" }}>
              <StatusBadge
                descriptor={getApprovalStatusDescriptor("changes_requested")}
              />
            </Link>
          </div>
          <p
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: "0.25rem 0",
              fontFamily: "var(--font-heading)",
              color: "var(--status-danger)",
            }}
          >
            {metrics.exceptionsRequiringAttention}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong>{" "}
              {metrics.definitions.exceptionsRequiringAttention.formulaSummary}
            </p>
            <Link
              href="/?onlyExceptions=true"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Exceptions →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid var(--border-strong)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              Trips by Status
            </h2>
            <Link
              href="/reports"
              className="btn btn-sm btn-outline"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            >
              Reports →
            </Link>
          </div>
          <p className="card-meta" style={{ margin: "0.25rem 0", fontSize: "0.75rem" }}>
            Lifecycle distribution for active scope.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.375rem",
              marginTop: "0.25rem",
              fontSize: "0.8125rem",
            }}
          >
            <span className="card-meta">
              Submitted: <strong>{metrics.tripsByStatus.submitted}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
              Approved: <strong>{metrics.tripsByStatus.approved}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
              In Progress: <strong>{metrics.tripsByStatus.in_progress}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
              Completed: <strong>{metrics.tripsByStatus.completed}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
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
          action="/"
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
              <Link href="/" className="btn btn-secondary">
                Clear Filters
              </Link>
            </div>
          </div>
        </form>
      </section>

      {/* Planned vs Actual Stop Execution Table */}
      <section className="card" aria-labelledby="planned-vs-actual-heading">
        <div className="card-header">
          <h2 id="planned-vs-actual-heading" className="card-title">
            Planned vs Actual Trip Stop Execution ({items.length})
          </h2>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Server-verified check-in/out records
          </span>
        </div>
        <p className="card-meta" style={{ margin: "0 0 0.75rem" }}>
          Location is displayed strictly as a point-in-time check-in/out record, not live
          tracking. Device coordinates are unverified device-reported values.
        </p>

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
                    style={{
                      background: row.requiresAttention
                        ? "rgba(239, 68, 68, 0.04)"
                        : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong style={{ fontSize: "0.875rem" }}>{row.tripTitle}</strong>
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
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          padding: "0.125rem 0.5rem",
                          borderRadius: "var(--radius-full)",
                          background: row.requiresAttention
                            ? "var(--status-danger-bg)"
                            : "var(--status-info-bg)",
                          color: row.requiresAttention
                            ? "var(--status-danger-text)"
                            : "var(--brand-primary)",
                        }}
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
              href={`/?cursor=${encodeURIComponent(nextCursor)}`}
              className="btn btn-secondary"
            >
              Load Next Page
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
