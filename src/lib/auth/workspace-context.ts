import "server-only";
import { redirect } from "next/navigation";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  OrgRole,
} from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveWorkspaceContext {
  supabase: SupabaseClient;
  user: AuthenticatedUser;
  activeOrgId: string;
  activeOrg: Organization;
  activeMembership: OrganizationMembership;
  role: OrgRole;
  tenancyRepository: SupabaseTenancyRepository;
}

/**
 * Enforces real Supabase authentication and active workspace membership.
 * If the user is unauthenticated, redirects to `/login`.
 * If the user is authenticated but not a member of any workspace, redirects to `/onboarding`.
 */
export async function requireActiveWorkspace(): Promise<ActiveWorkspaceContext> {
  const supabase = await createUserServerSupabaseClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const preferredOrgId = await getActiveOrgCookie();
  const tenancyRepository = new SupabaseTenancyRepository(supabase);
  const workspace = await resolveActiveWorkspaceForUser({
    user,
    preferredOrgId,
    repository: tenancyRepository,
  });

  if (!workspace.activeOrganization) {
    redirect("/onboarding");
  }

  return {
    supabase,
    user,
    activeOrgId: workspace.activeOrganization.organization.id,
    activeOrg: workspace.activeOrganization.organization,
    activeMembership: workspace.activeOrganization.membership,
    role: workspace.activeOrganization.membership.role,
    tenancyRepository,
  };
}
