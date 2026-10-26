import type { ReactNode } from "react";
import { AuditLogViewerClient } from "@/components/audit/AuditLogViewerClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { listAuditEventsForOrg } from "@/modules/audit/service";

export default async function AuditPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  let initialEvents: OrganizationAuditEvent[] = [];
  let initialCursor: string | null = null;
  let errorMessage: string | null = null;

  try {
    const auditRepository = new SupabaseAuditRepository(supabase);
    const result = await listAuditEventsForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { limit: 25 },
      tenancyRepository,
      auditRepository,
    });

    initialEvents = result.items;
    initialCursor = result.pagination.nextCursor;
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load enterprise audit log.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h1
          style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", color: "var(--brand-dark)" }}
        >
          Audit Trail &amp; Governance — {activeOrg.name}
        </h1>
        <ErrorState title="Failed to load audit trail" message={errorMessage} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1
          style={{
            margin: "0 0 0.25rem",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--brand-dark)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Enterprise Audit Trail &amp; Governance — {activeOrg.name}
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Real-time, immutable audit record of critical operational actions across{" "}
          {activeOrg.name}.
        </p>
      </div>

      <AuditLogViewerClient
        orgId={activeOrgId}
        initialEvents={initialEvents}
        initialCursor={initialCursor}
        userRole={role}
      />
    </div>
  );
}
