import type { ReactNode } from "react";
import { StoresDirectoryClient } from "@/components/stores/StoresDirectoryClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { listStoresForOrg } from "@/modules/stores/service";

export default async function StoresPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, role, tenancyRepository, supabase } = context;

  const canWrite = role === "admin" || role === "manager";
  let stores: readonly Store[] = [];
  let errorMessage: string | null = null;

  try {
    const storesRepository = new SupabaseStoresRepository(supabase);
    const result = await listStoresForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { limit: 100 },
      tenancyRepository,
      storesRepository,
    });

    stores = result.items;
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

  return (
    <StoresDirectoryClient
      activeOrgId={activeOrgId}
      canWrite={canWrite}
      initialStores={stores}
    />
  );
}
