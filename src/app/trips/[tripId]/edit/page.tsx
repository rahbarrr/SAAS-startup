import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { getTripDetailForOrg } from "@/modules/trips/service";

interface EditTripPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function EditTripPage(props: EditTripPageProps): Promise<ReactNode> {
  const { tripId } = await props.params;

  let activeOrgId: string | null = null;
  let availableStores: {
    id: string;
    name: string;
    region: string;
    city: string;
    active: boolean;
  }[] = [];
  let tripDetail: Awaited<ReturnType<typeof getTripDetailForOrg>> | null = null;
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

        const tripsRepository = new SupabaseTripsRepository(supabase);
        tripDetail = await getTripDetailForOrg({
          user,
          candidateOrgId: activeOrgId,
          candidateTripId: tripId,
          tenancyRepository,
          tripsRepository,
        });

        const storesRepository = new SupabaseStoresRepository(supabase);
        const storesResult = await listStoresForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { active: true, limit: 100 },
          tenancyRepository,
          storesRepository,
        });

        availableStores = storesResult.items.map((s) => ({
          id: s.id,
          name: s.name,
          region: s.region,
          city: s.city,
          active: s.active,
        }));
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load trip for editing.";
  }

  if (errorMessage) {
    return <ErrorState title="Error loading trip" message={errorMessage} />;
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to edit field trip"
        description="Trip editing requires an active authenticated session."
      />
    );
  }

  if (!hasActiveOrg || !activeOrgId || !tripDetail) {
    return (
      <EmptyState
        title="Trip not found"
        description="The requested trip was not found in your active organization."
      />
    );
  }

  return (
    <TripPlanForm
      mode="edit"
      activeOrgId={activeOrgId}
      tripId={tripId}
      initialTitle={tripDetail.trip.title}
      initialPurpose={tripDetail.trip.purpose}
      initialStartDate={tripDetail.trip.startDate}
      initialEndDate={tripDetail.trip.endDate}
      initialStatus={tripDetail.trip.status}
      initialStops={tripDetail.stops.map((s) => ({
        storeId: s.storeId,
        plannedAt: s.plannedAt ?? "",
      }))}
      availableStores={availableStores}
    />
  );
}
