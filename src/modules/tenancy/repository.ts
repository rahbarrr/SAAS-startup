import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
} from "@/lib/http/envelope";
import type {
  DbOrganizationInvitationRow,
  DbOrganizationMemberRow,
  DbOrganizationRow,
} from "@/types/database";
import type {
  AuthenticatedUser,
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
  addOrgMember(
    orgId: string,
    input: AddOrgMemberInput
  ): Promise<OrganizationMembership>;
  createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation>;
  acceptOrgInvitationByTokenHash(params: {
    user: AuthenticatedUser;
    tokenHash: string;
    nowIso?: string;
  }): Promise<OrganizationMembership>;
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
  };
}

function mapMembershipRow(
  row: DbOrganizationMemberRow
): OrganizationMembership {
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

function mapInvitationRow(
  row: DbOrganizationInvitationRow
): OrganizationInvitation {
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
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to load organization membership",
        500
      );
    }

    return data ? mapMembershipRow(data) : null;
  }

  async listUserOrganizations(
    userId: string
  ): Promise<UserOrganizationSummary[]> {
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
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to list user organizations",
        500
      );
    }

    return (data ?? []).map((row) => {
      const orgData = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!orgData) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Missing joined organization record",
          500
        );
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
    _userId: string,
    input: CreateOrganizationInput
  ): Promise<Organization> {
    const { data, error } = await this.supabase
      .rpc("create_organization_with_owner", {
        p_name: input.name,
        p_slug: input.slug,
      })
      .single<DbOrganizationRow>();

    if (error) {
      if (error.code === "23505") {
        throw new AppError(
          "CONFLICT",
          `Organization slug '${input.slug}' is already taken`,
          409
        );
      }
      throw new AppError("INTERNAL_ERROR", "Failed to create organization", 500);
    }

    return mapOrganizationRow(data);
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
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to list organization members",
        500
      );
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
      if (error.code === "23505") {
        throw new AppError(
          "CONFLICT",
          "User is already a member of this organization",
          409
        );
      }
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to add organization member",
        500
      );
    }

    return mapMembershipRow(data);
  }

  async createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .insert({
        organization_id: input.orgId,
        invited_email: input.invitedEmail.toLowerCase().trim(),
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
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to create organization invitation",
        500
      );
    }

    return mapInvitationRow(data);
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

    return mapMembershipRow(data);
  }
}
