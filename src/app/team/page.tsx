import type { ReactNode } from "react";
import { InviteMemberPanel } from "@/components/team/InviteMemberPanel";
import { EmptyState, ErrorState } from "@/components/ui/States";
import {
  getMembershipStatusDescriptor,
  getOrgRoleDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { formatUtcTimestamp } from "@/lib/ux/formatting-and-resilience";
import type { MemberProfile, OrganizationMembership } from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import {
  listMembersForOrg,
  resolveActiveWorkspaceForUser,
} from "@/modules/tenancy/service";

export default async function TeamPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let isAdmin = false;
  let members: readonly OrganizationMembership[] = [];
  let profiles: Record<string, MemberProfile> = {};
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
        activeOrgName = workspace.activeOrganization.organization.name;
        isAdmin = workspace.activeOrganization.membership.role === "admin";

        const membersResult = await listMembersForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: { limit: 100 },
          repository: tenancyRepository,
        });

        members = membersResult.items;

        const userIds = members.map((m) => m.userId);
        if (userIds.length > 0 && tenancyRepository.getProfilesByUserIds) {
          profiles = await tenancyRepository.getProfilesByUserIds(userIds);
        }
      }
    }
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

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="team-heading">
          <h1 id="team-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Team &amp; Memberships
          </h1>
          <p className="card-meta">
            Manage organization roles (Admin, Manager, Field Employee) and
            same-organization reporting lines.
          </p>
        </section>
        <EmptyState
          title="Sign in to view organization members"
          description="Organization membership lists are isolated per tenant and require an active authenticated membership."
        />
      </div>
    );
  }

  if (!hasActiveOrg || !activeOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="team-heading">
          <h1 id="team-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Organization Team &amp; Memberships
          </h1>
        </section>
        <EmptyState
          title="No active organization found"
          description="You must belong to an active organization to view team memberships."
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="team-heading">
        <div className="card-header">
          <div>
            <h1 id="team-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Organization Team &amp; Memberships
            </h1>
            <p className="card-meta">
              Active Organization: <strong>{activeOrgName}</strong> • {members.length}{" "}
              {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section aria-labelledby="invite-section-heading">
          <h2 id="invite-section-heading" className="sr-only">
            Invite Team Member
          </h2>
          <InviteMemberPanel orgId={activeOrgId} />
        </section>
      ) : null}

      <section aria-labelledby="members-list-heading" className="card">
        <div className="card-header" style={{ marginBottom: "0.5rem" }}>
          <h2 id="members-list-heading" style={{ margin: 0, fontSize: "1.25rem" }}>
            Team Directory
          </h2>
          <span className="card-meta">
            Role-Based Access Control &amp; Reporting Lines
          </span>
        </div>

        {members.length === 0 ? (
          <EmptyState
            title="No members found"
            description="No active memberships were found for this organization."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.875rem",
              }}
            >
              <caption className="sr-only">
                List of active team members in {activeOrgName}
              </caption>
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--border-default, #e5e7eb)",
                    color: "var(--text-muted, #6b7280)",
                  }}
                >
                  <th scope="col" style={{ padding: "0.75rem 0.5rem" }}>
                    Member
                  </th>
                  <th scope="col" style={{ padding: "0.75rem 0.5rem" }}>
                    Role
                  </th>
                  <th scope="col" style={{ padding: "0.75rem 0.5rem" }}>
                    Status
                  </th>
                  <th scope="col" style={{ padding: "0.75rem 0.5rem" }}>
                    Joined (UTC)
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const profile = profiles[member.userId];
                  const displayName =
                    profile?.fullName?.trim() ||
                    profile?.email ||
                    `Member (${member.userId.slice(0, 8)})`;
                  const email = profile?.email || null;

                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle, #f3f4f6)",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                        {email && email !== displayName ? (
                          <div
                            className="card-meta"
                            style={{ fontSize: "0.75rem", wordBreak: "break-all" }}
                          >
                            {email}
                          </div>
                        ) : null}
                        {member.managerUserId ? (
                          <div
                            className="card-meta"
                            style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}
                          >
                            Reports to:{" "}
                            {profiles[member.managerUserId]?.fullName ||
                              profiles[member.managerUserId]?.email ||
                              member.managerUserId.slice(0, 8)}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", whiteSpace: "nowrap" }}>
                        <StatusBadge descriptor={getOrgRoleDescriptor(member.role)} />
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", whiteSpace: "nowrap" }}>
                        <StatusBadge
                          descriptor={getMembershipStatusDescriptor(member.status)}
                        />
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 0.5rem",
                          color: "var(--text-muted, #6b7280)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatUtcTimestamp(member.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
