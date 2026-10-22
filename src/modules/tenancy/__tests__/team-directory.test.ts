import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/http/envelope";
import type {
  AuthenticatedUser,
  MemberProfile,
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type {
  CreateInvitationRecordInput,
  PaginatedMembersResult,
  TenancyRepository,
} from "@/modules/tenancy/repository";
import type { ListOrgMembersQuery } from "@/modules/tenancy/schemas";
import {
  listMembersForOrg,
  resolveActiveWorkspaceForUser,
} from "@/modules/tenancy/service";

class MockTeamTenancyRepository implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];
  public invitations: OrganizationInvitation[] = [];
  public profiles: Record<string, MemberProfile> = {};

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null;
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.memberships
      .filter((m) => m.userId === userId && m.status === "active")
      .map((membership) => {
        const organization = this.organizations.find((o) => o.id === membership.orgId);
        if (!organization) {
          throw new Error("Missing organization");
        }
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(): Promise<Organization> {
    throw new Error("Not implemented in mock");
  }

  async listOrgMembers(
    orgId: string,
    query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    const matched = this.memberships.filter((m) => m.orgId === orgId);
    return {
      items: matched.slice(0, query.limit),
      pagination: {
        hasMore: matched.length > query.limit,
        limit: query.limit,
        nextCursor: null,
      },
    };
  }

  async addOrgMember(): Promise<OrganizationMembership> {
    throw new Error("Not implemented in mock");
  }

  async createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    const record: OrganizationInvitation = {
      id: "inv-111",
      orgId: input.orgId,
      invitedEmail: input.invitedEmail,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      status: "pending",
      expiresAt: input.expiresAt,
      acceptedAt: null,
      acceptedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.invitations.push(record);
    return record;
  }

  async acceptOrgInvitationByTokenHash(): Promise<OrganizationMembership> {
    throw new Error("Not implemented in mock");
  }

  async getProfilesByUserIds(userIds: string[]): Promise<Record<string, MemberProfile>> {
    const result: Record<string, MemberProfile> = {};
    for (const id of userIds) {
      if (this.profiles[id]) {
        result[id] = this.profiles[id];
      }
    }
    return result;
  }
}

describe("Team Directory & Member Management Service", () => {
  let repository: MockTeamTenancyRepository;

  const ORG_ID = "11111111-1111-4111-8111-111111111111";
  const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";

  const ADMIN_USER: AuthenticatedUser = {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    email: "admin@fieldops.com",
  };

  const MANAGER_USER: AuthenticatedUser = {
    id: "bbbbbbbb-0000-4000-8000-000000000002",
    email: "manager@fieldops.com",
  };

  const REP_USER: AuthenticatedUser = {
    id: "cccccccc-0000-4000-8000-000000000003",
    email: "rep@fieldops.com",
  };

  const OUTSIDER_USER: AuthenticatedUser = {
    id: "dddddddd-0000-4000-8000-000000000004",
    email: "outsider@othercorp.com",
  };

  beforeEach(() => {
    repository = new MockTeamTenancyRepository();

    repository.organizations = [
      {
        id: ORG_ID,
        name: "Acme Retail Ops",
        slug: "acme-retail-ops",
        status: "active",
        createdBy: ADMIN_USER.id,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        id: OTHER_ORG_ID,
        name: "Other Enterprise",
        slug: "other-enterprise",
        status: "active",
        createdBy: OUTSIDER_USER.id,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    repository.memberships = [
      {
        id: "m-admin-01",
        orgId: ORG_ID,
        userId: ADMIN_USER.id,
        role: "admin",
        status: "active",
        managerUserId: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "m-mgr-01",
        orgId: ORG_ID,
        userId: MANAGER_USER.id,
        role: "manager",
        status: "active",
        managerUserId: ADMIN_USER.id,
        createdAt: "2026-10-02T00:00:00Z",
        updatedAt: "2026-10-02T00:00:00Z",
      },
      {
        id: "m-rep-01",
        orgId: ORG_ID,
        userId: REP_USER.id,
        role: "field_employee",
        status: "active",
        managerUserId: MANAGER_USER.id,
        createdAt: "2026-10-03T00:00:00Z",
        updatedAt: "2026-10-03T00:00:00Z",
      },
      {
        id: "m-outsider-01",
        orgId: OTHER_ORG_ID,
        userId: OUTSIDER_USER.id,
        role: "admin",
        status: "active",
        managerUserId: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    repository.profiles = {
      [ADMIN_USER.id]: {
        id: ADMIN_USER.id,
        email: ADMIN_USER.email,
        fullName: "Alice Admin",
      },
      [MANAGER_USER.id]: {
        id: MANAGER_USER.id,
        email: MANAGER_USER.email,
        fullName: "Mark Manager",
      },
      [REP_USER.id]: {
        id: REP_USER.id,
        email: REP_USER.email,
        fullName: "Rachel Rep",
      },
    };
  });

  it("lists all members for an authenticated active member of the organization", async () => {
    const result = await listMembersForOrg({
      user: MANAGER_USER,
      candidateOrgId: ORG_ID,
      rawQuery: { limit: 50 },
      repository,
    });

    expect(result.items).toHaveLength(3);
    const roles = result.items.map((m) => m.role);
    expect(roles).toEqual(["admin", "manager", "field_employee"]);
  });

  it("denies access to list members when caller is not a member of the organization", async () => {
    await expect(
      listMembersForOrg({
        user: OUTSIDER_USER,
        candidateOrgId: ORG_ID,
        rawQuery: { limit: 50 },
        repository,
      })
    ).rejects.toThrow(AppError);
  });

  it("denies access when unauthenticated", async () => {
    await expect(
      listMembersForOrg({
        user: null,
        candidateOrgId: ORG_ID,
        rawQuery: { limit: 50 },
        repository,
      })
    ).rejects.toThrow(AppError);
  });

  it("resolves active workspace and identifies whether caller is an admin", async () => {
    const adminWorkspace = await resolveActiveWorkspaceForUser({
      user: ADMIN_USER,
      preferredOrgId: ORG_ID,
      repository,
    });
    expect(adminWorkspace.activeOrganization?.membership.role).toBe("admin");

    const managerWorkspace = await resolveActiveWorkspaceForUser({
      user: MANAGER_USER,
      preferredOrgId: ORG_ID,
      repository,
    });
    expect(managerWorkspace.activeOrganization?.membership.role).toBe("manager");

    const repWorkspace = await resolveActiveWorkspaceForUser({
      user: REP_USER,
      preferredOrgId: ORG_ID,
      repository,
    });
    expect(repWorkspace.activeOrganization?.membership.role).toBe("field_employee");
  });

  it("fetches member profile metadata and links manager reporting hierarchy", async () => {
    const members = await listMembersForOrg({
      user: ADMIN_USER,
      candidateOrgId: ORG_ID,
      rawQuery: { limit: 50 },
      repository,
    });

    const userIds = members.items.map((m) => m.userId);
    const profiles = await repository.getProfilesByUserIds(userIds);

    expect(profiles[ADMIN_USER.id]?.fullName).toBe("Alice Admin");
    expect(profiles[MANAGER_USER.id]?.fullName).toBe("Mark Manager");
    expect(profiles[REP_USER.id]?.fullName).toBe("Rachel Rep");

    const repMember = members.items.find((m) => m.userId === REP_USER.id);
    expect(repMember).toBeDefined();
    const managerId = repMember?.managerUserId;
    expect(managerId).toBe(MANAGER_USER.id);
    if (managerId) {
      expect(profiles[managerId]?.fullName).toBe("Mark Manager");
    }
  });
});
