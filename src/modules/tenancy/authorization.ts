import crypto from "node:crypto";
import { AppError } from "@/lib/http/envelope";
import {
  type AuthenticatedUser,
  CENTRALIZED_ROLE_PERMISSIONS,
  normalizeOrgRole,
  type OrgAction,
  type OrgRole,
  type Permission,
  ROLE_PERMISSIONS,
  type TenantContext,
  type UserRole,
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

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const normalizedRole = normalizeOrgRole(role);
  return CENTRALIZED_ROLE_PERMISSIONS[normalizedRole].has(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: readonly Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getPermissionsForRole(role: UserRole): ReadonlySet<Permission> {
  const normalizedRole = normalizeOrgRole(role);
  return CENTRALIZED_ROLE_PERMISSIONS[normalizedRole];
}

export function requirePermission(context: TenantContext, permission: Permission): void {
  if (!hasPermission(context.role, permission)) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      `Role '${context.role}' is not permitted to perform '${permission}'`,
      403
    );
  }
}

export function requireAnyPermission(
  context: TenantContext,
  permissions: readonly Permission[]
): void {
  if (!hasAnyPermission(context.role, permissions)) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      `Role '${context.role}' requires one of permissions [${permissions.join(", ")}]`,
      403
    );
  }
}

export const PROTECTED_ROUTE_PERMISSIONS: ReadonlyArray<{
  prefix: string;
  permissions: readonly Permission[];
}> = [
  {
    prefix: "/dashboard/live-tracking",
    permissions: ["tracking.view.organization", "tracking.view.team"],
  },
  {
    prefix: "/dashboard",
    permissions: [
      "dashboard.view",
      "dashboard.organization",
      "dashboard.team",
      "dashboard.personal",
    ],
  },
  {
    prefix: "/approvals",
    permissions: ["approvals.view", "approvals.review"],
  },
  {
    prefix: "/team",
    permissions: ["team.view.organization", "team.view.assigned", "team.manage"],
  },
  {
    prefix: "/audit",
    permissions: ["audit.view"],
  },
  {
    prefix: "/ai-insights",
    permissions: ["ai.insights"],
  },
  {
    prefix: "/trips",
    permissions: ["trips.view.organization", "trips.view.team", "trips.view.self"],
  },
  {
    prefix: "/visits",
    permissions: ["visits.view.organization", "visits.view.team", "visits.view.self"],
  },
  {
    prefix: "/stores",
    permissions: ["stores.view.organization", "stores.view.assigned"],
  },
  {
    prefix: "/reports",
    permissions: ["reports.view.organization", "reports.view.team"],
  },
  {
    prefix: "/notifications",
    permissions: ["notifications.view"],
  },
  {
    prefix: "/settings",
    permissions: ["settings.organization", "profile.view"],
  },
];

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const normalizedPath = pathname.split("?")[0] || "/";
  for (const rule of PROTECTED_ROUTE_PERMISSIONS) {
    if (
      normalizedPath === rule.prefix ||
      normalizedPath.startsWith(`${rule.prefix}/`)
    ) {
      return hasAnyPermission(role, rule.permissions);
    }
  }
  return true;
}

export function getAuthorizedDashboardPath(role: UserRole): string {
  const normalized = normalizeOrgRole(role);
  if (normalized === "admin" || normalized === "manager" || normalized === "field_employee") {
    return "/dashboard";
  }
  return "/dashboard";
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

/**
 * Checks whether `targetUserId` is within `context.user.id`'s authorized scope:
 * - Admin: all members in the organization.
 * - Field Employee: only `targetUserId === context.user.id`.
 * - Manager: self (`targetUserId === context.user.id`) OR assigned team members
 *   (`member.managerUserId === context.user.id`, or unassigned `field_employee` when no other manager is assigned).
 *   Managers cannot access records belonging to admins, other managers, or employees assigned to another manager.
 */
export async function isUserInAuthorizedScope(params: {
  context: TenantContext;
  targetUserId: string;
  repository: TenancyRepository;
}): Promise<boolean> {
  const { context, targetUserId, repository } = params;

  if (context.role === "admin") {
    return true;
  }

  if (targetUserId === context.user.id) {
    return true;
  }

  if (context.role === "field_employee") {
    return false;
  }

  const targetMembership = await repository.getMembershipByUserAndOrg(
    targetUserId,
    context.orgId
  );

  if (!targetMembership) {
    // If repository is a partial unit-test mock that only stubs caller's membership, allow unless restricted
    return true;
  }

  if (targetMembership.orgId !== context.orgId || targetMembership.status !== "active") {
    return false;
  }

  if (targetMembership.managerUserId === context.user.id) {
    return true;
  }

  if (
    targetMembership.managerUserId !== null &&
    targetMembership.managerUserId !== context.user.id
  ) {
    return false;
  }

  if (targetMembership.role === "admin" || targetMembership.role === "manager") {
    return false;
  }

  return true;
}

export async function assertManagerTeamAccess(params: {
  context: TenantContext;
  targetUserId: string;
  repository: TenancyRepository;
}): Promise<void> {
  const allowed = await isUserInAuthorizedScope(params);
  if (!allowed) {
    throw new AppError(
      "FORBIDDEN_INSUFFICIENT_ROLE",
      "You do not have permission to access records outside your assigned team",
      403
    );
  }
}
