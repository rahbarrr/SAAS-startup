import type { ReactNode } from "react";
import { ApprovalsInboxClient } from "@/components/approvals/ApprovalsInboxClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg } from "@/modules/trips/service";

export default async function ApprovalsPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let currentUserId: string | null = null;
  let trips: readonly Trip[] = [];
  let errorMessage: string | null = null;
  let isAuthenticated = false;
  let hasActiveOrg = false;
  let isManagerOrAdmin = false;

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      isAuthenticated = true;
      currentUserId = user.id;
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);
      const workspace = await resolveActiveWorkspaceForUser({
        user,
        preferredOrgId,
        repository: tenancyRepository,
      });

      if (workspace.activeOrganization) {
        hasActiveOrg = true;
        activeOrgId = workspace.activeOrganization.organization.id;
        activeOrgName = workspace.activeOrganization.organization.name;
        const role = workspace.activeOrganization.membership.role;
        isManagerOrAdmin = role === "manager" || role === "admin";

        if (isManagerOrAdmin) {
          const tripsRepository = new SupabaseTripsRepository(supabase);
          const result = await listManagerApprovalInboxForOrg({
            user,
            candidateOrgId: activeOrgId,
            rawQuery: { status: "submitted", limit: 50 },
            tenancyRepository,
            tripsRepository,
          });

          trips = result.items;
        }
      }
    }
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
            Manager Approval Inbox
          </h1>
        </section>
        <ErrorState title="Failed to load approvals" message={errorMessage} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to view approvals"
        description="Manager approvals are protected and require an active authenticated session."
      />
    );
  }

  if (!hasActiveOrg || !activeOrgId || !currentUserId) {
    return (
      <EmptyState
        title="No active organization found"
        description="You must belong to an active organization to access the approval inbox."
      />
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <EmptyState
        title="Manager Access Required"
        description="The approval inbox is restricted to operations managers and organization administrators. Field employees can plan and submit trips, which appear here for review."
      />
    );
  }

  return (
    <ApprovalsInboxClient
      initialTrips={trips}
      activeOrgId={activeOrgId}
      activeOrgName={activeOrgName ?? "Organization"}
      currentUserId={currentUserId}
    />
  );
}
