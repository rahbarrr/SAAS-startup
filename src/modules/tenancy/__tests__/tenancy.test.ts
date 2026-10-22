import { describe, expect, it } from "vitest";
import {
  AppError,
  buildErrorEnvelope,
  buildSuccessEnvelope,
  decodeCursor,
  encodeCursor,
} from "@/lib/http/envelope";
import {
  hasOrgPermission,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type {
  AuthenticatedUser,
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
import type {
  AddOrgMemberInput,
  CreateOrganizationInput,
  ListOrgMembersQuery,
} from "@/modules/tenancy/schemas";
import {
  addMemberToOrg,
  createOrganizationForCaller,
  listMembersForOrg,
} from "@/modules/tenancy/service";

class InMemoryTenancyRepository implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];
  public invitations: OrganizationInvitation[] = [];

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
          throw new Error("Missing organization in test store");
        }
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(
    userId: string,
    input: CreateOrganizationInput
  ): Promise<Organization> {
    if (this.organizations.some((o) => o.slug === input.slug)) {
      throw new AppError(
        "CONFLICT",
        `Organization slug '${input.slug}' is already taken`,
        409
      );
    }

    const now = "2026-10-22T10:00:00.000Z";
    const org: Organization = {
      id: "11111111-1111-4111-8111-111111111199",
      name: input.name,
      slug: input.slug,
      status: "active",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.push(org);
    this.memberships.push({
      id: "22222222-2222-4222-8222-222222222299",
      orgId: org.id,
      userId,
      role: "admin",
      status: "active",
      managerUserId: null,
      createdAt: now,
      updatedAt: now,
    });
    return org;
  }

  async listOrgMembers(
    orgId: string,
    query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    let filtered = this.memberships
      .filter((m) => m.orgId === orgId)
      .filter((m) => (query.role ? m.role === query.role : true))
      .filter((m) => (query.status ? m.status === query.status : true))
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return b.createdAt.localeCompare(a.createdAt);
        }
        return b.id.localeCompare(a.id);
      });

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      filtered = filtered.filter(
        (m) =>
          m.createdAt < cursor.createdAt ||
          (m.createdAt === cursor.createdAt && m.id < cursor.id)
      );
    }

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;
    const last = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: query.limit,
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  async addOrgMember(
    orgId: string,
    input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    const existing = await this.getMembershipByUserAndOrg(input.userId, orgId);
    if (existing) {
      throw new AppError(
        "CONFLICT",
        "User is already a member of this organization",
        409
      );
    }

    const now = "2026-10-22T12:00:00.000Z";
    const created: OrganizationMembership = {
      id: "99999999-9999-4999-8999-999999999999",
      orgId,
      userId: input.userId,
      role: input.role,
      status: input.status,
      managerUserId: input.managerUserId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.push(created);
    return created;
  }

  async createOrgInvitation(
    input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    const now = "2026-10-22T10:00:00.000Z";
    const invitation: OrganizationInvitation = {
      id: "33333333-3333-4333-8333-333333333333",
      orgId: input.orgId,
      invitedEmail: input.invitedEmail,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      status: "pending",
      expiresAt: input.expiresAt,
      acceptedAt: null,
      acceptedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    this.invitations.push(invitation);
    return invitation;
  }

  async acceptOrgInvitationByTokenHash(params: {
    user: AuthenticatedUser;
    tokenHash: string;
    nowIso?: string;
  }): Promise<OrganizationMembership> {
    const invite = this.invitations.find(
      (inv) => inv.tokenHash === params.tokenHash
    );
    if (!invite) {
      throw new AppError("NOT_FOUND", "Invitation not found or invalid", 404);
    }
    const now = params.nowIso ?? "2026-10-22T12:00:00.000Z";
    if (invite.status !== "pending" || invite.expiresAt <= now) {
      throw new AppError(
        "CONFLICT",
        "Invitation has expired or is no longer valid",
        409
      );
    }
    invite.status = "accepted";
    invite.acceptedAt = now;
    invite.acceptedBy = params.user.id;

    const membership: OrganizationMembership = {
      id: "44444444-4444-4444-8444-444444444444",
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
}

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_C_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const USER_MULTI_ORG: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "alice@example.com",
};
const USER_MANAGER_ORG_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "manager.a@example.com",
};
const USER_FIELD_ORG_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "field.a@example.com",
};
const USER_INVITED_ORG_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000004",
  email: "invited.a@example.com",
};
const USER_MANAGER_ORG_B: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000005",
  email: "manager.b@example.com",
};
const NEW_CANDIDATE_USER_ID = "10000000-0000-4000-8000-000000000009";

