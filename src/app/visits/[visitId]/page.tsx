import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";
import {
  getApprovalStatusDescriptor,
  getSyncStatusDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import { AiVisitReportDraftPanel } from "@/components/visits/AiVisitReportDraftPanel";
import { VisitExecutionClient } from "@/components/visits/VisitExecutionClient";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
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
import { DEMO_VISITS, DEMO_STORES, DEMO_TRIPS } from "@/lib/mock-data/fieldtrack-demo-data";

interface VisitDetailPageProps {
  params: Promise<{ visitId: string }>;
}

export default async function VisitDetailPage(
  props: VisitDetailPageProps
): Promise<ReactNode> {
  const { visitId } = await props.params;
  let detail: VisitPlannedVsActualDetail | null = null;
  let errorMessage: string | null = null;

  let aiAvailability: AiFeatureAvailabilityStatus = {
    enabled: true,
    configuredOnServer: true,
    enabledForOrg: true,
    configuredModel: "gpt-4o-mini",
    dailyOrgQuota: 50,
    dailyOrgUsed: 12,
    dailyOrgRemaining: 38,
    disabledReason: null,
  };
  let initialAiDrafts: VisitAiReportDraft[] = [];
  let isOwnerOrCanWrite = true;
  let isAuthenticated = false;
  let hasActiveOrg = false;

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      isAuthenticated = true;
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);
      const workspace = await resolveActiveWorkspaceForUser({
        user,
        preferredOrgId,
        repository: tenancyRepository,
      });

      if (workspace.activeOrganization) {
        hasActiveOrg = true;
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
        : "An unexpected error occurred while loading visit details.";
  }

  // If user is authenticated in an active workspace, require real data or show appropriate error
  if (isAuthenticated && hasActiveOrg) {
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
  }

  const isDemo = !isAuthenticated || !hasActiveOrg;

  // Gracefully fallback to rich demo visit details when unauthenticated
  if (!detail) {
    errorMessage = null;
    const defaultVisit = DEMO_VISITS[0];
    const defaultStore = DEMO_STORES[0];
    const defaultTrip = DEMO_TRIPS[0];
    if (!defaultVisit || !defaultStore || !defaultTrip) {
      return <ErrorState title="Visit not found" message="Demo visit dataset unavailable." />;
    }
    const demoV = DEMO_VISITS.find((v) => v.id === visitId) ?? defaultVisit;
    const demoStore = DEMO_STORES.find((s) => s.id === demoV.storeId) ?? defaultStore;
    const demoTrip = DEMO_TRIPS.find((t) => t.id === demoV.tripId) ?? defaultTrip;

    detail = {
      visit: {
        id: demoV.id,
        orgId: "org-apex-01",
        tripStopId: `stop-${demoV.tripId}-1`,
        employeeUserId: demoV.repId,
        checkedInAt: demoV.checkInTime ? "2026-10-25T09:04:00.000Z" : null,
        checkedOutAt: demoV.checkOutTime ? "2026-10-25T10:22:00.000Z" : null,
        checkInLocation: {
          latitude: demoV.gpsCoordinates?.lat ?? 37.7749,
          longitude: demoV.gpsCoordinates?.lng ?? -122.4194,
          accuracyMeters: demoV.gpsCoordinates?.accuracyMeters ?? 8.4,
          status: "captured_unverified",
          verificationNotice: "unverified_device_reported",
          limitationExplanation: null,
        },
        checkOutLocation: {
          latitude: demoV.gpsCoordinates?.lat ?? 37.7749,
          longitude: demoV.gpsCoordinates?.lng ?? -122.4194,
          accuracyMeters: demoV.gpsCoordinates?.accuracyMeters ?? 8.4,
          status: "captured_unverified",
          verificationNotice: "unverified_device_reported",
          limitationExplanation: null,
        },
        checkInIdempotencyKey: null,
        checkOutIdempotencyKey: null,
        notes: demoV.notes,
        status: demoV.status,
        createdAt: "2026-10-25T09:00:00.000Z",
        updatedAt: "2026-10-25T10:22:00.000Z",
      },
      trip: {
        id: demoTrip.id,
        orgId: demoTrip.orgId,
        ownerUserId: demoTrip.ownerUserId,
        title: demoTrip.title,
        startDate: demoTrip.startDate,
        endDate: demoTrip.endDate,
        purpose: demoTrip.purpose,
        status: demoTrip.status,
        submittedAt: demoTrip.submittedAt,
        decidedBy: demoTrip.decidedBy,
        decidedAt: demoTrip.decidedAt,
        decisionNote: demoTrip.decisionNote,
        createdAt: demoTrip.createdAt,
        updatedAt: demoTrip.updatedAt,
      },
      stop: {
        id: `stop-${demoTrip.id}-1`,
        orgId: "org-apex-01",
        tripId: demoTrip.id,
        storeId: demoStore.id,
        sequenceNumber: 1,
        plannedAt: `${demoTrip.startDate}T09:00:00.000Z`,
        status: "visited",
        createdAt: demoTrip.createdAt,
        updatedAt: demoTrip.updatedAt,
      },
      store: {
        id: demoStore.id,
        orgId: "org-apex-01",
        name: demoStore.name,
        region: demoStore.territory,
        addressLine1: demoStore.address,
        addressLine2: null,
        city: demoStore.city,
        stateProvince: demoStore.state,
        postalCode: "94103",
        countryCode: "US",
        latitude: demoStore.coordinates.lat,
        longitude: demoStore.coordinates.lng,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      checklistItems: demoV.checklist.map((c, idx) => ({
        id: `chk-${idx + 1}`,
        orgId: "org-apex-01",
        visitId: demoV.id,
        questionKey: `q_${c.id}`,
        label: c.title,
        answerType: "boolean",
        answerValue: c.completed,
        answerText: c.completed ? "Verified compliant" : "Pending",
        flagged: !c.completed && c.required,
        required: c.required,
        completedAt: c.completed ? "2026-10-25T09:30:00.000Z" : null,
        completedBy: demoV.repId,
        createdAt: "2026-10-25T09:00:00.000Z",
        updatedAt: "2026-10-25T09:30:00.000Z",
      })),
      evidence: demoV.evidence.map((ev, idx) => ({
        id: ev.id,
        orgId: "org-apex-01",
        visitId: demoV.id,
        storagePath: `demo/${ev.fileName}`,
        fileType: "image/jpeg",
        fileSize: 2500000,
        caption: ev.fileName,
        uploadedBy: demoV.repId,
        idempotencyKey: `idem-${idx}`,
        createdAt: ev.uploadedAt,
      })),
      requiredChecklistCompletedCount: demoV.checklist.filter((c) => c.completed && c.required).length,
      requiredChecklistTotalCount: demoV.checklist.filter((c) => c.required).length,
      flaggedChecklistCount: demoV.hasException ? 1 : 0,
      requiresAttention: demoV.hasException,
      attentionReasons: demoV.exceptionReason ? [demoV.exceptionReason] : [],
      locationDisclosure:
        "Point-in-time device geolocation captured with explicit user permission. Demonstrates proximity to physical retail address.",
    };

    if (demoV.aiSummary) {
      initialAiDrafts = [
        {
          id: `draft-ai-${demoV.id}`,
          orgId: "org-apex-01",
          visitId: demoV.id,
          modelName: "gpt-4o-mini",
          modelVersion: "2024-07-18",
          promptTemplateVersion: "fieldtrack-visit-report-v1",
          reviewStatus: "pending_review",
          requiresHumanReview: true,
          isFinalApproved: false,
          aiGeneratedLabel: "AI-Generated Draft — Requires Human Review",
          summary: demoV.aiSummary,
          completedActions: [
            { action: "Endcap promotional signage verified", sourceRecordIds: ["chk-1"] },
            { action: "Planogram facing alignment checked", sourceRecordIds: ["chk-2"] },
          ],
          issues: demoV.hasException
            ? [{ issue: demoV.exceptionReason ?? "Variance observed", severity: "medium", sourceRecordIds: ["chk-3"] }]
            : [],
          followUps: [
            { recommendation: "Replenish reserve stock pallets before weekend rush", priority: "important", sourceRecordIds: ["chk-4"] },
          ],
          uncertaintyNotes: [],
          sourceRecordIds: {
            visitId: demoV.id,
            checklistItemIds: ["chk-1", "chk-2", "chk-3", "chk-4"],
            evidenceIds: ["ev-01"],
          },
          inputTokens: 420,
          outputTokens: 185,
          createdBy: demoV.repId,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          createdAt: "2026-10-25T10:25:00.000Z",
          updatedAt: "2026-10-25T10:25:00.000Z",
        },
      ];
    }
  }

  if (errorMessage || !detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/visits" className="card-meta">
          ← Back to Store Visits
        </Link>
        <ErrorState
          title="Visit execution record unavailable"
          message={errorMessage ?? "Visit record not found."}
        />
      </div>
    );
  }

  const { visit, trip, stop, store, checklistItems, evidence } = detail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="visit-detail-heading">
        <Link href="/visits" className="card-meta" style={{ display: "inline-block", marginBottom: "0.5rem" }}>
          ← Back to Store Visits
        </Link>
        <div className="card-header">
          <div>
            <h1
              id="visit-detail-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
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
            <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
          </div>
        </div>
      </section>

      {/* Mode Banner */}
      {isDemo ? (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(27, 53, 128, 0.06)",
            border: "1px solid rgba(27, 53, 128, 0.18)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.875rem",
            color: "var(--brand-primary)",
          }}
        >
          <span>
            <strong>Interactive Demo Preview:</strong> Showing synthetic store visit, checklist, and telemetry data. Sign in with a registered workspace for live multi-tenant persistence.
          </span>
          <Link
            href="/login"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
          >
            Sign In
          </Link>
        </div>
      ) : (
        <div
          role="note"
          style={{
            background: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1rem",
            fontSize: "0.8125rem",
            color: "var(--brand-primary)",
          }}
        >
          <strong>Location Evidence Notice:</strong> Point-in-time device geolocation is captured with explicit consent upon check-in and checkout to verify physical store proximity. No continuous background tracking is performed.
        </div>
      )}

      {detail.requiresAttention ? (
        <div
          role="alert"
          style={{
            padding: "0.875rem 1.25rem",
            backgroundColor: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: "var(--radius-md)",
            color: "var(--status-danger-text)",
          }}
        >
          <strong>⚠️ Exception Requiring Attention:</strong>{" "}
          {detail.attentionReasons.join(" | ")}
        </div>
      ) : null}

      {/* Store Location Summary Card */}
      {store ? (
        <section className="card" aria-label="Store contact details">
          <div className="card-header">
            <div>
              <h2 className="card-title" style={{ fontSize: "1.0625rem" }}>
                {store.name}
              </h2>
              <p className="card-meta">
                {store.addressLine1}, {store.city} ({store.region})
              </p>
            </div>
            <Link href={`/stores/${store.id}`} className="btn btn-sm btn-secondary">
              View Store Profile →
            </Link>
          </div>
        </section>
      ) : null}

      {/* Visit Execution Interactive Client */}
      <VisitExecutionClient
        activeOrgId={visit.orgId}
        visitId={visit.id}
        isOwnerOrCanWrite={isOwnerOrCanWrite}
        initialVisitStatus={visit.status}
        initialChecklistItems={checklistItems}
        initialEvidence={evidence}
        initialNotes={visit.notes}
      />

      {/* AI Visit Summary Assistant */}
      <AiVisitReportDraftPanel
        orgId={visit.orgId}
        visitId={visit.id}
        availability={aiAvailability}
        initialDrafts={initialAiDrafts}
        completedChecklistItems={checklistItems.map((c) => ({ id: c.id, label: c.label }))}
        uploadedEvidenceItems={evidence.map((ev) => ({ id: ev.id, caption: ev.caption, fileType: ev.fileType }))}
      />
    </div>
  );
}
