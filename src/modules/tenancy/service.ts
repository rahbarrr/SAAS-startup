import "server-only";
import { AppError } from "@/lib/http/envelope";
import {
  assertValidManagerInOrg,
  generateRawInvitationToken,
  hashInvitationToken,
  requireOrgPermission,
  resolveTenantContext,
} from "./authorization";
import type {
  ActiveWorkspaceResolution,
  AuthenticatedUser,
  CreatedInvitationResult,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "./domain";
import type { PaginatedMembersResult, TenancyRepository } from "./repository";
import {
  acceptOrgInvitationInputSchema,
  addOrgMemberInputSchema,
  createOrganizationInputSchema,
  createOrgInvitationInputSchema,
  listOrgMembersQuerySchema,
  switchActiveOrgInputSchema,
} from "./schemas";

export async function listUserOrganizationsForCaller(params: {
  user: AuthenticatedUser | null;
  repository: TenancyRepository;
}): Promise<UserOrganizationSummary[]> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required to list organizations",
      401
    );
  }

  const all = await params.repository.listUserOrganizations(params.user.id);
  return all.filter(
    (entry) =>
      entry.membership.status === "active" &&
      entry.organization.status === "active"
  );
}

/**
 * Resolves the active organization for the caller's session from server-verified active memberships.
 * If `preferredOrgId` (e.g. from cookie) matches one of the caller's active organizations, it is selected;
 * otherwise falls back to the caller's first active organization (or null if none exist).
 */
export async function resolveActiveWorkspaceForUser(params: {
  user: AuthenticatedUser | null;
  preferredOrgId?: string | null;
  repository: TenancyRepository;
}): Promise<ActiveWorkspaceResolution> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required to resolve workspace organization",
      401
    );
  }

  const organizations = await listUserOrganizationsForCaller({
    user: params.user,
    repository: params.repository,
  });

  if (organizations.length === 0) {
    return {
      activeOrganization: null,
      organizations: [],
    };
  }

  const matched = params.preferredOrgId
    ? organizations.find(
        (entry) => entry.organization.id === params.preferredOrgId
      )
    : undefined;

  return {
    activeOrganization: matched ?? organizations[0] ?? null,
    organizations,
  };
}

/**
 * Explicitly switches the caller's active organization after verifying an active membership.
 * Returns a uniform FORBIDDEN_ORG_ACCESS error if the user is not an active member of `orgId`,
 * without leaking whether `orgId` exists for another tenant.
 */
export async function switchActiveOrganizationForCaller(params: {
  user: AuthenticatedUser | null;
  rawInput: unknown;
  repository: TenancyRepository;
}): Promise<UserOrganizationSummary> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required to switch organizations",
      401
    );
  }

  const { orgId } = switchActiveOrgInputSchema.parse(params.rawInput);
  const organizations = await listUserOrganizationsForCaller({
    user: params.user,
    repository: params.repository,
  });

  const target = organizations.find((entry) => entry.organization.id === orgId);
  if (!target) {
    throw new AppError(
      "FORBIDDEN_ORG_ACCESS",
      "You do not have access to the requested organization",
      403
    );
  }

  return target;
}

export async function createOrganizationForCaller(params: {
  user: AuthenticatedUser | null;
  rawInput: unknown;
  repository: TenancyRepository;
}): Promise<Organization> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required to create an organization",
      401
    );
  }

  const input = createOrganizationInputSchema.parse(params.rawInput);
  return params.repository.createOrganizationWithOwner(params.user.id, input);
}

export async function listMembersForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  repository: TenancyRepository;
}): Promise<PaginatedMembersResult> {
  const tenantContext = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.repository,
  });

  requireOrgPermission(tenantContext, "members:read");

  const query = listOrgMembersQuerySchema.parse(params.rawQuery);
  return params.repository.listOrgMembers(tenantContext.orgId, query);
}

export async function addMemberToOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  repository: TenancyRepository;
}): Promise<OrganizationMembership> {
  const tenantContext = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.repository,
  });

  requireOrgPermission(tenantContext, "members:manage");

  const input = addOrgMemberInputSchema.parse(params.rawInput);

  await assertValidManagerInOrg({
    orgId: tenantContext.orgId,
    memberUserId: input.userId,
    managerUserId: input.managerUserId,
    repository: params.repository,
  });

  return params.repository.addOrgMember(tenantContext.orgId, input);
}

export async function createInvitationForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  repository: TenancyRepository;
  now?: Date;
}): Promise<CreatedInvitationResult> {
  const tenantContext = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.repository,
  });

  requireOrgPermission(tenantContext, "members:manage");

  const input = createOrgInvitationInputSchema.parse(params.rawInput);
  const rawToken = generateRawInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const baseTime = params.now ?? new Date();
  const expiresAt = new Date(
    baseTime.getTime() + input.expiresInHours * 60 * 60 * 1000
  ).toISOString();

  const created = await params.repository.createOrgInvitation({
    orgId: tenantContext.orgId,
    invitedBy: tenantContext.user.id,
    invitedEmail: input.email,
    role: input.role,
    tokenHash,
    expiresAt,
  });

  const { tokenHash: _redactedHash, ...safeInvitation } = created;
  return {
    invitation: safeInvitation,
    inviteToken: rawToken,
  };
}

export async function acceptInvitationForCaller(params: {
  user: AuthenticatedUser | null;
  rawInput: unknown;
  repository: TenancyRepository;
  now?: Date;
}): Promise<OrganizationMembership> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Please sign in before accepting an organization invitation",
      401
    );
  }

  const input = acceptOrgInvitationInputSchema.parse(params.rawInput);
  const tokenHash = hashInvitationToken(input.token);

  return params.repository.acceptOrgInvitationByTokenHash({
    user: params.user,
    tokenHash,
    nowIso: (params.now ?? new Date()).toISOString(),
  });
}
