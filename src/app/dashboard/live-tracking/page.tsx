import type { ReactNode } from "react";
import { LiveTrackingDashboardClient } from "@/components/dashboard/LiveTrackingDashboardClient";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { SupabaseLocationRepository } from "@/modules/location/repository";
import { listManagerLiveTracking } from "@/modules/location/service";
import { SupabaseStoresRepository } from "@/modules/stores/repository";

export const metadata = {
  title: "Live Location Tracking | FieldTrack",
  description: "Live real-time GPS map of active field employees and store geofences.",
};

export default async function LiveTrackingPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, role, tenancyRepository, supabase } = context;

  if (role !== "manager" && role !== "admin") {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Access Restricted</h2>
          <p style={{ color: "#64748b" }}>
            The Live Manager Map is restricted to organization managers and administrators.
          </p>
        </div>
      </div>
    );
  }

  const locationRepository = new SupabaseLocationRepository(supabase);
  const storesRepository = new SupabaseStoresRepository(supabase);

  const [liveLocations, storesResult] = await Promise.all([
    listManagerLiveTracking({
      user,
      candidateOrgId: activeOrgId,
      tenancyRepository,
      locationRepository,
    }).catch(() => []),
    storesRepository.listStores(activeOrgId, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
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
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.25rem", color: "#0f172a" }}>
          📡 Live Location Tracking
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
          Real-time GPS tracking of field employees on authorized active work trips. Stale & delayed location warnings applied automatically.
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
