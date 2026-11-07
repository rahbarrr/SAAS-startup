import type { ReactNode } from "react";
import { AuditLogViewerClient } from "@/components/audit/AuditLogViewerClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { listAuditEventsForOrg } from "@/modules/audit/service";
import { hasPermission } from "@/modules/tenancy/authorization";

export default async function AuditPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  if (!hasPermission(role, "audit.view")) {
    return (
      <PermissionDeniedState
        title="Audit Logs Restricted to Organization Administrators"
        message="Only organization administrators have permission to view or export immutable enterprise audit logs."
        currentRole={role}
        requiredPermission="audit.view"
      />
    );
  }

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
      requireAdminAuditPermission: true,
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
      <section className="page-header" aria-labelledby="audit-page-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">Compliance & Security</p>
          <h1 id="audit-page-heading" className="page-title">
            Enterprise Audit Trail &amp; Governance
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrg.name}</strong> • Immutable audit record of
            critical operational actions across your organization.
          </p>
        </div>
      </section>

      <AuditLogViewerClient
        orgId={activeOrgId}
        initialEvents={initialEvents}
        initialCursor={initialCursor}
        userRole={role}
      />
    </div>
  );
}
