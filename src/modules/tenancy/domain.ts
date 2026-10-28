export const ORG_ROLES = ["admin", "manager", "field_employee"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["invited", "active", "deactivated"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const ORGANIZATION_STATUSES = ["active", "suspended", "archived"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

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
