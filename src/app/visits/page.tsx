import type { ReactNode } from "react";
import { VisitsListClient } from "@/components/visits/VisitsListClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { Visit } from "@/modules/visits/domain";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { listVisitsForOrg } from "@/modules/visits/service";

export default async function VisitsPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let visits: readonly Visit[] = [];
  let errorMessage: string | null = null;
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
        activeOrgId = workspace.activeOrganization.organization.id;
        activeOrgName = workspace.activeOrganization.organization.name;

        const visitsRepository = new SupabaseVisitsRepository(supabase);
        const result = await listVisitsForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 100 },
          tenancyRepository,
          visitsRepository,
        });

        visits = result.items;
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load store visits for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="visits-heading">
          <h1 id="visits-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Store Visits &amp; Execution
          </h1>
        </section>
        <ErrorState title="Failed to load store visits" message={errorMessage} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="visits-heading">
          <h1 id="visits-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Store Visits &amp; Execution
          </h1>
          <p className="card-meta">
            On-site check-ins, audit checklists, photo evidence capture, and checkout
            telemetry.
          </p>
        </section>
        <EmptyState
          title="Sign in to view visits"
          description="Visit records are isolated per organization and require an active authenticated session."
        />
      </div>
    );
  }

  if (!hasActiveOrg || !activeOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="visits-heading">
          <h1 id="visits-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Store Visits &amp; Execution
          </h1>
        </section>
        <EmptyState
          title="No active organization found"
          description="You must belong to an active organization to record or review store visits."
        />
      </div>
    );
  }

  return (
    <VisitsListClient
      initialVisits={visits}
      activeOrgName={activeOrgName ?? "Organization"}
    />
  );
}
