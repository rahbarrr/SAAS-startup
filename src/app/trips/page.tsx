import type { ReactNode } from "react";
import { TripsListClient } from "@/components/trips/TripsListClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listTripsForOrg } from "@/modules/trips/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

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

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="trips-heading">
          <h1 id="trips-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Field Trips
          </h1>
          <p className="card-meta">
            Plan multi-store routes, submit for manager approval, and review outcomes.
          </p>
        </section>
        <EmptyState
          title="Sign in to view field trips"
          description="Field trips are strictly isolated per tenant organization."
        />
      </div>
    );
  }

  if (!hasActiveOrg || !activeOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="trips-heading">
          <h1 id="trips-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Field Trips
          </h1>
        </section>
        <EmptyState
          title="No active organization found"
          description="You must belong to an active organization to manage field trips."
        />
      </div>
    );
  }

  return (
    <TripsListClient
      initialTrips={trips}
      activeOrgName={activeOrgName ?? "Organization"}
    />
  );
}
