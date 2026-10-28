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
  acceptInvitationForCaller,
  createInvitationForOrg,
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

  async isEmailActiveMemberOfOrg(orgId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const userIds = Object.values(this.profiles)
      .filter((p) => p.email.toLowerCase() === normalizedEmail)
      .map((p) => p.id);
    return this.memberships.some(
      (m) => m.orgId === orgId && userIds.includes(m.userId) && m.status === "active"
    );
  }

  async createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    const normalizedEmail = input.invitedEmail.toLowerCase().trim();
    for (const inv of this.invitations) {
      if (
        inv.orgId === input.orgId &&
        inv.invitedEmail.toLowerCase() === normalizedEmail &&
        inv.status === "pending"
      ) {
        inv.status = "revoked";
      }
    }

    const record: OrganizationInvitation = {
      id: `inv-${this.invitations.length + 1}`,
      orgId: input.orgId,
      invitedEmail: normalizedEmail,
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

  async acceptOrgInvitationByTokenHash(params: {
    user: AuthenticatedUser;
    tokenHash: string;
    nowIso?: string;
  }): Promise<OrganizationMembership> {
    const invite = this.invitations.find((i) => i.tokenHash === params.tokenHash);
    if (!invite || invite.status !== "pending") {
      throw new AppError("INVITATION_INVALID", "Invalid or already used invitation", 400);
    }
    const now = params.nowIso ?? new Date().toISOString();
    if (invite.expiresAt <= now) {
      throw new AppError("INVITATION_EXPIRED", "Invitation has expired", 400);
    }
    if (invite.invitedEmail.toLowerCase() !== params.user.email.toLowerCase()) {
      throw new AppError("INVITATION_EMAIL_MISMATCH", "Email mismatch", 403);
    }
    invite.status = "accepted";
    invite.acceptedAt = now;
    invite.acceptedBy = params.user.id;

    const membership: OrganizationMembership = {
      id: `m-accepted-${this.memberships.length + 1}`,
      orgId: invite.orgId,
      userId: params.user.id,
      role: invite.role,
      status: "active",
      managerUserId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.push(membership);
    return membership;
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

  describe("Workspace Member Invitations", () => {
    it("allows authenticated admin to create and persist single-use invitation for field representative", async () => {
      const result = await createInvitationForOrg({
        user: ADMIN_USER,
        candidateOrgId: ORG_ID,
        rawInput: {
          email: "new.rep@fieldops.com",
          role: "field_employee",
          expiresInHours: 72,
        },
        repository,
      });

      expect(result.inviteToken).toBeDefined();
      expect(result.inviteToken.length).toBeGreaterThan(20);
      expect(result.invitation.invitedEmail).toBe("new.rep@fieldops.com");
      expect(result.invitation.role).toBe("field_employee");
      expect(result.invitation.status).toBe("pending");
      expect(
        (result.invitation as unknown as { tokenHash?: string }).tokenHash
      ).toBeUndefined();

      // Check record persisted in repository
      expect(repository.invitations).toHaveLength(1);
      const saved = repository.invitations[0];
      if (!saved) throw new Error("Expected saved invitation");
      expect(saved.invitedEmail).toBe("new.rep@fieldops.com");
      expect(saved.role).toBe("field_employee");
      expect(saved.invitedBy).toBe(ADMIN_USER.id);
      expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("denies invitation creation when caller is a manager (403 FORBIDDEN_INSUFFICIENT_ROLE)", async () => {
      await expect(
        createInvitationForOrg({
          user: MANAGER_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "candidate@fieldops.com",
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN_INSUFFICIENT_ROLE",
        status: 403,
      });
    });

    it("denies invitation creation when caller is a field representative (403 FORBIDDEN_INSUFFICIENT_ROLE)", async () => {
      await expect(
        createInvitationForOrg({
          user: REP_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "candidate@fieldops.com",
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN_INSUFFICIENT_ROLE",
        status: 403,
      });
    });

    it("denies invitation creation when caller is unauthenticated (401 UNAUTHENTICATED)", async () => {
      await expect(
        createInvitationForOrg({
          user: null,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "candidate@fieldops.com",
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });

    it("denies invitation creation into another organization's workspace (403 FORBIDDEN_ORG_ACCESS)", async () => {
      await expect(
        createInvitationForOrg({
          user: ADMIN_USER,
          candidateOrgId: OTHER_ORG_ID,
          rawInput: {
            email: "candidate@othercorp.com",
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN_ORG_ACCESS",
        status: 403,
      });
    });

    it("rejects invitation creation with invalid email or unsupported role (400 VALIDATION_ERROR)", async () => {
      await expect(
        createInvitationForOrg({
          user: ADMIN_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "not-an-email",
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toThrow();

      await expect(
        createInvitationForOrg({
          user: ADMIN_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "valid@fieldops.com",
            role: "super_admin_unsupported",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toThrow();

      await expect(
        createInvitationForOrg({
          user: ADMIN_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: "another-admin@fieldops.com",
            role: "admin",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toThrow();
    });

    it("rejects invitation creation when invited email is already an active member in workspace (409 CONFLICT)", async () => {
      await expect(
        createInvitationForOrg({
          user: ADMIN_USER,
          candidateOrgId: ORG_ID,
          rawInput: {
            email: REP_USER.email, // rep@fieldops.com is already an active member
            role: "field_employee",
            expiresInHours: 72,
          },
          repository,
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        status: 409,
      });
    });

    it("safely revokes prior pending invitation when a new invitation is issued for the same email", async () => {
      const email = "pending.candidate@fieldops.com";

      const first = await createInvitationForOrg({
        user: ADMIN_USER,
        candidateOrgId: ORG_ID,
        rawInput: { email, role: "field_employee", expiresInHours: 72 },
        repository,
      });

      expect(repository.invitations).toHaveLength(1);
      expect(repository.invitations[0]?.status).toBe("pending");

      const second = await createInvitationForOrg({
        user: ADMIN_USER,
        candidateOrgId: ORG_ID,
        rawInput: { email, role: "manager", expiresInHours: 48 },
        repository,
      });

      expect(repository.invitations).toHaveLength(2);
      expect(repository.invitations[0]?.status).toBe("revoked");
      expect(repository.invitations[1]?.status).toBe("pending");
      expect(repository.invitations[1]?.role).toBe("manager");

      // Attempting to accept the superseded token must fail
      const candidateUser: AuthenticatedUser = {
        id: "eeeeeeee-0000-4000-8000-000000000005",
        email,
      };

      await expect(
        acceptInvitationForCaller({
          user: candidateUser,
          rawInput: { token: first.inviteToken },
          repository,
        })
      ).rejects.toMatchObject({
        code: "INVITATION_INVALID",
        status: 400,
      });

      // The second token is valid and can be accepted once
      const accepted = await acceptInvitationForCaller({
        user: candidateUser,
        rawInput: { token: second.inviteToken },
        repository,
      });

      expect(accepted.role).toBe("manager");
      expect(accepted.status).toBe("active");

      // Replay of second token must now fail (single use)
      await expect(
        acceptInvitationForCaller({
          user: candidateUser,
          rawInput: { token: second.inviteToken },
          repository,
        })
      ).rejects.toMatchObject({
        code: "INVITATION_INVALID",
        status: 400,
      });
    });

    it("enforces invitation expiration timestamp and blocks expired tokens", async () => {
      const email = "expired.candidate@fieldops.com";
      const baseTime = new Date("2026-10-01T12:00:00Z");

      const { inviteToken } = await createInvitationForOrg({
        user: ADMIN_USER,
        candidateOrgId: ORG_ID,
        rawInput: { email, role: "field_employee", expiresInHours: 24 },
        repository,
        now: baseTime,
      });

      const candidateUser: AuthenticatedUser = {
        id: "ffffffff-0000-4000-8000-000000000006",
        email,
      };

      // 48 hours later (expired)
      const futureTime = new Date("2026-10-03T12:00:00Z");

      await expect(
        acceptInvitationForCaller({
          user: candidateUser,
          rawInput: { token: inviteToken },
          repository,
          now: futureTime,
        })
      ).rejects.toMatchObject({
        code: "INVITATION_EXPIRED",
        status: 400,
      });
    });
  });
});
