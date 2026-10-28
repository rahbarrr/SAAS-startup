import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
  throwIfBillingEntitlementError,
} from "@/lib/http/envelope";
import { logger } from "@/lib/observability/logger";
import type {
  DbOrganizationInvitationRow,
  DbOrganizationMemberRow,
  DbOrganizationRow,
} from "@/types/database";
import type {
  AuthenticatedUser,
  MemberProfile,
  MembershipStatus,
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  OrgRole,
  UserOrganizationSummary,
} from "./domain";
import type {
  AddOrgMemberInput,
  CreateOrganizationInput,
  ListOrgMembersQuery,
} from "./schemas";

export interface PaginatedMembersResult {
  items: OrganizationMembership[];
  pagination: CursorPaginationMeta;
}

export interface CreateInvitationRecordInput {
  orgId: string;
  invitedBy: string;
  invitedEmail: string;
  role: OrgRole;
  tokenHash: string;
  expiresAt: string;
}

export interface TenancyRepository {
  getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null>;
  listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]>;
  createOrganizationWithOwner(
    userId: string,
    input: CreateOrganizationInput
  ): Promise<Organization>;
  listOrgMembers(
    orgId: string,
    query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult>;
  addOrgMember(orgId: string, input: AddOrgMemberInput): Promise<OrganizationMembership>;
  createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation>;
  acceptOrgInvitationByTokenHash(params: {
    user: AuthenticatedUser;
    tokenHash: string;
    nowIso?: string;
  }): Promise<OrganizationMembership>;
  getProfilesByUserIds?(userIds: string[]): Promise<Record<string, MemberProfile>>;
  isEmailActiveMemberOfOrg?(orgId: string, email: string): Promise<boolean>;
}

function mapOrganizationRow(row: DbOrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    industry: row.industry,
    companySize: row.company_size,
    country: row.country,
    website: row.website,
    phone: row.phone,
  };
}

