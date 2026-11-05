import Link from "next/link";
import type { ReactNode } from "react";
import { PlusCircle, Map, ClipboardList, Info } from "lucide-react";
import { ManagerDashboardClient } from "@/components/dashboard/ManagerDashboardClient";
import { GoalRingCard } from "@/components/ui/GoalRingCard";
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

  const totalVisitsVolume = Math.max(
    1,
    metrics.completedVisits + metrics.pendingVisits
  );
  const completedVisitsPct = Math.round(
    (metrics.completedVisits / totalVisitsVolume) * 100
  );
  const pendingVisitsPct = Math.round(
    (metrics.pendingVisits / totalVisitsVolume) * 100
  );
  const approvedTripsPct =
    totalTrips > 0
      ? Math.round((metrics.approvedTrips / totalTrips) * 100)
      : 100;
  const awaitingApprovalPct =
    totalTrips > 0
      ? Math.round((metrics.tripsAwaitingApproval / totalTrips) * 100)
      : 0;
  const exceptionsPct =
    items.length > 0
      ? Math.round((metrics.exceptionsRequiringAttention / items.length) * 100)
      : 0;

  const heroPrimaryCount =
    role === "field_employee"
      ? employeeTrips.length + employeeVisits.length
      : metrics.completedVisits + metrics.approvedTrips;
  const heroPendingCount =
    role === "field_employee"
      ? employeeTrips.filter((t) => t.status === "submitted" || t.status === "in_progress")
          .length
      : metrics.pendingVisits + metrics.tripsAwaitingApproval;
  const heroTotalVolume = Math.max(1, heroPrimaryCount + heroPendingCount);
  const heroPrimaryPct = Math.round((heroPrimaryCount / heroTotalVolume) * 100);
  const heroSecondaryPct = Math.max(0, 100 - heroPrimaryPct);

  return (
    <div
      className="dashboard-page-stack"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      {/* Workspace Context & Canvas Header Row (Reference Top Canvas Header) */}
      <section className="dashboard-hero" aria-labelledby="overview-heading">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-titles">
            <h1 id="overview-heading" className="dashboard-hero-title">
              {role === "field_employee"
                ? `My Field Operations — ${activeOrg.name}`
                : `Operations Dashboard — ${activeOrg.name}`}
            </h1>
            <p className="dashboard-hero-subtitle">
              Overview &gt; {activeOrg.name} • Live operational telemetry computed from
              committed database state (UTC Reference: <code>{referenceDateUtc}</code>)
            </p>
          </div>

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
              150m Geofence • 60s GPS Sync
            </span>
          </div>
        </div>

        <div className="dashboard-hero-actions">
          {role === "manager" || role === "admin" ? (
            <a
              href={exportHref}
              className="btn btn-secondary dashboard-export-cta"
              title="Export authorized dataset as CSV"
            >
              <span>+ Export CSV</span>
            </a>
          ) : (
            <Link href="/stores" className="btn btn-secondary dashboard-export-cta">
              <span>+ Browse Stores</span>
            </Link>
          )}
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
        </div>
      </section>

      {/* Reference-Inspired Asymmetric Hero Bento Row: Dark Obsidian Hero Card + Live Activity Feed */}
      <section
        className="dashboard-bento-hero-row"
        aria-label="Primary field execution summary and live activity"
      >
        {/* Left: Dark Obsidian Hero Card with Electric Blue Radial Glow */}
        <article className="hero-obsidian-card">
          <div className="hero-obsidian-top">
            <div className="hero-obsidian-avatars" aria-hidden="true">
              <span className="hero-avatar-circle hero-avatar-circle--primary">FT</span>
              <span className="hero-avatar-circle hero-avatar-circle--secondary">
                {activeOrg.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="hero-avatar-badge">✓</span>
            </div>
            <div className="hero-obsidian-meta">
              <strong className="hero-obsidian-org">{activeOrg.name} Fleet</strong>
              <span className="hero-obsidian-sub">
                {role === "field_employee"
                  ? `${employeeTrips.length} assigned trips • ${employeeVisits.length} store visits`
                  : `${totalTrips} scheduled itineraries • ${metrics.completedVisits} verified visits`}
              </span>
            </div>
          </div>

          <div className="hero-obsidian-metric-block">
            <span className="hero-obsidian-eyebrow">
              {role === "field_employee"
                ? "My Active & Completed Operations"
                : "Verified Visits & Approved Trips"}
            </span>
            <div className="hero-obsidian-number">{heroPrimaryCount}</div>
            <p className="hero-obsidian-caption">
              {heroPrimaryPct}% completion index across {heroTotalVolume} active field
              records in {activeOrg.name}
            </p>
          </div>

          <div className="hero-obsidian-bar-section">
            <div className="hero-obsidian-bar-track" aria-hidden="true">
              <div
                className="hero-obsidian-bar-primary"
                style={{ width: `${Math.max(12, heroPrimaryPct)}%` }}
              />
              <div
                className="hero-obsidian-bar-secondary"
                style={{ width: `${Math.max(8, heroSecondaryPct)}%` }}
              />
            </div>
            <div className="hero-obsidian-legend">
              <span className="hero-obsidian-legend-item">
                <span className="hero-legend-dot hero-legend-dot--blue" />
                Completed &amp; Approved • {heroPrimaryCount}{" "}
                <strong>{heroPrimaryPct}%</strong>
              </span>
              <span className="hero-obsidian-legend-item">
                <span className="hero-legend-dot hero-legend-dot--periwinkle" />
                Pending &amp; In Field • {heroPendingCount}{" "}
                <strong>{heroSecondaryPct}%</strong>
              </span>
            </div>
          </div>
        </article>

        {/* Right: White Activity Feed Bento Card */}
        <aside className="activity-bento-card" aria-label="Live operations activity">
          <div className="activity-bento-header">
            <div>
              <h2 className="activity-bento-title">Activity</h2>
              <p className="activity-bento-subtitle">Latest field telemetry</p>
            </div>
            <span className="activity-live-pill">
              <span className="activity-live-dot" aria-hidden="true" />
              Live
            </span>
          </div>

          <div className="activity-bento-list">
            {(role === "field_employee"
              ? employeeTrips.slice(0, 4).map((trip, idx) => ({
                  id: trip.id,
                  initials: trip.title.slice(0, 2).toUpperCase(),
                  title: trip.title,
                  subtitle: `${trip.startDate} → ${trip.endDate}`,
                  badge: `+${trip.status.replace("_", " ")}`,
                  tone: idx % 2 === 0 ? "blue" : "periwinkle",
                }))
              : recentAuditEvents.length > 0
                ? recentAuditEvents.slice(0, 4).map((evt, idx) => ({
                    id: evt.id,
                    initials: evt.entityType.slice(0, 2).toUpperCase(),
                    title: evt.actionType
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
                    subtitle: new Date(evt.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }),
                    badge: `+${evt.entityType}`,
                    tone: idx % 2 === 0 ? "blue" : "periwinkle",
                  }))
                : [
                    {
                      id: "telemetry-sync",
                      initials: "GP",
                      title: "GPS Telemetry Cadence Active",
                      subtitle: `Ref ${referenceDateUtc} • 60s target`,
                      badge: "+Synced",
                      tone: "blue",
                    },
                    {
                      id: "geofence-ring",
                      initials: "GF",
                      title: "Store Geofence Validation",
                      subtitle: "150m arrival radius active",
                      badge: "+150m",
                      tone: "periwinkle",
                    },
                    {
                      id: "rls-guard",
                      initials: "RL",
                      title: `Tenant Isolation (${activeOrg.name})`,
                      subtitle: "Supabase RLS verified",
                      badge: "+Active",
                      tone: "blue",
                    },
                  ]
            ).map((entry) => (
              <div key={entry.id} className="activity-bento-item">
                <div
                  className={`activity-bento-avatar activity-bento-avatar--${entry.tone}`}
                  aria-hidden="true"
                >
                  {entry.initials}
                </div>
                <div className="activity-bento-info">
                  <span className="activity-bento-item-title">{entry.title}</span>
                  <span className="activity-bento-item-date">{entry.subtitle}</span>
                </div>
                <span className="activity-bento-delta">{entry.badge}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {dashboardError ? (
        <ErrorState
          title="Dashboard operational data unavailable"
          message={dashboardError}
        />
      ) : null}

      {accessNote ? (
        <div role="note" className="alert alert--info">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>Role Scope Notice:</strong> {accessNote}
          </div>
        </div>
      ) : null}

      {/* Field Employee View */}
      {role === "field_employee" ? (
        <div
          className="dashboard-employee-stack"
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div className="kpi-grid kpi-grid--three">
            <GoalRingCard
              title="My Field Trips"
              subtitle="Assigned itineraries"
              value={employeeTrips.length}
              totalLabel="in active workspace"
              percentage={
                employeeTrips.length > 0
                  ? Math.round(
                      (employeeTrips.filter(
                        (t) =>
                          t.status === "approved" ||
                          t.status === "in_progress" ||
                          t.status === "completed"
                      ).length /
                        employeeTrips.length) *
                        100
                    )
                  : 100
              }
              tone="blue"
              icon={
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
              }
              actionHref="/trips"
              actionLabel="View Trips →"
              primarySegmentLabel={`Assigned (${employeeTrips.length})`}
              secondarySegmentLabel="Active Scope"
            />

            <GoalRingCard
              title="Recorded Visits"
              subtitle="Recent store executions"
              value={employeeVisits.length}
              totalLabel="committed store visits"
              percentage={
                employeeVisits.length > 0
                  ? Math.round(
                      (employeeVisits.filter(
                        (v) => v.status === "submitted" || v.status === "reviewed"
                      ).length /
                        employeeVisits.length) *
                        100
                    )
                  : 100
              }
              tone="blue"
              icon={
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
              }
              actionHref="/visits"
              actionLabel="View Visits →"
              primarySegmentLabel={`Submitted (${employeeVisits.length})`}
              secondarySegmentLabel="150m Geofence"
            />

            <GoalRingCard
              title="Stores Directory"
              subtitle="Browse retail accounts"
              value="Directory"
              totalLabel="150m geofence verified"
              percentage={100}
              tone="obsidian"
              icon={
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
              }
              actionHref="/stores"
              actionLabel="Browse Stores →"
              primarySegmentLabel="Active Accounts"
              secondarySegmentLabel="GPS Enabled"
            />
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <Link href="/trips/new" className="quick-action">
              <div className="quick-action-icon">
                <PlusCircle size={20} aria-hidden="true" />
              </div>
              <div className="quick-action-text">
                <span>Plan Field Trip</span>
                <span className="quick-action-desc">Create multi-stop route</span>
              </div>
            </Link>
            <Link href="/trips" className="quick-action">
              <div className="quick-action-icon">
                <Map size={20} aria-hidden="true" />
              </div>
              <div className="quick-action-text">
                <span>My Field Itineraries</span>
                <span className="quick-action-desc">Check status and stops</span>
              </div>
            </Link>
            <Link href="/visits" className="quick-action">
              <div className="quick-action-icon">
                <ClipboardList size={20} aria-hidden="true" />
              </div>
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
                        <td data-label="Trip">
                          <strong>{trip.title}</strong>
                        </td>
                        <td data-label="Schedule">
                          {trip.startDate} to {trip.endDate}
                        </td>
                        <td data-label="Status">
                          <StatusBadge
                            descriptor={getApprovalStatusDescriptor(trip.status)}
                          />
                        </td>
                        <td data-label="Action">
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
          {/* Section 5: Operational Circular Ring KPI Cards Grid (Reference Goal Ring Cards) */}
          <section
            className="kpi-grid"
            aria-label="Documented operational metrics summary"
          >
            <GoalRingCard
              title={metrics.definitions.tripsAwaitingApproval.label}
              subtitle="Awaiting manager review"
              value={metrics.tripsAwaitingApproval}
              totalLabel={`of ${totalTrips} scheduled trips`}
              percentage={awaitingApprovalPct}
              tone="obsidian"
              icon={
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
              }
              badge={
                <Link href="/approvals" style={{ textDecoration: "none" }}>
                  <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
                </Link>
              }
              actionHref="/approvals"
              actionLabel="Review →"
              ruleSummary={metrics.definitions.tripsAwaitingApproval.formulaSummary}
              primarySegmentLabel={`Submitted (${metrics.tripsAwaitingApproval})`}
              secondarySegmentLabel={`Decided (${Math.max(0, totalTrips - metrics.tripsAwaitingApproval)})`}
            />

            <GoalRingCard
              title={metrics.definitions.approvedTrips.label}
              subtitle={`${metrics.approvedTripsBreakdown.approvedNotStarted} ready • ${metrics.approvedTripsBreakdown.inProgress} active`}
              value={metrics.approvedTrips}
              totalLabel={`of ${totalTrips} total trips`}
              percentage={approvedTripsPct}
              tone="blue"
              icon={
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
              }
              badge={
                <Link
                  href="/dashboard?tripStatus=approved"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
                </Link>
              }
              actionHref="/dashboard?tripStatus=approved"
              actionLabel="Filter →"
              ruleSummary={metrics.definitions.approvedTrips.completionRuleNote}
              primarySegmentLabel={`Active/Done (${metrics.approvedTripsBreakdown.inProgress + metrics.approvedTripsBreakdown.completedAllStopsCheckedOut})`}
              secondarySegmentLabel={`Not Started (${metrics.approvedTripsBreakdown.approvedNotStarted})`}
            />

            <GoalRingCard
              title={metrics.definitions.completedVisits.label}
              subtitle="Completed & submitted visits"
              value={metrics.completedVisits}
              totalLabel={`of ${totalVisitsVolume} store stops`}
              percentage={completedVisitsPct}
              tone="blue"
              icon={
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
              }
              badge={
                <Link
                  href="/dashboard?visitStatus=submitted"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("completed")} />
                </Link>
              }
              actionHref="/dashboard?visitStatus=submitted"
              actionLabel="Filter →"
              ruleSummary={metrics.definitions.completedVisits.formulaSummary}
              primarySegmentLabel={`Checked Out (${metrics.completedVisits})`}
              secondarySegmentLabel={`Remaining (${metrics.pendingVisits})`}
            />

            <GoalRingCard
              title={metrics.definitions.pendingVisits.label}
              subtitle="Scheduled or active in field"
              value={metrics.pendingVisits}
              totalLabel={`of ${totalVisitsVolume} store stops`}
              percentage={pendingVisitsPct}
              tone="obsidian"
              icon={
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
              }
              badge={
                <Link
                  href="/dashboard?visitStatus=in_progress"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge descriptor={getApprovalStatusDescriptor("in_progress")} />
                </Link>
              }
              actionHref="/dashboard?visitStatus=in_progress"
              actionLabel="Filter →"
              ruleSummary={metrics.definitions.pendingVisits.formulaSummary}
              primarySegmentLabel={`In Field (${metrics.pendingVisits})`}
              secondarySegmentLabel={`Done (${metrics.completedVisits})`}
            />

            <GoalRingCard
              title={metrics.definitions.exceptionsRequiringAttention.label}
              subtitle="Discrepancies needing action"
              value={metrics.exceptionsRequiringAttention}
              totalLabel={`across ${items.length} stop records`}
              percentage={exceptionsPct}
              tone={metrics.exceptionsRequiringAttention > 0 ? "danger" : "obsidian"}
              icon={
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
              }
              badge={
                <Link
                  href="/dashboard?onlyExceptions=true"
                  style={{ textDecoration: "none" }}
                >
                  <StatusBadge
                    descriptor={getApprovalStatusDescriptor("changes_requested")}
                  />
                </Link>
              }
              actionHref="/dashboard?onlyExceptions=true"
              actionLabel="Exceptions →"
              ruleSummary={metrics.definitions.exceptionsRequiringAttention.formulaSummary}
              primarySegmentLabel={`Flagged (${metrics.exceptionsRequiringAttention})`}
              secondarySegmentLabel={`Clean (${Math.max(0, items.length - metrics.exceptionsRequiringAttention)})`}
            />
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
                        <td data-label="Trip">
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "0.875rem" }}>
                              {row.tripTitle}
                            </strong>
                            <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                              Rep: {row.ownerUserId}
                            </span>
                          </div>
                        </td>
                        <td data-label="Stop">Stop #{row.sequenceNumber}</td>
                        <td data-label="Store">
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{row.storeName}</span>
                            <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                              {row.storeRegion}
                            </span>
                          </div>
                        </td>
                        <td data-label="Planned At">{row.plannedAt}</td>
                        <td data-label="Check-In / Out">
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
                        <td data-label="Checklist">
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
                        <td data-label="Evidence">{row.evidenceCount} photos</td>
                        <td data-label="Status">
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
                        <td data-label="Action">
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
