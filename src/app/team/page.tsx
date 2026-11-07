import type { ReactNode } from "react";
import {
  TeamDirectoryClient,
  type TeamMemberDisplay,
} from "@/components/team/TeamDirectoryClient";
import { PermissionDeniedState } from "@/components/ui/PermissionDeniedState";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import { hasAnyPermission, hasPermission } from "@/modules/tenancy/authorization";
import type { OrganizationMembership } from "@/modules/tenancy/domain";
import { listMembersForOrg } from "@/modules/tenancy/service";

export default async function TeamPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository } = context;

  if (!hasAnyPermission(role, ["team.view.organization", "team.view.assigned"])) {
    return (
      <PermissionDeniedState
        title="Team Directory Restricted to Managers & Administrators"
        message="Employees are not permitted to view other employees' private information or organization directory records."
        currentRole={role}
        requiredPermission="team.view.assigned"
      />
    );
  }

  const isAdmin = hasPermission(role, "team.view.organization");
  let members: TeamMemberDisplay[] = [];
  let errorMessage: string | null = null;

  try {
    const membersResult = await listMembersForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: { limit: 100 },
      repository: tenancyRepository,
      scopeToAssignedTeam: !isAdmin,
    });

    const userIds = membersResult.items.map((m: OrganizationMembership) => m.userId);
    const profiles = tenancyRepository.getProfilesByUserIds
      ? await tenancyRepository.getProfilesByUserIds(userIds)
      : {};

    members = membersResult.items.map((m: OrganizationMembership) => {
      const prof = profiles[m.userId];
      const name = prof?.fullName || `User (${m.userId.slice(0, 8)})`;
      const email = prof?.email || "—";
      const managerProf = m.managerUserId ? profiles[m.managerUserId] : null;

      const title =
        m.role === "admin"
          ? "Workspace Administrator"
          : m.role === "manager"
            ? "Operations Manager"
            : "Field Merchandising Representative";

      return {
        id: m.id,
        userId: m.userId,
        name,
        email,
        role: m.role,
        status: m.status,
        managerUserId: m.managerUserId,
        managerName: managerProf?.fullName,
        title,
        createdAt: m.createdAt,
      };
    });
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load team members for the active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="team-heading">
          <h1 id="team-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Team &amp; Memberships
          </h1>
        </section>
        <ErrorState title="Failed to load team directory" message={errorMessage} />
      </div>
    );
  }

  return (
    <TeamDirectoryClient
      activeOrgId={activeOrgId}
      activeOrgName={activeOrg.name}
      isAdmin={isAdmin}
      currentUserId={user.id}
      initialMembers={members}
    />
  );
}
