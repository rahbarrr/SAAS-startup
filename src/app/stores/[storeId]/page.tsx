import Link from "next/link";
import type { ReactNode } from "react";
import { StoreDetailClient } from "@/components/stores/StoreDetailClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { getStoreForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

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

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/stores" className="card-meta">
          ← Back to Store Directory
        </Link>
        <ErrorState title="Store not found" message={errorMessage} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <EmptyState
          title="Sign in to view store details"
          description="Store records require an active organization session."
        />
      </div>
    );
  }

  if (!hasActiveOrg || !activeOrgId || !store) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <EmptyState
          title="Store not found"
          description="The requested store was not found in your active organization."
        />
      </div>
    );
  }

  return (
    <StoreDetailClient store={store} activeOrgId={activeOrgId} canWrite={canWrite} />
  );
}