function mapMembershipRow(row: DbOrganizationMemberRow): OrganizationMembership {
  return {
    id: row.id,
    orgId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    managerUserId: row.manager_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvitationRow(row: DbOrganizationInvitationRow): OrganizationInvitation {
  return {
    id: row.id,
    orgId: row.organization_id,
    invitedEmail: row.invited_email,
    role: row.role,
    tokenHash: row.token_hash,
    invitedBy: row.invited_by,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseTenancyRepository implements TenancyRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private async tryRecordAuditEvent(params: {
    orgId: string;
    actorUserId: string | null;
    actorRole: OrgRole | null;
    actionType: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.supabase.from("organization_audit_events").insert({
        organization_id: params.orgId,
        actor_user_id: params.actorUserId,
        actor_role: params.actorRole,
        action_type: params.actionType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        changes: {},
        metadata: params.metadata ?? {},
      });
    } catch {
      // Best-effort audit recording
    }
  }

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select(
        "id, organization_id, user_id, role, status, manager_user_id, created_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle<DbOrganizationMemberRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to load organization membership", 500);
    }

    return data ? mapMembershipRow(data) : null;
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        status,
        manager_user_id,
        created_at,
        updated_at,
        organizations!inner (
          id,
          name,
          slug,
          status,
          created_by,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list user organizations", 500);
    }

    return (data ?? []).map((row) => {
      const orgData = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!orgData) {
        throw new AppError("INTERNAL_ERROR", "Missing joined organization record", 500);
      }

      return {
        organization: mapOrganizationRow(orgData as DbOrganizationRow),
        membership: mapMembershipRow({
          id: row.id as string,
          organization_id: row.organization_id as string,
          user_id: row.user_id as string,
          role: row.role as OrgRole,
          status: row.status as MembershipStatus,
          manager_user_id: (row.manager_user_id as string | null) ?? null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        }),
      };
    });
  }

  async createOrganizationWithOwner(
    userId: string,
    input: CreateOrganizationInput
  ): Promise<Organization> {
    const { data, error } = await this.supabase
      .rpc("create_organization_with_company_profile", {
        p_name: input.name,
        p_slug: input.slug,
        p_industry: input.industry,
        p_company_size: input.companySize,
        p_country: input.country,
        p_website: input.website || null,
        p_phone: input.phone || null,
      })
      .single<DbOrganizationRow>();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Organization subscription is inactive or expired")) {
        throw new AppError("BILLING_SUBSCRIPTION_INACTIVE", msg, 402);
      }
      if (msg.includes("Workspace seat limit reached")) {
        throw new AppError("BILLING_SEAT_LIMIT_EXCEEDED", msg, 402);
      }
      if (msg.includes("Organization creation limit reached")) {
        throw new AppError(
          "FORBIDDEN_INSUFFICIENT_ROLE",
          "This account has reached the workspace creation limit.",
          403
        );
      }
      if (error.code === "23505") {
        throw new AppError(
          "CONFLICT",
          `Organization slug '${input.slug}' is already taken`,
          409
        );
      }
      throw new AppError("INTERNAL_ERROR", "Failed to create organization", 500);
    }

    const organization = mapOrganizationRow(data);
    await this.tryRecordAuditEvent({
      orgId: organization.id,
      actorUserId: userId,
      actorRole: "admin",
      actionType: "org.created",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        name: organization.name,
        slug: organization.slug,
        industry: organization.industry,
        companySize: organization.companySize,
        country: organization.country,
      },
    });

    return organization;
  }

  async listOrgMembers(
    orgId: string,
    query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    const pageSize = query.limit;
    let builder = this.supabase
      .from("organization_members")
      .select(
        "id, organization_id, user_id, role, status, manager_user_id, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (query.role) {
      builder = builder.eq("role", query.role);
    }
    if (query.status) {
      builder = builder.eq("status", query.status);
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      builder = builder.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
      );
    }

    const { data, error } = await builder.returns<DbOrganizationMemberRow[]>();
    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list organization members", 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapMembershipRow);
    const lastItem = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: pageSize,
        nextCursor:
          hasMore && lastItem
            ? encodeCursor({ createdAt: lastItem.createdAt, id: lastItem.id })
            : null,
      },
    };
  }

  async addOrgMember(
    orgId: string,
    input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .insert({
        organization_id: orgId,
        user_id: input.userId,
        role: input.role,
        status: input.status,
        manager_user_id: input.managerUserId ?? null,
      })
      .select(
        "id, organization_id, user_id, role, status, manager_user_id, created_at, updated_at"
      )
      .single<DbOrganizationMemberRow>();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Organization subscription is inactive or expired")) {
        throw new AppError("BILLING_SUBSCRIPTION_INACTIVE", msg, 402);
      }
      if (msg.includes("Workspace seat limit reached")) {
        throw new AppError("BILLING_SEAT_LIMIT_EXCEEDED", msg, 402);
      }
      if (error.code === "23505") {
        throw new AppError(
          "CONFLICT",
          "User is already a member of this organization",
          409
        );
      }
      throw new AppError("INTERNAL_ERROR", "Failed to add organization member", 500);
    }

    const membership = mapMembershipRow(data);
    await this.tryRecordAuditEvent({
      orgId,
      actorUserId: null,
      actorRole: "admin",
      actionType: "member.added",
      entityType: "member",
      entityId: membership.id,
      metadata: {
        userId: membership.userId,
        role: membership.role,
        status: membership.status,
      },
    });
    return membership;
  }

  async isEmailActiveMemberOfOrg(orgId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle<{ id: string }>();

    if (!profile?.id) {
      return false;
    }

    const { data: membership } = await this.supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", profile.id)
      .eq("status", "active")
      .maybeSingle<{ id: string }>();

    return Boolean(membership?.id);
  }

  async createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    const normalizedEmail = input.invitedEmail.toLowerCase().trim();

    // Revoke any prior pending invitations for this email in this organization
    const { error: revokeError } = await this.supabase
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("organization_id", input.orgId)
      .eq("invited_email", normalizedEmail)
      .eq("status", "pending");

    if (revokeError) {
      logger.warn("Failed to revoke prior pending invitation", {
        orgId: input.orgId,
        errorCode: revokeError.code,
        message: revokeError.message,
      });
    }

    const { data, error } = await this.supabase
      .from("organization_invitations")
      .insert({
        organization_id: input.orgId,
        invited_email: normalizedEmail,
        role: input.role,
        token_hash: input.tokenHash,
        invited_by: input.invitedBy,
        status: "pending",
        expires_at: input.expiresAt,
      })
      .select(
        "id, organization_id, invited_email, role, token_hash, invited_by, status, expires_at, accepted_at, accepted_by, created_at, updated_at"
      )
      .single<DbOrganizationInvitationRow>();

    if (error) {
      logger.error("Database error creating organization invitation", {
        orgId: input.orgId,
        errorCode: error.code,
        errorMessage: error.message,
      });

      const msg = error.message ?? "";
      if (msg.includes("Organization subscription is inactive or expired")) {
        throw new AppError("BILLING_SUBSCRIPTION_INACTIVE", msg, 402);
      }
      if (msg.includes("Workspace seat limit reached")) {
        throw new AppError("BILLING_SEAT_LIMIT_EXCEEDED", msg, 402);
      }
      if (error.code === "23505") {
        throw new AppError(
          "CONFLICT",
          "An active invitation already exists for this email address.",
          409
        );
      }
      if (error.code === "42501") {
        throw new AppError(
          "FORBIDDEN_INSUFFICIENT_ROLE",
          "You do not have permission to invite members to this organization.",
          403
        );
      }
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to create organization invitation",
        500
      );
    }

    const invitation = mapInvitationRow(data);
    await this.tryRecordAuditEvent({
      orgId: input.orgId,
      actorUserId: input.invitedBy,
      actorRole: "admin",
      actionType: "member.invited",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: {
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
      },
    });
    return invitation;
  }

  async acceptOrgInvitationByTokenHash(params: {
    user: AuthenticatedUser;
    tokenHash: string;
  }): Promise<OrganizationMembership> {
    const { data, error } = await this.supabase
      .rpc("accept_organization_invitation", {
        p_token_hash: params.tokenHash,
      })
      .single<DbOrganizationMemberRow>();

    if (error) {
      throwIfBillingEntitlementError(error);
      const msg = error.message.toLowerCase();
      if (msg.includes("expired") && !msg.includes("invalid")) {
        throw new AppError(
          "INVITATION_EXPIRED",
          "This invitation has expired. Please request a new invitation from your organization administrator.",
          400
        );
      }
      if (msg.includes("email does not match")) {
        throw new AppError(
          "INVITATION_EMAIL_MISMATCH",
          "This invitation was issued for a different email address.",
          403
        );
      }
      if (msg.includes("already been used") || msg.includes("invalid")) {
        throw new AppError(
          "INVITATION_INVALID",
          "This invitation link is invalid or has already been used.",
          400
        );
      }
      throw new AppError(
        "INVITATION_INVALID",
        "Unable to accept invitation. Please verify the link or contact your administrator.",
        400
      );
    }

    const membership = mapMembershipRow(data);
    await this.tryRecordAuditEvent({
      orgId: membership.orgId,
      actorUserId: params.user.id,
      actorRole: membership.role,
      actionType: "invitation.accepted",
      entityType: "member",
      entityId: membership.id,
      metadata: {
        userId: params.user.id,
        email: params.user.email,
        role: membership.role,
      },
    });
    return membership;
  }

  async getProfilesByUserIds(userIds: string[]): Promise<Record<string, MemberProfile>> {
    if (userIds.length === 0) return {};
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    if (error || !data) {
      return {};
    }

    const result: Record<string, MemberProfile> = {};
    for (const row of data as { id: string; email: string; full_name: string }[]) {
      result[row.id] = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
      };
    }
    return result;
  }
}
