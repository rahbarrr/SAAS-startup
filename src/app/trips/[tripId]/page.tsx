import Link from "next/link";
import type { ReactNode } from "react";
import { TripDetailClient } from "@/components/trips/TripDetailClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import type { OrgRole } from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
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

  let activeOrgId: string | null = null;
  let currentUserId: string | null = null;
  let userRole: OrgRole = "field_employee";
  let tripDetail: TripDetail | null = null;
  const storesMap: Record<string, { name: string; city: string; region: string }> = {};
  const visitsMap: Record<string, { id: string; status: string }> = {};
  let errorMessage: string | null = null;
  let isAuthenticated = false;
  let hasActiveOrg = false;

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
        userRole = workspace.activeOrganization.membership.role;

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
            storesMap[s.id] = { name: s.name, city: s.city, region: s.region };
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
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load field trip details.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/trips" className="card-meta">
          ← Back to Field Trips
        </Link>
        <ErrorState title="Trip not found" message={errorMessage} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to view trip details"
        description="Field trips are protected and require an active authenticated session."
      />
    );
  }

  if (!hasActiveOrg || !activeOrgId || !tripDetail || !currentUserId) {
    return (
      <EmptyState
        title="Trip not found"
        description="The requested field trip was not found in your active organization."
      />
    );
  }

  return (
    <TripDetailClient
      initialDetail={tripDetail}
      activeOrgId={activeOrgId}
      currentUserId={currentUserId}
      userRole={userRole}
      storesMap={storesMap}
      visitsMap={visitsMap}
    />
  );
}
