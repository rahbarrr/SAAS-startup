import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TripDetailClient } from "@/components/trips/TripDetailClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import type { OrgRole } from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { TripDetail, TripStop } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { getTripDetailForOrg } from "@/modules/trips/service";
import { DEMO_TRIPS, DEMO_STORES } from "@/lib/mock-data/fieldtrack-demo-data";

interface TripDetailPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function TripDetailPage(
  props: TripDetailPageProps
): Promise<ReactNode> {
  const { tripId } = await props.params;

  let activeOrgId: string | null = null;
  let currentUserId = "usr-mgr-01";
  let userRole: OrgRole = "manager";
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

  // If user is authenticated in an active workspace, require real data or show appropriate error
  if (isAuthenticated && hasActiveOrg) {
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
        activeOrgId={activeOrgId ?? "org-apex-01"}
        currentUserId={currentUserId}
        userRole={userRole}
        storesMap={storesMap}
        visitsMap={visitsMap}
        isDemo={false}
      />
    );
  }

  // Fallback to rich demo data for unauthenticated demonstration & preview
  if (!tripDetail) {
    errorMessage = null; // Clear error to allow preview
    const defaultTrip = DEMO_TRIPS[0];
    const foundDemoTrip = DEMO_TRIPS.find((t) => t.id === tripId) ?? defaultTrip;
    if (!foundDemoTrip) {
      notFound();
    }

    const demoStops: TripStop[] = foundDemoTrip.stores.map((s, idx) => ({
      id: `stop-${foundDemoTrip.id}-${idx + 1}`,
      orgId: foundDemoTrip.orgId,
      tripId: foundDemoTrip.id,
      storeId: s.id,
      sequenceNumber: s.sequence,
      plannedAt: `${foundDemoTrip.startDate}T09:00:00.000Z`,
      status: s.status === "checked_out" ? "visited" : "planned",
      createdAt: foundDemoTrip.createdAt,
      updatedAt: foundDemoTrip.updatedAt,
    }));

    tripDetail = {
      trip: {
        id: foundDemoTrip.id,
        orgId: foundDemoTrip.orgId,
        ownerUserId: foundDemoTrip.ownerUserId,
        title: foundDemoTrip.title,
        startDate: foundDemoTrip.startDate,
        endDate: foundDemoTrip.endDate,
        purpose: foundDemoTrip.purpose,
        status: foundDemoTrip.status,
        submittedAt: foundDemoTrip.submittedAt,
        decidedBy: foundDemoTrip.decidedBy,
        decidedAt: foundDemoTrip.decidedAt,
        decisionNote: foundDemoTrip.decisionNote,
        createdAt: foundDemoTrip.createdAt,
        updatedAt: foundDemoTrip.updatedAt,
      },
      stops: demoStops,
      auditEvents: [
        {
          id: `audit-${foundDemoTrip.id}-1`,
          tripId: foundDemoTrip.id,
          orgId: foundDemoTrip.orgId,
          actorUserId: foundDemoTrip.ownerUserId,
          eventType: "trip_created",
          oldStatus: null,
          newStatus: "draft",
          note: "Trip draft initialized with planned store stops.",
          metadata: {},
          createdAt: foundDemoTrip.createdAt,
        },
        ...(foundDemoTrip.submittedAt
          ? [
              {
                id: `audit-${foundDemoTrip.id}-2`,
                tripId: foundDemoTrip.id,
                orgId: foundDemoTrip.orgId,
                actorUserId: foundDemoTrip.ownerUserId,
                eventType: "trip_submitted" as const,
                oldStatus: "draft" as const,
                newStatus: "submitted" as const,
                note: "Submitted for regional manager approval.",
                metadata: {},
                createdAt: foundDemoTrip.submittedAt,
              },
            ]
          : []),
        ...(foundDemoTrip.decidedAt
          ? [
              {
                id: `audit-${foundDemoTrip.id}-3`,
                tripId: foundDemoTrip.id,
                orgId: foundDemoTrip.orgId,
                actorUserId: foundDemoTrip.decidedBy ?? "usr-mgr-01",
                eventType: "trip_approved" as const,
                oldStatus: "submitted" as const,
                newStatus: foundDemoTrip.status,
                note: foundDemoTrip.decisionNote ?? "Approved by manager.",
                metadata: {},
                createdAt: foundDemoTrip.decidedAt,
              },
            ]
          : []),
      ],
    };

    // Populate storesMap and visitsMap from demo stores
    for (const store of DEMO_STORES) {
      storesMap[store.id] = { name: store.name, city: store.city, region: store.territory };
    }
    visitsMap[`stop-${foundDemoTrip.id}-1`] = { id: "visit-01", status: "reviewed" };
    visitsMap[`stop-${foundDemoTrip.id}-2`] = { id: "visit-02", status: "submitted" };
  }

  if (errorMessage || !tripDetail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/trips" className="card-meta">
          ← Back to Field Trips
        </Link>
        <ErrorState title="Trip not found" message={errorMessage ?? "Field trip details unavailable."} />
      </div>
    );
  }

  return (
    <TripDetailClient
      initialDetail={tripDetail}
      activeOrgId={activeOrgId ?? "org-apex-01"}
      currentUserId={currentUserId}
      userRole={userRole}
      storesMap={storesMap}
      visitsMap={visitsMap}
      isDemo={true}
    />
  );
}
