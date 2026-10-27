import Link from "next/link";
import type { ReactNode } from "react";
import { TripDetailClient } from "@/components/trips/TripDetailClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import type { TripDetail } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { getTripDetailForOrg } from "@/modules/trips/service";

interface TripDetailPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function TripDetailPage(
  props: TripDetailPageProps
): Promise<ReactNode> {
  const { tripId } = await props.params;
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, role, tenancyRepository, supabase } = context;

  let tripDetail: TripDetail | null = null;
  const storesMap: Record<
    string,
    {
      name: string;
      city: string;
      region: string;
      addressLine1?: string;
      countryCode?: string;
      latitude?: number | null;
      longitude?: number | null;
    }
  > = {};
  const visitsMap: Record<string, { id: string; status: string }> = {};
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

    const storeIds = tripDetail.stops.map((s) => s.storeId);
    if (storeIds.length > 0) {
      const storesRepository = new SupabaseStoresRepository(supabase);
      const stores = await storesRepository.getStoresByIds(activeOrgId, storeIds);
      for (const s of stores) {
        storesMap[s.id] = {
          name: s.name,
          city: s.city,
          region: s.region,
          addressLine1: s.addressLine1,
          countryCode: s.countryCode,
          latitude: s.latitude,
          longitude: s.longitude,
        };
      }
    }

    const stopIds = tripDetail.stops.map((s) => s.id);
    if (stopIds.length > 0) {
      const { data: visits } = await supabase
        .from("visits")
        .select("id, trip_stop_id, status")
        .eq("organization_id", activeOrgId)
        .in("trip_stop_id", stopIds);
      if (visits) {
        for (const v of visits) {
          visitsMap[v.trip_stop_id] = { id: v.id, status: v.status };
        }
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load field trip details.";
  }

  if (errorMessage || !tripDetail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/trips" className="card-meta">
          ← Back to Field Trips
        </Link>
        <ErrorState
          title="Field trip not found"
          message={
            errorMessage ??
            "This field trip does not exist in your active workspace or you do not have permission to view it."
          }
        />
      </div>
    );
  }

  return (
    <TripDetailClient
      initialDetail={tripDetail}
      activeOrgId={activeOrgId}
      currentUserId={user.id}
      userRole={role}
      storesMap={storesMap}
      visitsMap={visitsMap}
    />
  );
}