function createSeededRepository(): InMemoryTenancyRepository {
  const repo = new InMemoryTenancyRepository();
  repo.organizations.push(
    {
      id: ORG_A_ID,
      name: "Acme Retail North",
      slug: "acme-retail-north",
      status: "active",
      createdBy: USER_MULTI_ORG.id,
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:00:00.000Z",
    },
    {
      id: ORG_B_ID,
      name: "Beta FMCG South",
      slug: "beta-fmcg-south",
      status: "active",
      createdBy: USER_MANAGER_ORG_B.id,
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
    }
  );

  repo.memberships.push(
    // Alice is ADMIN in Org A, and FIELD_EMPLOYEE in Org B (multi-org user)
    {
      id: "30000000-0000-4000-8000-000000000001",
      orgId: ORG_A_ID,
      userId: USER_MULTI_ORG.id,
      role: "admin",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_B_ID,
      userId: USER_MULTI_ORG.id,
      role: "field_employee",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T10:05:00.000Z",
      updatedAt: "2026-10-20T10:05:00.000Z",
    },
    // Manager in Org A
    {
      id: "30000000-0000-4000-8000-000000000003",
      orgId: ORG_A_ID,
      userId: USER_MANAGER_ORG_A.id,
      role: "manager",
      status: "active",
      managerUserId: USER_MULTI_ORG.id,
      createdAt: "2026-10-20T09:10:00.000Z",
      updatedAt: "2026-10-20T09:10:00.000Z",
    },
    // Field employee in Org A
    {
      id: "30000000-0000-4000-8000-000000000004",
      orgId: ORG_A_ID,
      userId: USER_FIELD_ORG_A.id,
      role: "field_employee",
      status: "active",
      managerUserId: USER_MANAGER_ORG_A.id,
      createdAt: "2026-10-20T09:20:00.000Z",
      updatedAt: "2026-10-20T09:20:00.000Z",
    },
    // Invited (not yet active) user in Org A
    {
      id: "30000000-0000-4000-8000-000000000005",
      orgId: ORG_A_ID,
      userId: USER_INVITED_ORG_A.id,
      role: "field_employee",
      status: "invited",
      managerUserId: null,
      createdAt: "2026-10-20T09:30:00.000Z",
      updatedAt: "2026-10-20T09:30:00.000Z",
    },
    // Manager in Org B (not a member of Org A)
    {
      id: "30000000-0000-4000-8000-000000000006",
      orgId: ORG_B_ID,
      userId: USER_MANAGER_ORG_B.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
    }
  );

  return repo;
}

describe("Multi-tenant context resolution & isolation", () => {
  it("resolves distinct per-organization roles for a user belonging to multiple organizations (ALLOWED)", async () => {
    const repository = createSeededRepository();

    const contextOrgA = await resolveTenantContext({
      user: USER_MULTI_ORG,
      candidateOrgId: ORG_A_ID,
      repository,
    });
    expect(contextOrgA.orgId).toBe(ORG_A_ID);
    expect(contextOrgA.role).toBe("admin");

    const contextOrgB = await resolveTenantContext({
      user: USER_MULTI_ORG,
      candidateOrgId: ORG_B_ID,
      repository,
    });
    expect(contextOrgB.orgId).toBe(ORG_B_ID);
    expect(contextOrgB.role).toBe("field_employee");
  });

  it("denies access when an authenticated user supplies an orgId they do not belong to (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      resolveTenantContext({
        user: USER_MANAGER_ORG_A,
        candidateOrgId: ORG_B_ID,
        repository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ORG_ACCESS",
      status: 403,
    });

    await expect(
      resolveTenantContext({
        user: USER_MULTI_ORG,
        candidateOrgId: ORG_C_ID,
        repository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ORG_ACCESS",
      status: 403,
    });
  });

  it("denies access when caller is unauthenticated (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      resolveTenantContext({
        user: null,
        candidateOrgId: ORG_A_ID,
        repository,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("denies access when user membership status is invited or deactivated (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      resolveTenantContext({
        user: USER_INVITED_ORG_A,
        candidateOrgId: ORG_A_ID,
        repository,
      })
    ).rejects.toMatchObject({
      code: "MEMBERSHIP_INACTIVE",
      status: 403,
    });
  });

  it("rejects non-UUID candidateOrgId at the boundary before querying the database (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      resolveTenantContext({
        user: USER_MULTI_ORG,
        candidateOrgId: "not-a-valid-uuid",
        repository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});

