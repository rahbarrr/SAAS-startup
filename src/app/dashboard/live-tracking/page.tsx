import type { ReactNode } from "react";
import { Radio } from "lucide-react";
import { LiveTrackingDashboardClient } from "@/components/dashboard/LiveTrackingDashboardClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { listManagerLiveTracking } from "@/modules/location/service";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { hasAnyPermission, hasPermission } from "@/modules/tenancy/authorization";

export const metadata = {
  title: "Live Location Tracking | FieldTrack",
  description: "Live real-time GPS map of active field employees and store geofences.",
};

export default async function LiveTrackingPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, role, tenancyRepository, supabase } = context;

  const canTrack = hasAnyPermission(role, [
    "tracking.view.organization",
    "tracking.view.team",
  ]);
  if (!canTrack) {
    return (
      <PermissionDeniedState
        title="Live Map Restricted to Managers & Administrators"
        message="Employees can only view their own GPS tracking status on their personal dashboard and active trip view."
        currentRole={role}
        requiredPermission="tracking.view.team"
      />
    );
  }

  const isOrgWideTracking = hasPermission(role, "tracking.view.organization");

  const locationRepository = new SupabaseLocationRepository(supabase);
  const storesRepository = new SupabaseStoresRepository(supabase);

  const [liveLocations, storesResult] = await Promise.all([
    listManagerLiveTracking({
      user,
      candidateOrgId: activeOrgId,
      tenancyRepository,
      locationRepository,
    }).catch(() => []),
    storesRepository
      .listStores(activeOrgId, { limit: 100 })
      .catch(() => ({ items: [], nextCursor: null })),
  ]);

  const validStores = storesResult.items
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude as number,
      longitude: s.longitude as number,
      addressLine1: s.addressLine1,
      city: s.city,
    }));

  return (
    <div className="page-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: "0 0 0.25rem",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <Radio size={24} style={{ color: "var(--brand-primary, #216a85)" }} aria-hidden="true" />
          <span>
            {isOrgWideTracking
              ? "Live Location Tracking — Organization Overview"
              : "Live Location Tracking — Assigned Team Only"}
          </span>
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
          {isOrgWideTracking
            ? "Organization-wide real-time GPS tracking of all field employees on active work trips and store geofences."
            : "Assigned team real-time GPS tracking of your direct reports on authorized active work trips."}
        </p>
      </div>

      <LiveTrackingDashboardClient
        initialLocations={liveLocations}
        stores={validStores}
        orgId={activeOrgId}
      />
    </div>
  );
}
