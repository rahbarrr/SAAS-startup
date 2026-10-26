import Link from "next/link";
import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { getTripDetailForOrg } from "@/modules/trips/service";

interface EditTripPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function EditTripPage(props: EditTripPageProps): Promise<ReactNode> {
  const { tripId } = await props.params;
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, tenancyRepository, supabase } = context;

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
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load trip for editing.";
  }

  if (errorMessage || !tripDetail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/trips" className="card-meta">
          ← Back to Field Trips
        </Link>
        <ErrorState
          title="Trip not found"
          message={
            errorMessage ?? "This field trip does not exist in your active workspace."
          }
        />
      </div>
    );
  }

  return (
    <TripPlanForm
      activeOrgId={activeOrgId}
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
