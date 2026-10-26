import Link from "next/link";
import type { ReactNode } from "react";
import { StoreDetailClient } from "@/components/stores/StoreDetailClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { Store } from "@/modules/stores/domain";
import { SupabaseStoresRepository } from "@/modules/stores/repository";
import { getStoreForOrg } from "@/modules/stores/service";

interface StoreDetailPageProps {
  params: Promise<{ storeId: string }>;
}

export default async function StoreDetailPage(
  props: StoreDetailPageProps
): Promise<ReactNode> {
  const { storeId } = await props.params;
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, role, tenancyRepository, supabase } = context;

  const canWrite = role === "admin" || role === "manager";
  let store: Store | null = null;
  let errorMessage: string | null = null;

  try {
    const storesRepository = new SupabaseStoresRepository(supabase);
    store = await getStoreForOrg({
      user,
      candidateOrgId: activeOrgId,
      candidateStoreId: storeId,
      tenancyRepository,
      storesRepository,
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unable to load store details.";
  }

  if (errorMessage || !store) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Link href="/stores" className="card-meta">
          ← Back to Store Directory
        </Link>
        <ErrorState
          title="Store not found"
          message={errorMessage ?? "Store not found in your active organization."}
        />
      </div>
    );
  }

  return (
    <StoreDetailClient store={store} activeOrgId={activeOrgId} canWrite={canWrite} />
  );
}
