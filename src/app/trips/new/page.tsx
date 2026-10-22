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

export default async function NewTripPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let availableStores: {
    id: string;
    name: string;
    region: string;
    city: string;
    active: boolean;
  }[] = [];
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
      err instanceof Error ? err.message : "Unable to prepare trip creation form.";
  }

  if (errorMessage) {
    return <ErrorState title="Error initializing trip" message={errorMessage} />;
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to create a field trip"
        description="Trip plans are scoped to your authenticated organization."
      />
    );
  }

  if (!hasActiveOrg || !activeOrgId) {
    return (
      <EmptyState
        title="No active organization found"
        description="You must be an active member of an organization to plan trips."
      />
    );
  }

  return (
    <TripPlanForm
      mode="create"
      activeOrgId={activeOrgId}
      availableStores={availableStores}
    />
  );
}
