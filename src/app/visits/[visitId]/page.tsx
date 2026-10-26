import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { AiVisitReportDraftPanel } from "@/components/visits/AiVisitReportDraftPanel";
import { VisitExecutionClient } from "@/components/visits/VisitExecutionClient";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type {
  AiFeatureAvailabilityStatus,
  VisitAiReportDraft,
} from "@/modules/ai-reports/domain";
import { OpenAiResponsesReportProvider } from "@/modules/ai-reports/openai-provider";
import { SupabaseAiReportsRepository } from "@/modules/ai-reports/repository";
import { getVisitAiReportDraftsStateForOrg } from "@/modules/ai-reports/service";
import type { VisitPlannedVsActualDetail } from "@/modules/reporting/domain";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { getVisitPlannedVsActualForOrg } from "@/modules/reporting/service";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";

interface VisitDetailPageProps {
  params: Promise<{ visitId: string }>;
}

export default async function VisitDetailPage(
  props: VisitDetailPageProps
): Promise<ReactNode> {
  const { visitId } = await props.params;
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, tenancyRepository, supabase } = context;

  let detail: VisitPlannedVsActualDetail | null = null;
  let errorMessage: string | null = null;

  let aiAvailability: AiFeatureAvailabilityStatus = {
    enabled: true,
    configuredOnServer: true,
    enabledForOrg: true,
    configuredModel: "gpt-4o-mini",
    dailyOrgQuota: 50,
    dailyOrgUsed: 0,
    dailyOrgRemaining: 50,
    disabledReason: null,
  };
  let initialAiDrafts: VisitAiReportDraft[] = [];
  let isOwnerOrCanWrite = true;

  try {
    const reportingRepository = new SupabaseReportingRepository(supabase);
    detail = await getVisitPlannedVsActualForOrg({
      user,
      candidateOrgId: activeOrgId,
      candidateVisitId: visitId,
      tenancyRepository,
      reportingRepository,
    });

    isOwnerOrCanWrite = Boolean(detail && detail.visit.employeeUserId === user.id);

    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const aiReportsRepository = new SupabaseAiReportsRepository(supabase);
    const aiProvider = new OpenAiResponsesReportProvider();
    const aiOverview = await getVisitAiReportDraftsStateForOrg({
      user,
      candidateOrgId: activeOrgId,
      candidateVisitId: visitId,
      tenancyRepository,
      visitsRepository,
      aiReportsRepository,
      aiProvider,
    });

    aiAvailability = aiOverview.availability;
    initialAiDrafts = aiOverview.drafts;
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while loading visit details.";
  }

  if (errorMessage || !detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/visits" className="card-meta">
          ← Back to Store Visits
        </Link>
        <ErrorState
          title="Visit execution record unavailable"
          message={
            errorMessage ??
            "This store visit record does not exist in your active workspace or you do not have permission to view it."
          }
        />
      </div>
    );
  }

  const { visit, stop, trip, store } = detail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="visit-detail-heading">
        <div className="card-header">
          <div>
            <Link href="/visits" className="card-meta">
              ← Back to Store Visits
            </Link>
            <h1
              id="visit-detail-heading"
              style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.5rem" }}
            >
              Store Visit Execution: {store?.name ?? "Retail Store"}
            </h1>
            <p className="card-meta">
              Trip: <strong>{trip.title}</strong> • Stop #{stop.sequenceNumber} (
              {store?.region ?? "Region"})
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <StatusBadge descriptor={getApprovalStatusDescriptor(visit.status)} />
          </div>
        </div>
      </section>

      <div className="card-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "1rem" }}>
              Planned vs Actual Execution
            </h2>
          </div>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            <dt style={{ color: "var(--text-secondary)" }}>Planned Arrival:</dt>
            <dd style={{ margin: 0 }}>{stop.plannedAt ?? "Unscheduled"}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Actual Check-In:</dt>
            <dd style={{ margin: 0 }}>{visit.checkedInAt ?? "Not checked in"}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Actual Check-Out:</dt>
            <dd style={{ margin: 0 }}>{visit.checkedOutAt ?? "Not checked out"}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Assigned Executive:</dt>
            <dd style={{ margin: 0 }}>{visit.employeeUserId}</dd>
          </dl>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: "1rem" }}>
              Store Location &amp; Coordinates
            </h2>
          </div>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem" }}>
            <strong>{store?.name}</strong>
            <br />
            {store?.addressLine1}
            {store?.addressLine2 ? `, ${store.addressLine2}` : ""}
            <br />
            {store?.city}, {store?.stateProvince} {store?.postalCode}
          </p>
          <p className="card-meta" style={{ margin: 0, fontSize: "0.75rem" }}>
            Point-in-time check-in coordinates are captured with explicit employee consent
            on device.
          </p>
        </div>
      </div>

      {/* Interactive Visit Execution Client */}
      <VisitExecutionClient
        activeOrgId={activeOrgId}
        visitId={visit.id}
        isOwnerOrCanWrite={isOwnerOrCanWrite}
        initialVisitStatus={visit.status}
        initialChecklistItems={detail.checklistItems}
        initialEvidence={detail.evidence.map((e) => ({
          id: e.id,
          storagePath: e.storagePath,
          fileType: e.fileType,
          fileSize: e.fileSize,
          caption: e.caption,
          createdAt: e.createdAt,
        }))}
        initialNotes={visit.notes ?? ""}
      />

      {/* AI Visit Summary Assistant */}
      <AiVisitReportDraftPanel
        orgId={activeOrgId}
        visitId={visit.id}
        availability={aiAvailability}
        initialDrafts={initialAiDrafts}
        completedChecklistItems={detail.checklistItems
          .filter((item) => item.completedAt !== null)
          .map((item) => ({ id: item.id, label: item.label }))}
        uploadedEvidenceItems={detail.evidence.map((item) => ({
          id: item.id,
          caption: item.caption,
          fileType: item.fileType,
        }))}
      />
    </div>
  );
}
