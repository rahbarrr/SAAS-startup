import type { ReactNode } from "react";
import { TeamDirectoryClient } from "@/components/team/TeamDirectoryClient";
import { ErrorState } from "@/components/ui/States";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

export default async function TeamPage(): Promise<ReactNode> {
  let activeOrgId: string | undefined;
  let activeOrgName: string | null = null;
  let isAdmin = false;
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
        isAdmin = workspace.activeOrganization.membership.role === "admin";
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

  const displayOrgName = activeOrgName ?? "Apex Retail Solutions (Demo)";

  return (
    <TeamDirectoryClient
      activeOrgId={activeOrgId}
      activeOrgName={displayOrgName}
      isAdmin={isAdmin}
    />
  );
}
