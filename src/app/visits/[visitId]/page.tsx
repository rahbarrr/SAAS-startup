import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import {
  getApprovalStatusDescriptor,
  getSyncStatusDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import { AiVisitReportDraftPanel } from "@/components/visits/AiVisitReportDraftPanel";
import { VisitExecutionClient } from "@/components/visits/VisitExecutionClient";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getOpenAiReportRuntimeConfig } from "@/lib/env/server";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
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
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";

interface VisitDetailPageProps {
  params: Promise<{ visitId: string }>;
}

export default async function VisitDetailPage(
  props: VisitDetailPageProps
): Promise<ReactNode> {
  const { visitId } = await props.params;
  let detail: VisitPlannedVsActualDetail | null = null;
  let errorMessage: string | null = null;

  const runtimeConfig = getOpenAiReportRuntimeConfig();
  let aiAvailability: AiFeatureAvailabilityStatus = {
    enabled: false,
    configuredOnServer: runtimeConfig.configured,
    enabledForOrg: false,
    configuredModel: runtimeConfig.model,
    dailyOrgQuota: 0,
    dailyOrgUsed: 0,
    dailyOrgRemaining: 0,
    disabledReason: runtimeConfig.configured
      ? "Sign in with an active organization membership to check organization AI report quota."
      : "AI report drafting is not configured on this server (OPENAI_API_KEY and OPENAI_REPORT_MODEL must be set in server environment variables).",
  };
  let initialAiDrafts: VisitAiReportDraft[] = [];
  let isOwnerOrCanWrite = false;

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
        const activeOrgId = workspace.activeOrganization.organization.id;
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
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load visit detail from the active organization.";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="visit-detail-heading">
        <div className="card-header">
          <div>
            <h1
              id="visit-detail-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              Store Visit Detail — Planned vs Actual
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Visit ID: <code>{visitId}</code>
            </p>
          </div>
          <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
        </div>
      </section>

      <div
        role="note"
        aria-label="Location record disclosure"
        className="card"
        style={{
          padding: "0.75rem 1rem",
          backgroundColor: "var(--bg-surface-muted, #f8fafc)",
          fontSize: "0.875rem",
        }}
      >
        <strong>Location Record Disclosure:</strong> Location is displayed strictly as a
        point-in-time check-in/out record, not live tracking. Device coordinates and
        accuracy are stored as <em>unverified device-reported data</em>, not verified
        proof of identity or location truth.
      </div>

      {errorMessage ? (
        <ErrorState title="Visit detail unavailable" message={errorMessage} />
      ) : null}

      {!detail ? (
        <>
          <EmptyState
            title="No authorized visit record loaded"
            description="Sign in with an active organization membership that owns or manages this visit to inspect planned vs actual timestamps, checklist answers, and private evidence."
            actionLabel="Back to Store Visits"
            actionHref="/visits"
          />
          <AiVisitReportDraftPanel
            orgId="unauthenticated"
            visitId={visitId}
            availability={aiAvailability}
            initialDrafts={[]}
            completedChecklistItems={[]}
            uploadedEvidenceItems={[]}
          />
        </>
      ) : (
        <>
          <section className="card" aria-labelledby="visit-comparison-heading">
            <div className="card-header">
              <h2 id="visit-comparison-heading" className="card-title">
                Planned Stop vs Actual Visit Execution
              </h2>
              <StatusBadge descriptor={getApprovalStatusDescriptor(detail.trip.status)} />
            </div>

            <div className="card-grid" style={{ marginTop: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", margin: "0 0 0.35rem" }}>Planned Stop</h3>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Trip: <Link href={`/trips/${detail.trip.id}`}>{detail.trip.title}</Link>
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Store: {detail.store?.name ?? detail.stop.storeId} (Stop #
                  {detail.stop.sequenceNumber})
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Planned Time (UTC): {detail.stop.plannedAt ?? "Any time during trip"}
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Planned Stop Status: <code>{detail.stop.status}</code>
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: "1rem", margin: "0 0 0.35rem" }}>
                  Actual Execution
                </h3>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Actual Visit Status: <code>{detail.visit.status}</code>
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Server Check-In (UTC): {detail.visit.checkedInAt ?? "—"}
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Check-In Location Record (Unverified):{" "}
                  {detail.visit.checkInLocation.status}
                  {detail.visit.checkInLocation.latitude !== null
                    ? ` (${detail.visit.checkInLocation.latitude}, ${detail.visit.checkInLocation.longitude} ±${detail.visit.checkInLocation.accuracyMeters ?? "?"}m)`
                    : ""}
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Server Check-Out (UTC): {detail.visit.checkedOutAt ?? "—"}
                </p>
                <p className="card-meta" style={{ margin: "0.2rem 0" }}>
                  Check-Out Location Record (Unverified):{" "}
                  {detail.visit.checkOutLocation.status}
                  {detail.visit.checkOutLocation.latitude !== null
                    ? ` (${detail.visit.checkOutLocation.latitude}, ${detail.visit.checkOutLocation.longitude} ±${detail.visit.checkOutLocation.accuracyMeters ?? "?"}m)`
                    : ""}
                </p>
              </div>
            </div>

            {detail.requiresAttention ? (
              <p
                style={{
                  margin: "0.75rem 0 0",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Attention Required: {detail.attentionReasons.join(" | ")}
              </p>
            ) : null}
          </section>

          <VisitExecutionClient
            activeOrgId={detail.visit.orgId}
            visitId={detail.visit.id}
            isOwnerOrCanWrite={isOwnerOrCanWrite}
            initialVisitStatus={detail.visit.status}
            initialChecklistItems={detail.checklistItems}
            initialEvidence={detail.evidence.map((e) => ({
              id: e.id,
              storagePath: e.storagePath,
              fileType: e.fileType,
              fileSize: e.fileSize,
              caption: e.caption,
              createdAt: e.createdAt,
            }))}
            initialNotes={detail.visit.notes}
          />

          <AiVisitReportDraftPanel
            orgId={detail.visit.orgId}
            visitId={detail.visit.id}
            availability={aiAvailability}
            initialDrafts={initialAiDrafts}
            completedChecklistItems={detail.checklistItems
              .filter((c) => c.completedAt !== null)
              .map((c) => ({ id: c.id, label: c.label }))}
            uploadedEvidenceItems={detail.evidence.map((e) => ({
              id: e.id,
              caption: e.caption,
              fileType: e.fileType,
            }))}
          />
        </>
      )}
    </div>
  );
}
