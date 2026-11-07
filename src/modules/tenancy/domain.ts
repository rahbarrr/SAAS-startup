export const ORG_ROLES = ["admin", "manager", "field_employee"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/**
 * Conceptual user role type supporting both the canonical DB enum (`field_employee`)
 * and the display/spec alias (`employee`).
 */
export type UserRole = OrgRole | "employee";

export function normalizeOrgRole(role: UserRole): OrgRole {
  return role === "employee" ? "field_employee" : role;
}

export function toDisplayRoleSlug(role: UserRole): "admin" | "manager" | "employee" {
  const normalized = normalizeOrgRole(role);
  return normalized === "field_employee" ? "employee" : normalized;
}

export const MEMBERSHIP_STATUSES = ["invited", "active", "deactivated"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const ORGANIZATION_STATUSES = ["active", "suspended", "archived"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "dashboard.organization",
  "dashboard.team",
  "dashboard.personal",
  "tracking.view.organization",
  "tracking.view.team",
  "tracking.view.self",
  "trips.view.organization",
  "trips.view.team",
  "trips.view.self",
  "trips.create",
  "trips.update",
  "trips.cancel",
  "approvals.view",
  "approvals.review",
  "visits.view.organization",
  "visits.view.team",
  "visits.view.self",
  "visits.checkin",
  "visits.checkout",
  "stores.view.organization",
  "stores.view.assigned",
  "stores.manage",
  "team.view.organization",
  "team.view.assigned",
  "team.manage",
  "reports.view.organization",
  "reports.view.team",
  "reports.view.self",
  "ai.insights",
  "notifications.view",
  "profile.view",
  "profile.update",
  "users.invite",
  "users.manage",
  "roles.manage",
  "settings.organization",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const CENTRALIZED_ROLE_PERMISSIONS: Readonly<
  Record<OrgRole, ReadonlySet<Permission>>
> = {
  admin: new Set<Permission>([
    "dashboard.view",
    "dashboard.organization",
    "tracking.view.organization",
    "tracking.view.team",
    "tracking.view.self",
    "trips.view.organization",
    "trips.view.team",
    "trips.view.self",
    "trips.create",
    "trips.update",
    "trips.cancel",
    "approvals.view",
    "approvals.review",
    "visits.view.organization",
    "visits.view.team",
    "visits.view.self",
    "visits.checkin",
    "visits.checkout",
    "stores.view.organization",
    "stores.view.assigned",
    "stores.manage",
    "team.view.organization",
    "team.view.assigned",
    "team.manage",
    "reports.view.organization",
    "reports.view.team",
    "reports.view.self",
    "ai.insights",
    "notifications.view",
    "profile.view",
    "profile.update",
    "users.invite",
    "users.manage",
    "roles.manage",
    "settings.organization",
    "audit.view",
  ]),
  manager: new Set<Permission>([
    "dashboard.view",
    "dashboard.team",
    "tracking.view.team",
    "tracking.view.self",
    "trips.view.team",
    "trips.view.self",
    "trips.create",
    "trips.update",
    "trips.cancel",
    "approvals.view",
    "approvals.review",
    "visits.view.team",
    "visits.view.self",
    "visits.checkin",
    "visits.checkout",
    "stores.view.assigned",
    "team.view.assigned",
    "reports.view.team",
    "reports.view.self",
    "notifications.view",
    "profile.view",
    "profile.update",
  ]),
  field_employee: new Set<Permission>([
    "dashboard.view",
    "dashboard.personal",
    "tracking.view.self",
    "trips.view.self",
    "trips.create",
    "trips.update",
    "trips.cancel",
    "visits.view.self",
    "visits.checkin",
    "visits.checkout",
    "stores.view.assigned",
    "reports.view.self",
    "notifications.view",
    "profile.view",
    "profile.update",
  ]),
};

export type OrgAction =
  | "org:read"
  | "org:update"
  | "members:read"
  | "members:manage"
  | "stores:read"
  | "stores:write"
  | "trips:read_own"
  | "trips:read_org"
  | "trips:create_own"
  | "trips:approve"
  | "visits:record_own"
  | "visits:review";

export const ROLE_PERMISSIONS: Readonly<Record<OrgRole, ReadonlySet<OrgAction>>> = {
  admin: new Set<OrgAction>([
    "org:read",
    "org:update",
    "members:read",
    "members:manage",
    "stores:read",
    "stores:write",
    "trips:read_own",
    "trips:read_org",
    "trips:create_own",
    "trips:approve",
    "visits:record_own",
    "visits:review",
  ]),
  manager: new Set<OrgAction>([
    "org:read",
    "members:read",
    "stores:read",
    "stores:write",
    "trips:read_own",
    "trips:read_org",
    "trips:create_own",
    "trips:approve",
    "visits:record_own",
    "visits:review",
  ]),
  field_employee: new Set<OrgAction>([
    "org:read",
    "members:read",
    "stores:read",
    "trips:read_own",
    "trips:create_own",
    "visits:record_own",
  ]),
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  industry?: string;
  companySize?: string;
  country?: string;
  website?: string | null;
  phone?: string | null;
}

export interface OrganizationMembership {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  status: MembershipStatus;
  managerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfile {
  id: string;
  email: string;
  fullName: string;
}

export interface UserOrganizationSummary {
  organization: Organization;
  membership: OrganizationMembership;
}

export interface OrganizationInvitation {
  id: string;
  orgId: string;
  invitedEmail: string;
  role: OrgRole;
  tokenHash: string;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedInvitationResult {
  invitation: Omit<OrganizationInvitation, "tokenHash">;
  inviteToken: string;
}

export interface ActiveWorkspaceResolution {
  activeOrganization: UserOrganizationSummary | null;
  organizations: UserOrganizationSummary[];
}

/**
 * Server-verified tenant context.
 * Can only be constructed after verifying both authentication and an active membership
 * in `orgId` from the database.
 */
export interface TenantContext {
  readonly user: AuthenticatedUser;
  readonly orgId: string;
  readonly membershipId: string;
  readonly role: OrgRole;
  readonly status: "active";
}
