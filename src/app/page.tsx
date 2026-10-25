import Link from "next/link";
import type { ReactNode } from "react";
import { ManagerDashboardClient } from "@/components/dashboard/ManagerDashboardClient";
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

const DEMO_PLANNED_VS_ACTUAL_ROWS: PlannedVsActualStopRow[] = [
  {
    tripId: "trip-01",
    tripTitle: "Q4 FMCG Shelf Audit & Endcap Compliance Route",
    tripStatus: "in_progress",
    tripStartDate: "2026-10-25",
    tripEndDate: "2026-10-26",
    ownerUserId: "Elena Rostova (Senior Rep)",
    tripStopId: "stop-01",
    sequenceNumber: 1,
    storeId: "store-01",
    storeName: "Metro Hypermarket — Downtown Central",
    storeRegion: "Sector 4",
    plannedAt: "2026-10-25 09:00:00",
    plannedStopStatus: "visited",
    actualVisitId: "visit-01",
    actualVisitStatus: "reviewed",
    checkedInAt: "2026-10-25 09:04 UTC",
    checkedOutAt: "2026-10-25 10:22 UTC",
    checkInLocation: {
      status: "captured_unverified",
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 8.4,
      verificationNotice: "unverified_device_reported",
      limitationExplanation: null,
    },
    checkOutLocation: {
      status: "captured_unverified",
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 8.4,
      verificationNotice: "unverified_device_reported",
      limitationExplanation: null,
    },
    requiredChecklistCompletedCount: 4,
    requiredChecklistTotalCount: 4,
    flaggedChecklistCount: 0,
    evidenceCount: 2,
    visitNotes: "Display verified on Aisle 3. 100% compliance score.",
    requiresAttention: false,
    attentionReasons: [],
  },
  {
    tripId: "trip-01",
    tripTitle: "Q4 FMCG Shelf Audit & Endcap Compliance Route",
    tripStatus: "in_progress",
    tripStartDate: "2026-10-25",
    tripEndDate: "2026-10-26",
    ownerUserId: "Elena Rostova (Senior Rep)",
    tripStopId: "stop-02",
    sequenceNumber: 2,
    storeId: "store-06",
    storeName: "Kroger Fresh Fare — Uptown Crossing",
    storeRegion: "Downtown Central",
    plannedAt: "2026-10-25 11:30:00",
    plannedStopStatus: "visited",
    actualVisitId: "visit-02",
    actualVisitStatus: "submitted",
    checkedInAt: "2026-10-25 11:35 UTC",
    checkedOutAt: "2026-10-25 12:45 UTC",
    checkInLocation: {
      status: "captured_unverified",
      latitude: 37.7885,
      longitude: -122.4075,
      accuracyMeters: 11.2,
      verificationNotice: "unverified_device_reported",
      limitationExplanation: null,
    },
    checkOutLocation: {
      status: "captured_unverified",
      latitude: 37.7885,
      longitude: -122.4075,
      accuracyMeters: 11.2,
      verificationNotice: "unverified_device_reported",
      limitationExplanation: null,
    },
    requiredChecklistCompletedCount: 3,
    requiredChecklistTotalCount: 4,
    flaggedChecklistCount: 1,
    evidenceCount: 1,
    visitNotes: "Out-of-stock tags missing for SKU-491. Exception flagged.",
    requiresAttention: true,
    attentionReasons: ["Stockout on SKU-491 (Sparkling Peach 12oz)"],
  },
  {
    tripId: "trip-01",
    tripTitle: "Q4 FMCG Shelf Audit & Endcap Compliance Route",
    tripStatus: "in_progress",
    tripStartDate: "2026-10-25",
    tripEndDate: "2026-10-26",
    ownerUserId: "Elena Rostova (Senior Rep)",
    tripStopId: "stop-03",
    sequenceNumber: 3,
    storeId: "store-05",
    storeName: "Costco Wholesale — South Industrial Terminal",
    storeRegion: "South Industrial",
    plannedAt: "2026-10-25 14:30:00",
    plannedStopStatus: "planned",
    actualVisitId: "visit-03",
    actualVisitStatus: "in_progress",
    checkedInAt: null,
    checkedOutAt: null,
    checkInLocation: null,
    checkOutLocation: null,
    requiredChecklistCompletedCount: 0,
    requiredChecklistTotalCount: 3,
    flaggedChecklistCount: 0,
    evidenceCount: 0,
    visitNotes: "En route. Scheduled for afternoon arrival.",
    requiresAttention: false,
    attentionReasons: [],
  },
  {
    tripId: "trip-02",
    tripTitle: "North Bay Plaza Display Refresh & Stock Count",
    tripStatus: "submitted",
    tripStartDate: "2026-10-26",
    tripEndDate: "2026-10-26",
    ownerUserId: "David Chen (Territory Merchandiser)",
    tripStopId: "stop-04",
    sequenceNumber: 1,
    storeId: "store-02",
    storeName: "Target Express — North Bay Plaza",
    storeRegion: "North Bay Plaza",
    plannedAt: "2026-10-26 10:00:00",
    plannedStopStatus: "planned",
    actualVisitId: null,
    actualVisitStatus: "not_started",
    checkedInAt: null,
    checkedOutAt: null,
    checkInLocation: null,
    checkOutLocation: null,
    requiredChecklistCompletedCount: 0,
    requiredChecklistTotalCount: 2,
    flaggedChecklistCount: 0,
    evidenceCount: 0,
    visitNotes: "",
    requiresAttention: false,
    attentionReasons: [],
  },
];

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
  let isDemoData = false;

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

  // Graceful fallback to enterprise demo data when unauthenticated or in preview mode
  if (!activeOrgId && !dashboardError) {
    isDemoData = true;
    activeOrgName = "Apex Retail Solutions Ltd (Interactive Demo)";
    metrics.tripsAwaitingApproval = 3;
    metrics.approvedTrips = 14;
    metrics.approvedTripsBreakdown = {
      approvedNotStarted: 6,
      inProgress: 4,
      completedAllStopsCheckedOut: 4,
    };
    metrics.tripsByStatus = {
      draft: 2,
      submitted: 3,
      approved: 14,
      in_progress: 4,
      completed: 18,
      changes_requested: 2,
      rejected: 1,
    };
    metrics.completedVisits = 38;
    metrics.pendingVisits = 6;
    metrics.exceptionsRequiringAttention = 2;

    items = onlyExceptions === "true"
      ? DEMO_PLANNED_VS_ACTUAL_ROWS.filter((r) => r.requiresAttention)
      : DEMO_PLANNED_VS_ACTUAL_ROWS;
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
    : "/reports";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header Section */}
      <section aria-labelledby="overview-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="overview-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.625rem", fontFamily: "var(--font-heading)", color: "var(--brand-dark)" }}
            >
              Manager Field Operations Dashboard
              {activeOrgName ? ` — ${activeOrgName}` : ""}
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Operational metrics computed from committed database state. All check-ins and evidence strictly isolated per tenant.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {isDemoData ? (
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
            <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
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
          <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.25rem 0", fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {metrics.tripsAwaitingApproval}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.tripsAwaitingApproval.formulaSummary}
            </p>
            <Link href="/approvals" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}>
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
          <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.25rem 0", fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {metrics.approvedTrips}
          </p>
          <p className="card-meta" style={{ margin: "0 0 0.25rem", fontSize: "0.75rem" }}>
            Not Started: {metrics.approvedTripsBreakdown.approvedNotStarted} • In Progress: {metrics.approvedTripsBreakdown.inProgress} • Completed: {metrics.approvedTripsBreakdown.completedAllStopsCheckedOut}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.approvedTrips.completionRuleNote}
            </p>
            <Link href="/?tripStatus=approved" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}>
              Filter →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid var(--status-success)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>
              {metrics.definitions.completedVisits.label}
            </h2>
            <Link href="/?visitStatus=submitted" style={{ textDecoration: "none" }}>
              <StatusBadge descriptor={getApprovalStatusDescriptor("completed")} />
            </Link>
          </div>
          <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.25rem 0", fontFamily: "var(--font-heading)", color: "var(--status-success)" }}>
            {metrics.completedVisits}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.completedVisits.formulaSummary}
            </p>
            <Link href="/?visitStatus=submitted" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}>
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
          <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.25rem 0", fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {metrics.pendingVisits}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.pendingVisits.formulaSummary}
            </p>
            <Link href="/?visitStatus=in_progress" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}>
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
              <StatusBadge descriptor={getApprovalStatusDescriptor("changes_requested")} />
            </Link>
          </div>
          <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.25rem 0", fontFamily: "var(--font-heading)", color: "var(--status-danger)" }}>
            {metrics.exceptionsRequiringAttention}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
              <strong>Rule:</strong> {metrics.definitions.exceptionsRequiringAttention.formulaSummary}
            </p>
            <Link href="/?onlyExceptions=true" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", flexShrink: 0 }}>
              Exceptions →
            </Link>
          </div>
        </article>

        <article className="card" style={{ borderTop: "3px solid var(--border-strong)" }}>
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "0.9375rem" }}>Trips by Status</h2>
            <Link href="/reports" className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
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
            <span className="card-meta">Submitted: <strong>{metrics.tripsByStatus.submitted}</strong></span>
            <span className="card-meta">•</span>
            <span className="card-meta">Approved: <strong>{metrics.tripsByStatus.approved}</strong></span>
            <span className="card-meta">•</span>
            <span className="card-meta">In Progress: <strong>{metrics.tripsByStatus.in_progress}</strong></span>
            <span className="card-meta">•</span>
            <span className="card-meta">Completed: <strong>{metrics.tripsByStatus.completed}</strong></span>
            <span className="card-meta">•</span>
            <span className="card-meta">Draft: <strong>{metrics.tripsByStatus.draft}</strong></span>
          </div>
        </article>
      </section>

      {/* Interactive Manager Dashboard Client (Active Itineraries, Approvals Queue, Store Feed & Timeline) */}
      <ManagerDashboardClient isDemoData={isDemoData} />

      {/* Filter and CSV Export Section */}
      <section className="card" aria-labelledby="dashboard-filters-heading">
        <div className="card-header">
          <div>
            <h2 id="dashboard-filters-heading" className="card-title">
              Filter Authorized Results &amp; Export CSV
            </h2>
            <p className="card-meta">
              {metrics.timezoneBoundaryNote} Reference Date (UTC): <code>{metrics.referenceDateUtc}</code>
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
          style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}
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
          Location is displayed strictly as a point-in-time check-in/out record, not live tracking. Device coordinates are unverified device-reported values.
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
                  <th>Trip &amp; Stop</th>
                  <th>Trip Status</th>
                  <th>Dates (UTC)</th>
                  <th>Representative</th>
                  <th>Check-In (UTC)</th>
                  <th>Check-Out (UTC)</th>
                  <th>Checklist</th>
                  <th>Evidence</th>
                  <th>Status / Flag</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.tripStopId}>
                    <td>
                      <div>
                        <strong>Stop #{row.sequenceNumber}: {row.storeName}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.tripTitle}</div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge descriptor={getApprovalStatusDescriptor(row.tripStatus)} />
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>
                      {row.tripStartDate} to {row.tripEndDate}
                    </td>
                    <td style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                      {row.ownerUserId}
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>
                      {row.checkedInAt ?? "—"}
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>
                      {row.checkedOutAt ?? "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: row.requiredChecklistCompletedCount === row.requiredChecklistTotalCount ? "var(--status-success)" : "var(--text-secondary)",
                        }}
                      >
                        {row.requiredChecklistCompletedCount}/{row.requiredChecklistTotalCount}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem" }}>{row.evidenceCount} files</span>
                    </td>
                    <td>
                      {row.requiresAttention ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--status-danger)",
                            background: "var(--status-danger-bg)",
                            padding: "0.125rem 0.375rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--status-danger-border)",
                          }}
                        >
                          Attention
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--status-success)",
                            fontWeight: 600,
                          }}
                        >
                          Normal
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <Link href={`/trips/${row.tripId}`} className="btn btn-sm btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
                          Trip
                        </Link>
                        {row.actualVisitId ? (
                          <Link href={`/visits/${row.actualVisitId}`} className="btn btn-sm btn-outline" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
                            Visit
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
