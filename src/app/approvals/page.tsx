import type { ReactNode } from "react";
import { ApprovalsInboxClient } from "@/components/approvals/ApprovalsInboxClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { hasAnyPermission } from "@/modules/tenancy/authorization";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg } from "@/modules/trips/service";

export default async function ApprovalsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const canReviewApprovals = hasAnyPermission(role, [
    "approvals.view",
    "approvals.review",
  ]);
  if (!canReviewApprovals) {
    return (
      <PermissionDeniedState
        title="Trip Approvals Restricted to Managers & Administrators"
        message="Employees are not permitted to access the Trip Approvals inbox or approve trip requests."
        currentRole={role}
        requiredPermission="approvals.review"
      />
    );
  }

  let trips: readonly Trip[] = [];
  let errorMessage: string | null = null;

  try {
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const result = await listManagerApprovalInboxForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { status: "submitted", limit: 50 },
      tenancyRepository,
      tripsRepository,
    });

    trips = result.items;
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load approval inbox for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="inbox-heading">
          <h1 id="inbox-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Trip Approval Inbox
          </h1>
        </section>
        <ErrorState title="Failed to load approvals" message={errorMessage} />
      </div>
    );
  }

  return (
    <ApprovalsInboxClient
      initialTrips={trips}
      activeOrgId={activeOrgId}
      activeOrgName={activeOrg.name}
      currentUserId={user.id}
    />
  );
}
