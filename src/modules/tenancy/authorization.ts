import crypto from "node:crypto";
import { AppError } from "@/lib/http/envelope";
import {
  type AuthenticatedUser,
  type OrgAction,
  type OrgRole,
  ROLE_PERMISSIONS,
  type TenantContext,
} from "./domain";
import type { TenancyRepository } from "./repository";
import { orgIdParamSchema } from "./schemas";

export interface ResolveTenantContextInput {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  repository: TenancyRepository;
}

/**
 * Resolves and verifies tenant access from server-side membership state.
 * Never trusts a client-supplied orgId without verifying an active membership row for the authenticated user.
 */
export async function resolveTenantContext(
  input: ResolveTenantContextInput
): Promise<TenantContext> {
  if (!input.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required to access organization resources",
      401
    );
  }

  const parsedOrg = orgIdParamSchema.safeParse({ orgId: input.candidateOrgId });
  if (!parsedOrg.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid organization identifier",
      400,
      parsedOrg.error.flatten()
    );
  }

  const { orgId } = parsedOrg.data;
  const membership = await input.repository.getMembershipByUserAndOrg(
    input.user.id,
    orgId
  );

  if (!membership) {
    throw new AppError(
      "FORBIDDEN_ORG_ACCESS",
      "You do not have access to this organization",
      403
    );
  }

  if (membership.status !== "active") {
    throw new AppError(
      "MEMBERSHIP_INACTIVE",
      `Your membership in this organization is ${membership.status}`,
      403
    );
  }

  return {
    user: input.user,
    orgId: membership.orgId,
    membershipId: membership.id,
    role: membership.role,
    status: "active",
  };
}

export function hasOrgPermission(role: OrgRole, action: OrgAction): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}

export function requireOrgPermission(context: TenantContext, action: OrgAction): void {
  if (!hasOrgPermission(context.role, action)) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      `Role '${context.role}' is not permitted to perform '${action}'`,
      403
    );
  }
}

export function requireAnyOrgRole(
  context: TenantContext,
  allowedRoles: readonly OrgRole[]
): void {
  if (!allowedRoles.includes(context.role)) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      `Required one of roles [${allowedRoles.join(", ")}], but current role is '${context.role}'`,
      403
    );
  }
}

/**
 * Verifies that an optional managerUserId belongs to the SAME organization,
 * is an active member, and holds a managerial role ('admin' or 'manager').
 */
export async function assertValidManagerInOrg(params: {
  orgId: string;
  memberUserId: string;
  managerUserId: string | null | undefined;
  repository: TenancyRepository;
}): Promise<void> {
  const { orgId, memberUserId, managerUserId, repository } = params;
  if (!managerUserId) {
    return;
  }

  if (managerUserId === memberUserId) {
    throw new AppError("VALIDATION_ERROR", "A member cannot be their own manager", 400);
  }

  const managerMembership = await repository.getMembershipByUserAndOrg(
    managerUserId,
    orgId
  );

  if (!managerMembership || managerMembership.status !== "active") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Assigned manager must be an active member of the same organization",
      400
    );
  }

  if (managerMembership.role !== "admin" && managerMembership.role !== "manager") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Assigned manager must have role 'admin' or 'manager' in the organization",
      400
    );
  }
}

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}

export function generateRawInvitationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface TenantScopedResource {
  id: string;
  orgId: string;
  ownerUserId?: string;
}

/**
 * Validates that a target resource belongs to the caller's verified active organization,
 * and enforces resource ownership when `requireOwnership` is true (unless caller has manager/admin override).
 * Throws a uniform 404 NOT_FOUND if the resource is missing OR belongs to another tenant,
 * avoiding leaking whether another tenant's resource UUID exists.
 */
export function assertTenantResourceOwnership<T extends TenantScopedResource>(params: {
  context: TenantContext;
  resource: T | null | undefined;
  requireOwnership?: boolean;
  allowManagerOverride?: boolean;
}): T {
  const {
    context,
    resource,
    requireOwnership = false,
    allowManagerOverride = false,
  } = params;

  if (!resource || resource.orgId !== context.orgId) {
    throw new AppError(
      "NOT_FOUND",
      "The requested resource was not found in your active organization",
      404
    );
  }

  if (requireOwnership && resource.ownerUserId !== context.user.id) {
    const canOverride =
      allowManagerOverride && (context.role === "admin" || context.role === "manager");
    if (!canOverride) {
      throw new AppError(
        "FORBIDDEN_INSUFFICIENT_ROLE",
        "You do not have permission to modify another member's record",
        403
      );
    }
  }

  return resource;
}
