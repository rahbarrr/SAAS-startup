import type { ReactNode } from "react";
import { TripsListClient } from "@/components/trips/TripsListClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listTripsForOrg } from "@/modules/trips/service";

export default async function TripsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, tenancyRepository, supabase } = context;

  let trips: readonly Trip[] = [];
  let errorMessage: string | null = null;

  try {
    const tripsRepository = new SupabaseTripsRepository(supabase);
    const result = await listTripsForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { limit: 100 },
      tenancyRepository,
      tripsRepository,
    });

    trips = result.items;
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

  return (
    <TripsListClient
      initialTrips={trips}
      activeOrgId={activeOrgId}
      activeOrgName={activeOrg.name}
    />
  );
}
