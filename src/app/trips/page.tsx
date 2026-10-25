import type { ReactNode } from "react";
import { TripsListClient } from "@/components/trips/TripsListClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listTripsForOrg } from "@/modules/trips/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { DEMO_TRIPS } from "@/lib/mock-data/fieldtrack-demo-data";

export default async function TripsPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let trips: readonly Trip[] = [];
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

        const tripsRepository = new SupabaseTripsRepository(supabase);
        const result = await listTripsForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 100 },
          tenancyRepository,
          tripsRepository,
        });

        trips = result.items;
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load field trips for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="trips-heading">
          <h1 id="trips-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Field Trips
          </h1>
        </section>
        <ErrorState title="Failed to load field trips" message={errorMessage} />
      </div>
    );
  }

  // Use real database trips when authenticated in an active workspace; fallback to demo data in preview mode
  const isDemo = !isAuthenticated || !hasActiveOrg;
  const displayTrips = isDemo ? DEMO_TRIPS : trips;
  const displayOrgName = activeOrgName ?? "Apex Retail Solutions (Demo)";

  return (
    <TripsListClient
      initialTrips={displayTrips}
      activeOrgId={activeOrgId ?? undefined}
      activeOrgName={displayOrgName}
      isDemo={isDemo}
    />
  );
}
