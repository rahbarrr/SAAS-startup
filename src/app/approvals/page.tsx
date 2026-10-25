import type { ReactNode } from "react";
import { ApprovalsInboxClient } from "@/components/approvals/ApprovalsInboxClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg } from "@/modules/trips/service";
import { DEMO_TRIPS } from "@/lib/mock-data/fieldtrack-demo-data";

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

  // Use real database trips when authenticated in an active workspace; fallback to demo data in preview mode
  const isDemo = !isAuthenticated || !hasActiveOrg;
  const displayTrips = isDemo ? DEMO_TRIPS : trips;
  const displayOrgName = activeOrgName ?? "Apex Retail Solutions (Demo)";
  const displayUserId = currentUserId ?? "usr-mgr-01";

  return (
    <ApprovalsInboxClient
      initialTrips={displayTrips}
      activeOrgId={activeOrgId ?? "org-apex-01"}
      activeOrgName={displayOrgName}
      currentUserId={displayUserId}
      isDemo={isDemo}
    />
  );
}
