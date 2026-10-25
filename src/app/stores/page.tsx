import type { ReactNode } from "react";
import { StoresDirectoryClient } from "@/components/stores/StoresDirectoryClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { DEMO_STORES } from "@/lib/mock-data/fieldtrack-demo-data";

export default async function StoresPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let canWrite = false;
  let stores: readonly Store[] = [];
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
        const role = workspace.activeOrganization.membership.role;
        canWrite = role === "admin" || role === "manager";

        const storesRepository = new SupabaseStoresRepository(supabase);
        const result = await listStoresForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 100 },
          tenancyRepository,
          storesRepository,
        });

        stores = result.items;
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load store directory for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="stores-heading">
          <h1 id="stores-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Store Directory
          </h1>
        </section>
        <ErrorState title="Failed to load stores" message={errorMessage} />
      </div>
    );
  }

  // Gracefully fallback to demo stores when unauthenticated or in preview mode
  const demoStoreEntities: Store[] = DEMO_STORES.map((s) => ({
    id: s.id,
    orgId: "org-apex-01",
    name: s.name,
    region: s.territory,
    addressLine1: s.address,
    addressLine2: null,
    city: s.city,
    stateProvince: s.state,
    postalCode: "94103",
    countryCode: "US",
    latitude: s.coordinates.lat,
    longitude: s.coordinates.lng,
    active: s.status === "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));

  const isDemo = !isAuthenticated || !hasActiveOrg;
  const displayStores = isDemo ? demoStoreEntities : stores;
  const displayCanWrite = isAuthenticated && hasActiveOrg ? canWrite : true;

  return (
    <StoresDirectoryClient
      activeOrgId={activeOrgId ?? "org-apex-01"}
      canWrite={displayCanWrite}
      initialStores={displayStores}
      isDemo={isDemo}
    />
  );
}
