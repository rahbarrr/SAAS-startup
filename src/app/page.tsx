import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import {
  getApprovalStatusDescriptor,
  getSyncStatusDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import {
  DASHBOARD_METRIC_DEFINITIONS,
  type DashboardMetricsSummary,
  type PlannedVsActualStopRow,
} from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getManagerDashboardForOrg } from "@/modules/reporting/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

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
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let metrics: DashboardMetricsSummary = buildEmptyMetricsSummary(referenceDateUtc);
  let items: PlannedVsActualStopRow[] = [];
  let nextCursor: string | null = null;
  let accessNote: string | null = null;
  let dashboardError: string | null = null;

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
        const role = workspace.activeOrganization.membership.role;

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
        } else {
          accessNote =
            "You are signed in with a field_employee role. Organization-wide dashboard aggregates and CSV export require an active manager or admin membership.";
        }
      }
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

  const exportHref = activeOrgId
    ? `/api/orgs/${activeOrgId}/dashboard/export${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="overview-heading">
        <div className="card-header">
          <div>
            <h1
              id="overview-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              Manager Field Operations Dashboard
              {activeOrgName ? ` — ${activeOrgName}` : ""}
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Authoritative organization metrics computed from committed database state.
              Status freshness updates never bypass server-side tenant authorization.
            </p>
          </div>
          <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
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

      <section className="card-grid" aria-label="Documented operational metrics summary">
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">
              {metrics.definitions.tripsAwaitingApproval.label}
            </h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
          </div>
          <p style={{ fontSize: "1.875rem", fontWeight: 700, margin: "0.25rem 0" }}>
            {metrics.tripsAwaitingApproval}
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            <strong>Definition:</strong>{" "}
            {metrics.definitions.tripsAwaitingApproval.formulaSummary}
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">{metrics.definitions.approvedTrips.label}</h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
          </div>
          <p style={{ fontSize: "1.875rem", fontWeight: 700, margin: "0.25rem 0" }}>
            {metrics.approvedTrips}
          </p>
          <p className="card-meta" style={{ margin: "0 0 0.25rem" }}>
            Not Started: {metrics.approvedTripsBreakdown.approvedNotStarted} • In
            Progress: {metrics.approvedTripsBreakdown.inProgress} • Completed (All Stops
            Checked Out): {metrics.approvedTripsBreakdown.completedAllStopsCheckedOut}
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            <strong>Completion Rule:</strong>{" "}
            {metrics.definitions.approvedTrips.completionRuleNote}
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">{metrics.definitions.completedVisits.label}</h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("completed")} />
          </div>
          <p style={{ fontSize: "1.875rem", fontWeight: 700, margin: "0.25rem 0" }}>
            {metrics.completedVisits}
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            <strong>Definition:</strong>{" "}
            {metrics.definitions.completedVisits.formulaSummary}
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">{metrics.definitions.pendingVisits.label}</h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("in_progress")} />
          </div>
          <p style={{ fontSize: "1.875rem", fontWeight: 700, margin: "0.25rem 0" }}>
            {metrics.pendingVisits}
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            <strong>Definition:</strong>{" "}
            {metrics.definitions.pendingVisits.formulaSummary}
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">
              {metrics.definitions.exceptionsRequiringAttention.label}
            </h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("changes_requested")} />
          </div>
          <p style={{ fontSize: "1.875rem", fontWeight: 700, margin: "0.25rem 0" }}>
            {metrics.exceptionsRequiringAttention}
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            <strong>Definition:</strong>{" "}
            {metrics.definitions.exceptionsRequiringAttention.formulaSummary}
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Trips by Status</h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
          </div>
          <p className="card-meta" style={{ margin: "0.25rem 0" }}>
            Operational count across all lifecycle states for the active scope.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "0.5rem",
              fontSize: "0.875rem",
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
              Changes Requested:{" "}
              <strong>{metrics.tripsByStatus.changes_requested}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
              Rejected: <strong>{metrics.tripsByStatus.rejected}</strong>
            </span>
            <span className="card-meta">•</span>
            <span className="card-meta">
              Draft: <strong>{metrics.tripsByStatus.draft}</strong>
            </span>
          </div>
        </article>
      </section>

      <section className="card" aria-labelledby="dashboard-filters-heading">
        <div className="card-header">
          <h2 id="dashboard-filters-heading" className="card-title">
            Filter Authorized Results &amp; Export CSV
          </h2>
          {exportHref ? (
            <a href={exportHref} className="btn btn-secondary">
              Export Filtered Result Set (CSV)
            </a>
          ) : null}
        </div>
        <p className="card-meta" style={{ margin: "0 0 0.75rem" }}>
          {metrics.timezoneBoundaryNote} Reference Date (UTC):{" "}
          <code>{metrics.referenceDateUtc}</code>
        </p>

        <form
          method="get"
          action="/"
          style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
        >
          <div className="card-grid">
            <div>
              <label
                htmlFor="filter-start-from"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Trip Start Date From (UTC)
              </label>
              <input
                id="filter-start-from"
                name="startDateFrom"
                type="date"
                defaultValue={startDateFrom ?? ""}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="filter-start-to"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Trip Start Date To (UTC)
              </label>
              <input
                id="filter-start-to"
                name="startDateTo"
                type="date"
                defaultValue={startDateTo ?? ""}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="filter-trip-status"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Trip Status
              </label>
              <select
                id="filter-trip-status"
                name="tripStatus"
                defaultValue={tripStatus ?? ""}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg-surface)",
                }}
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

            <div>
              <label
                htmlFor="filter-visit-status"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Visit Status
              </label>
              <select
                id="filter-visit-status"
                name="visitStatus"
                defaultValue={visitStatus ?? ""}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <option value="">All Visit Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted (Checked Out)</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-employee-id"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Employee UUID Filter
              </label>
              <input
                id="filter-employee-id"
                name="employeeUserId"
                type="text"
                defaultValue={employeeUserId ?? ""}
                placeholder="Optional employee UUID"
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="filter-store-id"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Store UUID Filter
              </label>
              <input
                id="filter-store-id"
                name="storeId"
                type="text"
                defaultValue={storeId ?? ""}
                placeholder="Optional store UUID"
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                minHeight: "var(--touch-target-min)",
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

      <section className="card" aria-labelledby="planned-vs-actual-heading">
        <div className="card-header">
          <h2 id="planned-vs-actual-heading" className="card-title">
            Planned vs Actual Trip Stop Execution ({items.length})
          </h2>
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
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {items.map((row) => (
              <li
                key={row.tripStopId}
                style={{
                  padding: "0.875rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle, #cbd5e1)",
                }}
              >
                <div className="card-header">
                  <strong>
                    {row.tripTitle} — Stop #{row.sequenceNumber}: {row.storeName} (
                    {row.storeRegion})
                  </strong>
                  <StatusBadge descriptor={getApprovalStatusDescriptor(row.tripStatus)} />
                </div>
                <p className="card-meta" style={{ margin: "0.25rem 0" }}>
                  Planned Dates (UTC): {row.tripStartDate} to {row.tripEndDate} • Field
                  Rep: <code>{row.ownerUserId}</code> • Planned Stop Status:{" "}
                  <code>{row.plannedStopStatus}</code> • Actual Visit Status:{" "}
                  <code>{row.actualVisitStatus}</code>
                </p>
                <p className="card-meta" style={{ margin: "0.25rem 0" }}>
                  Check-In (UTC): {row.checkedInAt ?? "—"} (
                  {row.checkInLocation?.status ?? "none"}) • Check-Out (UTC):{" "}
                  {row.checkedOutAt ?? "—"} ({row.checkOutLocation?.status ?? "none"})
                </p>
                <p className="card-meta" style={{ margin: "0.25rem 0" }}>
                  Required Checklist: {row.requiredChecklistCompletedCount}/
                  {row.requiredChecklistTotalCount} • Flagged Items:{" "}
                  {row.flaggedChecklistCount} • Evidence Files: {row.evidenceCount}
                </p>
                {row.requiresAttention ? (
                  <p
                    style={{
                      margin: "0.25rem 0",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    Attention Required: {row.attentionReasons.join(" | ")}
                  </p>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <Link href={`/trips/${row.tripId}`} className="btn btn-secondary">
                    Open Trip Detail
                  </Link>
                  {row.actualVisitId ? (
                    <Link
                      href={`/visits/${row.actualVisitId}`}
                      className="btn btn-secondary"
                    >
                      Open Visit Detail
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor ? (
          <div style={{ marginTop: "1rem" }}>
            <Link
              href={`/?${new URLSearchParams({
                ...(startDateFrom ? { startDateFrom } : {}),
                ...(startDateTo ? { startDateTo } : {}),
                ...(employeeUserId ? { employeeUserId } : {}),
                ...(tripStatus ? { tripStatus } : {}),
                ...(visitStatus ? { visitStatus } : {}),
                ...(storeId ? { storeId } : {}),
                ...(onlyExceptions ? { onlyExceptions } : {}),
                cursor: nextCursor,
              }).toString()}`}
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
