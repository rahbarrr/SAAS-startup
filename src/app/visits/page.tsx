import type { ReactNode } from "react";
import { VisitsListClient } from "@/components/visits/VisitsListClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { Visit } from "@/modules/visits/domain";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { listVisitsForOrg } from "@/modules/visits/service";
import { DEMO_VISITS } from "@/lib/mock-data/fieldtrack-demo-data";

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

  // Use real database visits when authenticated in an active workspace; fallback to demo data in preview mode
  const isDemo = !isAuthenticated || !hasActiveOrg;
  const displayVisits = isDemo ? (DEMO_VISITS as unknown as readonly Visit[]) : visits;
  const displayOrgName = activeOrgName ?? "Apex Retail Solutions (Demo)";

  return (
    <VisitsListClient
      initialVisits={displayVisits}
      activeOrgId={activeOrgId ?? undefined}
      activeOrgName={displayOrgName}
      isDemo={isDemo}
    />
  );
}
