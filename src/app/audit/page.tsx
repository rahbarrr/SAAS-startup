import type { ReactNode } from "react";
import { AuditLogViewerClient } from "@/components/audit/AuditLogViewerClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type { OrganizationAuditEvent } from "@/modules/audit/domain";
import { SupabaseAuditRepository } from "@/modules/audit/repository";
import { listAuditEventsForOrg } from "@/modules/audit/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

export default async function AuditPage(): Promise<ReactNode> {
  let activeOrgId: string = "22222222-2222-4222-8222-222222222222";
  let activeOrgName: string = "Apex Retail Solutions (Demo)";
  let userRole: string = "admin";
  let initialEvents: OrganizationAuditEvent[] = [];
  let initialCursor: string | null = null;
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
        activeOrgName = workspace.activeOrganization.organization.name;
        userRole = workspace.activeOrganization.membership.role;

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
      }
    }
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Unable to load enterprise audit log.";
  }

  if (errorMessage && !activeOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", color: "var(--brand-dark)" }}>
          Audit Trail &amp; Governance
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
          Enterprise Audit Trail &amp; Governance
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Real-time, immutable audit record of critical operational actions across {activeOrgName}
        </p>
      </div>

      <AuditLogViewerClient
        orgId={activeOrgId}
        initialEvents={initialEvents}
        initialCursor={initialCursor}
        userRole={userRole}
      />
    </div>
  );
}
