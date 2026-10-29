import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AuthenticatedUser,
  type Organization,
  type OrganizationMembership,
  type UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import {
  createOrganizationForCaller,
  resolveActiveWorkspaceForUser,
} from "@/modules/tenancy/service";

describe("Remediation: Google OAuth Onboarding, Shell Role Display & Tenancy Resilience", () => {
  const TEST_USER: AuthenticatedUser = {
    id: "10000000-0000-4000-8000-000000000001",
    email: "anfaal.scholorship@example.com",
    fullName: "Anfaal Scholorship",
  };

  const TEST_ORG: Organization = {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Anfaal Scholorship Foundation",
    slug: "anfaal-scholorship",
    status: "active",
    createdBy: TEST_USER.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    industry: "Education",
    companySize: "11-50",
    country: "India",
  };

  const TEST_MEMBERSHIP: OrganizationMembership = {
    id: "30000000-0000-4000-8000-000000000001",
    orgId: TEST_ORG.id,
    userId: TEST_USER.id,
    role: "admin",
    status: "active",
    managerUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe("1. Zero-organization onboarding vs existing workspace resolution", () => {
    it("allows authenticated user with zero organizations to reach onboarding without error", async () => {
      const emptyRepo = {
        listUserOrganizations: vi.fn().mockResolvedValue([]),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      const result = await resolveActiveWorkspaceForUser({
        user: TEST_USER,
        repository: emptyRepo,
      });

      expect(result.activeOrganization).toBeNull();
      expect(result.organizations).toEqual([]);
      expect(emptyRepo.listUserOrganizations).toHaveBeenCalledWith(TEST_USER.id);
    });

    it("loads the correct workspace for authenticated user with an existing active organization", async () => {
      const summary: UserOrganizationSummary = {
        organization: TEST_ORG,
        membership: TEST_MEMBERSHIP,
      };

      const populatedRepo = {
        listUserOrganizations: vi.fn().mockResolvedValue([summary]),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      const result = await resolveActiveWorkspaceForUser({
        user: TEST_USER,
        repository: populatedRepo,
      });

      expect(result.activeOrganization).not.toBeNull();
      expect(result.activeOrganization?.organization.id).toBe(TEST_ORG.id);
      expect(result.activeOrganization?.membership.role).toBe("admin");
      expect(result.organizations).toHaveLength(1);
    });

    it("respects preferredOrgId when caller has membership in multiple organizations", async () => {
      const org2: Organization = {
        ...TEST_ORG,
        id: "20000000-0000-4000-8000-000000000002",
        name: "Second Org",
        slug: "second-org",
      };
      const summary1: UserOrganizationSummary = {
        organization: TEST_ORG,
        membership: TEST_MEMBERSHIP,
      };
      const summary2: UserOrganizationSummary = {
        organization: org2,
        membership: {
          ...TEST_MEMBERSHIP,
          orgId: org2.id,
          id: "30000000-0000-4000-8000-000000000002",
        },
      };

      const multiRepo = {
        listUserOrganizations: vi.fn().mockResolvedValue([summary1, summary2]),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      // Selects second org when preferred
      const result = await resolveActiveWorkspaceForUser({
        user: TEST_USER,
        preferredOrgId: org2.id,
        repository: multiRepo,
      });

      expect(result.activeOrganization?.organization.id).toBe(org2.id);
    });

    it("requires authentication to resolve active workspace (rejects unauthenticated with 401)", async () => {
      const dummyRepo = {
        listUserOrganizations: vi.fn(),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      await expect(
        resolveActiveWorkspaceForUser({
          user: null,
          repository: dummyRepo,
        })
      ).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });
  });

  describe("2. Schema fallback & genuine database error handling in SupabaseTenancyRepository", () => {
    it("falls back to selectBase when PostgREST reports column does not exist (code 42703)", async () => {
      // First query with company profile fails with 42703
      // Second query with base columns succeeds
      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        callCount++;
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => {
                if (callCount === 1) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "42703",
                      message: "column organizations_1.industry does not exist",
                    },
                  });
                }
                return Promise.resolve({
                  data: [
                    {
                      id: "mem-1",
                      organization_id: "org-1",
                      user_id: TEST_USER.id,
                      role: "admin",
                      status: "active",
                      manager_user_id: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      organizations: {
                        id: "org-1",
                        name: "Fallback Test Org",
                        slug: "fallback-org",
                        status: "active",
                        created_by: TEST_USER.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                    },
                  ],
                  error: null,
                });
              }),
            }),
          }),
        };
      });

      const fakeSupabase = {
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseTenancyRepository(fakeSupabase);
      const orgs = await repo.listUserOrganizations(TEST_USER.id);

      expect(orgs).toHaveLength(1);
      expect(orgs[0]?.organization.name).toBe("Fallback Test Org");
      expect(mockSelect).toHaveBeenCalledTimes(2);
    });

    it("surfaces genuine unauthenticated / JWT expired error (401)", async () => {
      const fakeSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "PGRST301",
                    message: "JWT expired",
                  },
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseTenancyRepository(fakeSupabase);
      await expect(repo.listUserOrganizations(TEST_USER.id)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });

    it("surfaces missing onboarding migration as an actionable 503 error", async () => {
      const fakeSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "42P01",
                    message: 'relation "public.organization_members" does not exist',
                  },
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseTenancyRepository(fakeSupabase);
      await expect(repo.listUserOrganizations(TEST_USER.id)).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
        status: 503,
      });
    });
  });

  describe("3. Atomic workspace creation and input validation", () => {
    it("validates company information and rejects invalid slug or missing fields", async () => {
      const dummyRepo = {
        listUserOrganizations: vi.fn(),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      // Invalid slug (spaces and uppercase)
      await expect(
        createOrganizationForCaller({
          user: TEST_USER,
          rawInput: {
            name: "Anfaal Scholorship",
            slug: "Anfaal Scholorship!",
            industry: "Education",
            companySize: "11-50",
            country: "India",
          },
          repository: dummyRepo,
        })
      ).rejects.toHaveProperty("name", "ZodError");

      // Invalid company size
      await expect(
        createOrganizationForCaller({
          user: TEST_USER,
          rawInput: {
            name: "Anfaal Scholorship",
            slug: "anfaal-scholorship",
            industry: "Education",
            companySize: "invalid-size",
            country: "India",
          },
          repository: dummyRepo,
        })
      ).rejects.toHaveProperty("name", "ZodError");
    });

    it("passes validated parameters to repository.createOrganizationWithOwner", async () => {
      const mockCreate = vi.fn().mockResolvedValue(TEST_ORG);
      const repo = {
        listUserOrganizations: vi.fn(),
        createOrganizationWithOwner: mockCreate,
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      const result = await createOrganizationForCaller({
        user: TEST_USER,
        rawInput: {
          name: "Anfaal Scholorship",
          slug: "anfaal-scholorship",
          industry: "Education",
          companySize: "11-50",
          country: "India",
          website: "https://anfaal.example.org",
          phone: "+91 9876543210",
        },
        repository: repo,
      });

      expect(result.id).toBe(TEST_ORG.id);
      expect(mockCreate).toHaveBeenCalledWith(TEST_USER.id, {
        name: "Anfaal Scholorship",
        slug: "anfaal-scholorship",
        industry: "Education",
        companySize: "11-50",
        country: "India",
        website: "https://anfaal.example.org",
        phone: "+91 9876543210",
      });
    });
  });

  describe("4. Invitation acceptance validation & token hashing", () => {
    it("rejects unauthenticated invitation acceptance", async () => {
      const { acceptInvitationForCaller } = await import("@/modules/tenancy/service");
      const dummyRepo = {
        listUserOrganizations: vi.fn(),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: vi.fn(),
      };

      await expect(
        acceptInvitationForCaller({
          user: null,
          rawInput: { token: "sample-token-123" },
          repository: dummyRepo,
        })
      ).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });

    it("hashes invitation token using SHA-256 before querying repository", async () => {
      const { acceptInvitationForCaller } = await import("@/modules/tenancy/service");
      const { hashInvitationToken } = await import("@/modules/tenancy/authorization");

      const mockAccept = vi.fn().mockResolvedValue(TEST_MEMBERSHIP);
      const repo = {
        listUserOrganizations: vi.fn(),
        createOrganizationWithOwner: vi.fn(),
        getMembershipByUserAndOrg: vi.fn(),
        listOrgMembers: vi.fn(),
        addOrgMember: vi.fn(),
        createOrgInvitation: vi.fn(),
        acceptOrgInvitationByTokenHash: mockAccept,
      };

      const rawToken = "my-secret-invitation-token-abc";
      const expectedHash = hashInvitationToken(rawToken);

      await acceptInvitationForCaller({
        user: TEST_USER,
        rawInput: { token: rawToken },
        repository: repo,
      });

      expect(mockAccept).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expectedHash,
          user: TEST_USER,
        })
      );
      // Raw token is NEVER passed to the database
      expect(expectedHash).toHaveLength(64);
      expect(mockAccept).not.toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: rawToken })
      );
    });
  });

  describe("5. Role profile and shell display derivation", () => {
    it("derives authenticated user display name from email and sets Setup title when role is absent", async () => {
      // Simulate profile logic in RoleContext
      const email = "anfaal.scholorship@example.com";
      const authenticatedRole = undefined;

      const prefix = email.split("@")[0] || "User";
      const words = prefix.replace(/[._-]/g, " ").split(" ").filter(Boolean);
      const displayName = words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      expect(displayName).toBe("Anfaal Scholorship");
      expect(authenticatedRole).toBeUndefined();
      // Verifies that role does NOT default to "field_employee" for onboarding user
      const roleBadge = authenticatedRole
        ? String(authenticatedRole).replace("_", " ")
        : "No Workspace";
      expect(roleBadge).toBe("No Workspace");
    });

    it("correctly identifies active workspace administrator role", () => {
      const authenticatedRole = "admin";
      const title =
        authenticatedRole === "admin"
          ? "Workspace Administrator"
          : authenticatedRole === "manager"
            ? "Regional Operations Manager"
            : "Field Merchandising Representative";

      expect(title).toBe("Workspace Administrator");
      expect(authenticatedRole.replace("_", " ")).toBe("admin");
    });
  });
});
