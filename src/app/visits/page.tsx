import type { ReactNode } from "react";
import { VisitsListClient } from "@/components/visits/VisitsListClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { Visit } from "@/modules/visits/domain";
import { SupabaseVisitsRepository } from "@/modules/visits/repository";
import { listVisitsForOrg } from "@/modules/visits/service";

export default async function VisitsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, tenancyRepository, supabase } = context;

  let visits: readonly Visit[] = [];
  let errorMessage: string | null = null;

  try {
    const visitsRepository = new SupabaseVisitsRepository(supabase);
    const result = await listVisitsForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { limit: 100 },
      tenancyRepository,
      visitsRepository,
    });

    visits = result.items;
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load store visits for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="visits-heading">
          <h1 id="visits-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Store Visits &amp; Execution
          </h1>
        </section>
        <ErrorState title="Failed to load store visits" message={errorMessage} />
      </div>
    );
  }

  return (
    <VisitsListClient
      initialVisits={visits}
      activeOrgId={activeOrgId}
      activeOrgName={activeOrg.name}
    />
  );
}
