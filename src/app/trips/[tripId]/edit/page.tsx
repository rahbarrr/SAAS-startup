import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { getTripDetailForOrg } from "@/modules/trips/service";
import { DEMO_TRIPS, DEMO_STORES } from "@/lib/mock-data/fieldtrack-demo-data";

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

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);
      const workspace = await resolveActiveWorkspaceForUser({
        user,
        preferredOrgId,
        repository: tenancyRepository,
      });

      if (workspace.activeOrganization) {
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

  // Fallback to demo trip if not authenticated
  if (!tripDetail) {
    errorMessage = null;
    const defaultTrip = DEMO_TRIPS[DEMO_TRIPS.length - 1] ?? DEMO_TRIPS[0];
    const found = DEMO_TRIPS.find((t) => t.id === tripId) ?? defaultTrip;
    if (!found) {
      return <ErrorState title="Error loading trip" message="Trip not found" />;
    }
    tripDetail = {
      trip: {
        id: found.id,
        orgId: found.orgId,
        ownerUserId: found.ownerUserId,
        title: found.title,
        startDate: found.startDate,
        endDate: found.endDate,
        purpose: found.purpose,
        status: found.status,
        submittedAt: found.submittedAt,
        decidedBy: found.decidedBy,
        decidedAt: found.decidedAt,
        decisionNote: found.decisionNote,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      },
      stops: found.stores.map((s, idx) => ({
        id: `stop-${found.id}-${idx + 1}`,
        orgId: found.orgId,
        tripId: found.id,
        storeId: s.id,
        sequenceNumber: s.sequence,
        plannedAt: `${found.startDate}T10:00:00.000Z`,
        status: s.status === "checked_out" ? "visited" : "planned",
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      })),
      auditEvents: [],
    };
    availableStores = DEMO_STORES.map((s) => ({
      id: s.id,
      name: s.name,
      region: s.territory,
      city: s.city,
      active: s.status === "active",
    }));
  }

  if (errorMessage || !tripDetail) {
    return <ErrorState title="Error loading trip" message={errorMessage ?? "Trip not found"} />;
  }

  return (
    <TripPlanForm
      activeOrgId={activeOrgId ?? "org-apex-01"}
      tripId={tripId}
      mode="edit"
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
