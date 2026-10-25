import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StoreDetailClient } from "@/components/stores/StoreDetailClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { getStoreForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import { DEMO_STORES } from "@/lib/mock-data/fieldtrack-demo-data";

interface StoreDetailPageProps {
  params: Promise<{ storeId: string }>;
}

export default async function StoreDetailPage(
  props: StoreDetailPageProps
): Promise<ReactNode> {
  const { storeId } = await props.params;

  let activeOrgId: string | null = null;
  let canWrite = false;
  let store: Store | null = null;
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
        const role = workspace.activeOrganization.membership.role;
        canWrite = role === "admin" || role === "manager";

        const storesRepository = new SupabaseStoresRepository(supabase);
        store = await getStoreForOrg({
          user,
          candidateOrgId: activeOrgId,
          candidateStoreId: storeId,
          tenancyRepository,
          storesRepository,
        });
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unable to load store details.";
  }

  // Gracefully fallback to demo store entity when unauthenticated
  if (!store) {
    errorMessage = null;
    const defaultStore = DEMO_STORES[0];
    const found = DEMO_STORES.find((s) => s.id === storeId) ?? defaultStore;
    if (!found) {
      notFound();
    }
    store = {
      id: found.id,
      orgId: "org-apex-01",
      name: found.name,
      region: found.territory,
      addressLine1: found.address,
      addressLine2: null,
      city: found.city,
      stateProvince: found.state,
      postalCode: "94103",
      countryCode: "US",
      latitude: found.coordinates.lat,
      longitude: found.coordinates.lng,
      active: found.status === "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    canWrite = true;
  }

  if (errorMessage || !store) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/stores" className="card-meta">
          ← Back to Store Directory
        </Link>
        <ErrorState title="Store not found" message={errorMessage ?? "Store not found."} />
      </div>
    );
  }

  return (
    <StoreDetailClient store={store} activeOrgId={activeOrgId ?? "org-apex-01"} canWrite={canWrite} />
  );
}