describe("Role-based authorization boundaries", () => {
  it("enforces permission matrix across admin, manager, and field_employee", () => {
    expect(hasOrgPermission("admin", "members:manage")).toBe(true);
    expect(hasOrgPermission("admin", "trips:approve")).toBe(true);

    expect(hasOrgPermission("manager", "trips:approve")).toBe(true);
    expect(hasOrgPermission("manager", "visits:review")).toBe(true);
    expect(hasOrgPermission("manager", "members:manage")).toBe(false);
    expect(hasOrgPermission("manager", "org:update")).toBe(false);

    expect(hasOrgPermission("field_employee", "trips:create_own")).toBe(true);
    expect(hasOrgPermission("field_employee", "visits:record_own")).toBe(true);
    expect(hasOrgPermission("field_employee", "trips:approve")).toBe(false);
    expect(hasOrgPermission("field_employee", "members:manage")).toBe(false);
  });

  it("allows an admin in Org A to add a member to Org A, but denies the same user from adding a member to Org B where they are field_employee", async () => {
    const repository = createSeededRepository();

    // Allowed in Org A (admin)
    const createdMembership = await addMemberToOrg({
      user: USER_MULTI_ORG,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        userId: NEW_CANDIDATE_USER_ID,
        role: "field_employee",
        status: "active",
        managerUserId: USER_MANAGER_ORG_A.id,
      },
      repository,
    });

    expect(createdMembership.orgId).toBe(ORG_A_ID);
    expect(createdMembership.userId).toBe(NEW_CANDIDATE_USER_ID);
    expect(createdMembership.managerUserId).toBe(USER_MANAGER_ORG_A.id);

    // Denied in Org B (same user is only field_employee in Org B)
    await expect(
      addMemberToOrg({
        user: USER_MULTI_ORG,
        candidateOrgId: ORG_B_ID,
        rawInput: {
          userId: NEW_CANDIDATE_USER_ID,
          role: "field_employee",
        },
        repository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });
  });

  it("denies manager from adding organization members (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      addMemberToOrg({
        user: USER_MANAGER_ORG_A,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          userId: NEW_CANDIDATE_USER_ID,
          role: "field_employee",
        },
        repository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });
  });

  it("throws FORBIDDEN_INSUFFICIENT_ROLE when requireOrgPermission fails", async () => {
    const repository = createSeededRepository();
    const fieldContext = await resolveTenantContext({
      user: USER_FIELD_ORG_A,
      candidateOrgId: ORG_A_ID,
      repository,
    });

    expect(() => requireOrgPermission(fieldContext, "trips:approve")).toThrowError(
      AppError
    );
  });
});

describe("Cross-tenant & reporting-line business rules", () => {
  it("rejects assigning a manager who belongs to a different organization (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      addMemberToOrg({
        user: USER_MULTI_ORG,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          userId: NEW_CANDIDATE_USER_ID,
          role: "field_employee",
          // USER_MANAGER_ORG_B is a manager in Org B, NOT in Org A
          managerUserId: USER_MANAGER_ORG_B.id,
        },
        repository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects assigning a field_employee as a manager (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      addMemberToOrg({
        user: USER_MULTI_ORG,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          userId: NEW_CANDIDATE_USER_ID,
          role: "field_employee",
          managerUserId: USER_FIELD_ORG_A.id,
        },
        repository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects assigning a user as their own manager (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      addMemberToOrg({
        user: USER_MULTI_ORG,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          userId: NEW_CANDIDATE_USER_ID,
          role: "manager",
          managerUserId: NEW_CANDIDATE_USER_ID,
        },
        repository,
      })
    ).rejects.toHaveProperty("name", "ZodError");
  });
});

describe("Boundary validation, cursor pagination, and response envelopes", () => {
  it("validates organization creation inputs and creates org with caller as active admin", async () => {
    const repository = createSeededRepository();

    const createdOrg = await createOrganizationForCaller({
      user: USER_MULTI_ORG,
      rawInput: {
        name: "Gamma Distributors",
        slug: "gamma-distributors",
      },
      repository,
    });

    expect(createdOrg.slug).toBe("gamma-distributors");
    expect(createdOrg.createdBy).toBe(USER_MULTI_ORG.id);

    // Rejects invalid slug format
    await expect(
      createOrganizationForCaller({
        user: USER_MULTI_ORG,
        rawInput: {
          name: "Invalid Slug Org",
          slug: "Invalid_Slug--Here!",
        },
        repository,
      })
    ).rejects.toHaveProperty("name", "ZodError");
  });

  it("paginates organization members with opaque cursor and consistent envelope shape", async () => {
    const repository = createSeededRepository();

    const page1 = await listMembersForOrg({
      user: USER_MANAGER_ORG_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { limit: "2" },
      repository,
    });

    expect(page1.items).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).toBeTruthy();

    const page2 = await listMembersForOrg({
      user: USER_MANAGER_ORG_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {
        limit: "2",
        cursor: page1.pagination.nextCursor ?? undefined,
      },
      repository,
    });

    expect(page2.items).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(false);
    expect(page2.pagination.nextCursor).toBeNull();

    // Ensure no overlap between page 1 and page 2
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }

    const envelope = buildSuccessEnvelope(page1.items, {
      pagination: page1.pagination,
    });
    expect(envelope).toEqual({
      data: page1.items,
      error: null,
      meta: {
        pagination: page1.pagination,
      },
    });

    const errorEnvelope = buildErrorEnvelope(
      "FORBIDDEN_ORG_ACCESS",
      "You do not have access to this organization"
    );
    expect(errorEnvelope).toEqual({
      data: null,
      error: {
        code: "FORBIDDEN_ORG_ACCESS",
        message: "You do not have access to this organization",
      },
      meta: {},
    });
  });

  it("rejects malformed pagination cursors with VALIDATION_ERROR (DENIED)", async () => {
    const repository = createSeededRepository();

    await expect(
      listMembersForOrg({
        user: USER_MANAGER_ORG_A,
        candidateOrgId: ORG_A_ID,
        rawQuery: { limit: "10", cursor: "tampered-cursor-value" },
        repository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});
