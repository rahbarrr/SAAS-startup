import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";

export default async function NewTripPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, tenancyRepository, supabase } = context;

  let availableStores: {
    id: string;
    name: string;
    region: string;
    city: string;
    active: boolean;
    addressLine1?: string;
    countryCode?: string;
    latitude?: number | null;
    longitude?: number | null;
  }[] = [];
  let errorMessage: string | null = null;

  try {
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
      addressLine1: s.addressLine1,
      countryCode: s.countryCode,
      latitude: s.latitude,
      longitude: s.longitude,
    }));
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to prepare trip creation form.";
  }

  if (errorMessage) {
    return <ErrorState title="Error initializing trip" message={errorMessage} />;
  }

  return (
    <TripPlanForm
      mode="create"
      activeOrgId={activeOrgId}
      availableStores={availableStores}
    />
  );
}
