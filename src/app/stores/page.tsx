import type { ReactNode } from "react";
import { StoresDirectoryClient } from "@/components/stores/StoresDirectoryClient";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

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

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="stores-heading">
          <h1 id="stores-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Store Directory
          </h1>
          <p className="card-meta">
            Manage active retail and FMCG locations scoped to your organization.
          </p>
        </section>
        <EmptyState
          title="Sign in to view stores"
          description="Store records are isolated per organization and require an active membership."
        />
      </div>
    );
  }

  if (!hasActiveOrg || !activeOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="stores-heading">
          <h1 id="stores-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Store Directory
          </h1>
        </section>
        <EmptyState
          title="No active organization found"
          description="You must belong to an active organization to access the store directory."
        />
      </div>
    );
  }

  return (
    <StoresDirectoryClient
      activeOrgId={activeOrgId}
      canWrite={canWrite}
      initialStores={stores}
    />
  );
}
