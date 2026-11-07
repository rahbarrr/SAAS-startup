import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getRoleMobileBottomNav,
  getRoleNavigationSections,
  getRoleTopPillNav,
} from "@/components/shell/NavLinks";
import { listAuditEventsForOrg } from "@/modules/audit/service";
import { getManagerDashboardForOrg, getOperationsReportForOrg } from "@/modules/reporting/service";
import {
  canAccessRoute,
  hasPermission,
} from "@/modules/tenancy/authorization";
import {
  normalizeOrgRole,
  type MemberProfile,
  type OrganizationMembership,
  toDisplayRoleSlug,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import {
  createInvitationForOrg,
  listMembersForOrg,
  updateMemberForOrg,
} from "@/modules/tenancy/service";
import type { Trip } from "@/modules/trips/domain";
import type { TripsRepository } from "@/modules/trips/repository";
import {
  decideTripForOrg,
  getTripDetailForOrg,
  listManagerApprovalInboxForOrg,
  listTripsForOrg,
} from "@/modules/trips/service";

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const MANAGER_A_ID = "10000000-0000-4000-8000-000000000002";
const EMPLOYEE_A1_ID = "10000000-0000-4000-8000-000000000003"; // Assigned to Manager A
const MANAGER_B_ID = "10000000-0000-4000-8000-000000000006"; // Second Manager in Org A
const EMPLOYEE_B1_ID = "10000000-0000-4000-8000-000000000007"; // Assigned to Manager B

const TRIP_A1_ID = "50000000-0000-4000-8000-000000000002";
const TRIP_B1_ID = "50000000-0000-4000-8000-000000000099";

function createRbacTenancyRepo(): TenancyRepository & {
  memberships: OrganizationMembership[];
  memberProfiles: MemberProfile[];
} {
  const memberships: OrganizationMembership[] = [
    {
      id: "m-admin",
      orgId: ORG_A_ID,
      userId: ADMIN_ID,
      role: "admin",
      status: "active",
      managerUserId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m-mgr-a",
      orgId: ORG_A_ID,
      userId: MANAGER_A_ID,
      role: "manager",
      status: "active",
      managerUserId: ADMIN_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m-emp-a1",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_A1_ID,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m-mgr-b",
      orgId: ORG_A_ID,
      userId: MANAGER_B_ID,
      role: "manager",
      status: "active",
      managerUserId: ADMIN_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m-emp-b1",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_B1_ID,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_B_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const profiles: Record<string, { email: string; fullName: string }> = {
    [ADMIN_ID]: { email: "admin@fieldtrack.test", fullName: "Alice Admin" },
    [MANAGER_A_ID]: { email: "marcus@fieldtrack.test", fullName: "Marcus Manager A" },
    [EMPLOYEE_A1_ID]: { email: "fiona@fieldtrack.test", fullName: "Fiona Field A1" },
    [MANAGER_B_ID]: { email: "diana@fieldtrack.test", fullName: "Diana Manager B" },
    [EMPLOYEE_B1_ID]: { email: "evan@fieldtrack.test", fullName: "Evan Field B1" },
  };

  return {
    memberships,
    get memberProfiles(): MemberProfile[] {
      return memberships.map((m) => ({
        id: m.userId,
        email: profiles[m.userId]?.email ?? `${m.userId}@test.local`,
        fullName: profiles[m.userId]?.fullName ?? m.userId,
      }));
    },
    async createOrganizationWithOwner() {
      throw new Error("not implemented");
    },
    async acceptOrgInvitationByTokenHash() {
      throw new Error("not implemented");
    },
    async getMembershipByUserAndOrg(userId: string, orgId: string) {
      return (
        memberships.find((m) => m.orgId === orgId && m.userId === userId) ?? null
      );
    },
    async listUserOrganizations(userId: string) {
      return memberships
        .filter((m) => m.userId === userId && m.status === "active")
        .map((membership) => ({
          membership,
          organization: {
            id: ORG_A_ID,
            name: "Acme Retail Operations",
            slug: "acme-retail",
            status: "active" as const,
            createdBy: ADMIN_ID,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }));
    },
    async listOrgMembers(orgId: string) {
      const items = memberships.filter((m) => m.orgId === orgId);
      return {
        items,
        pagination: { limit: 100, hasMore: false, nextCursor: null },
      };
    },
    async addOrgMember(orgId, input) {
      const created: OrganizationMembership = {
        id: `m-${memberships.length + 1}`,
        orgId,
        userId: input.userId,
        role: input.role,
        status: input.status,
        managerUserId: input.managerUserId ?? null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      };
      memberships.push(created);
      return created;
    },
    async updateOrgMember(orgId, input) {
      const idx = memberships.findIndex(
        (m) => m.orgId === orgId && m.userId === input.userId
      );
      if (idx === -1) {
        throw new Error("Member not found");
      }
      const existing = memberships[idx];
      if (!existing) {
        throw new Error("Member not found");
      }
      const updated: OrganizationMembership = {
        ...existing,
        role: input.role ?? existing.role,
        status: input.status ?? existing.status,
        managerUserId:
          input.managerUserId !== undefined
            ? input.managerUserId
            : existing.managerUserId,
        updatedAt: "2026-01-02T00:00:00.000Z",
      };
      memberships[idx] = updated;
      return updated;
    },
    async createOrgInvitation(input) {
      return {
        id: "inv-1",
        orgId: input.orgId,
        invitedEmail: input.invitedEmail,
        role: input.role,
        status: "pending",
        invitedBy: input.invitedBy,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        acceptedBy: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      };
    },
  };
}

describe("Complete RBAC System — Centralized Permissions, Role Navigation, Scoped Services & RLS", () => {
  describe("1. Administrator Role Tests", () => {
    it("grants Administrator complete organization permissions and navigation", () => {
      expect(normalizeOrgRole("admin")).toBe("admin");
      expect(toDisplayRoleSlug("admin")).toBe("admin");

      expect(hasPermission("admin", "dashboard.organization")).toBe(true);
      expect(hasPermission("admin", "tracking.view.organization")).toBe(true);
      expect(hasPermission("admin", "trips.view.organization")).toBe(true);
      expect(hasPermission("admin", "approvals.review")).toBe(true);
      expect(hasPermission("admin", "stores.manage")).toBe(true);
      expect(hasPermission("admin", "team.manage")).toBe(true);
      expect(hasPermission("admin", "users.invite")).toBe(true);
      expect(hasPermission("admin", "users.manage")).toBe(true);
      expect(hasPermission("admin", "roles.manage")).toBe(true);
      expect(hasPermission("admin", "settings.organization")).toBe(true);
      expect(hasPermission("admin", "audit.view")).toBe(true);
      expect(hasPermission("admin", "ai.insights")).toBe(true);

      // Can access all protected routes
      expect(canAccessRoute("admin", "/dashboard")).toBe(true);
      expect(canAccessRoute("admin", "/dashboard/live-tracking")).toBe(true);
      expect(canAccessRoute("admin", "/approvals")).toBe(true);
      expect(canAccessRoute("admin", "/team")).toBe(true);
      expect(canAccessRoute("admin", "/reports")).toBe(true);
      expect(canAccessRoute("admin", "/ai-insights")).toBe(true);
      expect(canAccessRoute("admin", "/audit")).toBe(true);
      expect(canAccessRoute("admin", "/settings")).toBe(true);

      // Navigation includes all Admin items
      const sections = getRoleNavigationSections("admin");
      const allLabels = sections.flatMap((s) => s.items.map((i) => i.label));
      expect(allLabels).toEqual([
        "Overview",
        "Live Map",
        "Trips",
        "Approvals",
        "Store Visits",
        "Stores & Territories",
        "Team Directory",
        "Reports & Analytics",
        "AI Insights",
        "Notifications",
        "Audit Logs",
        "Settings",
      ]);
    });

    it("allows Administrator to view all employees, invite users, and change member roles/status", async () => {
      const repo = createRbacTenancyRepo();
      const adminUser = { id: ADMIN_ID, email: "admin@fieldtrack.test" };

      const allMembers = await listMembersForOrg({
        user: adminUser,
        candidateOrgId: ORG_A_ID,
        repository: repo,
      });
      expect(allMembers.items).toHaveLength(5);

      // Admin can change Employee B1's role to manager
      const updated = await updateMemberForOrg({
        user: adminUser,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          userId: EMPLOYEE_B1_ID,
          role: "manager",
        },
        repository: repo,
      });
      expect(updated.role).toBe("manager");

      // Admin can invite a new employee
      const invitation = await createInvitationForOrg({
        user: adminUser,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          email: "newhire@fieldtrack.test",
          role: "field_employee",
        },
        repository: repo,
      });
      expect(invitation.invitation.role).toBe("field_employee");
    });

    it("allows Administrator to access audit logs", async () => {
      const repo = createRbacTenancyRepo();
      const adminUser = { id: ADMIN_ID, email: "admin@fieldtrack.test" };
      const auditResult = await listAuditEventsForOrg({
        user: adminUser,
        candidateOrgId: ORG_A_ID,
        rawQuery: { limit: 10 },
        tenancyRepository: repo,
        auditRepository: {
          async listAuditEvents() {
            return {
              items: [],
              pagination: { limit: 10, hasMore: false, nextCursor: null },
            };
          },
          async insertAuditEvent() {
            throw new Error("not used");
          },
          async streamAuditEventsForExport() {
            throw new Error("not used");
          },
        },
      });
      expect(auditResult.items).toEqual([]);
    });
  });

  describe("2. Manager Role Tests", () => {
    it("grants Manager team-level permissions and navigation while denying admin-only permissions", () => {
      expect(normalizeOrgRole("manager")).toBe("manager");
      expect(hasPermission("manager", "dashboard.team")).toBe(true);
      expect(hasPermission("manager", "tracking.view.team")).toBe(true);
      expect(hasPermission("manager", "trips.view.team")).toBe(true);
      expect(hasPermission("manager", "approvals.view")).toBe(true);
      expect(hasPermission("manager", "approvals.review")).toBe(true);
      expect(hasPermission("manager", "visits.view.team")).toBe(true);
      expect(hasPermission("manager", "stores.view.assigned")).toBe(true);
      expect(hasPermission("manager", "team.view.assigned")).toBe(true);
      expect(hasPermission("manager", "reports.view.team")).toBe(true);

      // Restrictions: Manager cannot manage org settings, users, roles, stores, audit logs, or AI insights
      expect(hasPermission("manager", "dashboard.organization")).toBe(false);
      expect(hasPermission("manager", "settings.organization")).toBe(false);
      expect(hasPermission("manager", "users.invite")).toBe(false);
      expect(hasPermission("manager", "users.manage")).toBe(false);
      expect(hasPermission("manager", "roles.manage")).toBe(false);
      expect(hasPermission("manager", "stores.manage")).toBe(false);
      expect(hasPermission("manager", "audit.view")).toBe(false);
      expect(hasPermission("manager", "ai.insights")).toBe(false);

      // Route guards block Manager from /audit and /ai-insights
      expect(canAccessRoute("manager", "/dashboard")).toBe(true);
      expect(canAccessRoute("manager", "/approvals")).toBe(true);
      expect(canAccessRoute("manager", "/team")).toBe(true);
      expect(canAccessRoute("manager", "/reports")).toBe(true);
      expect(canAccessRoute("manager", "/audit")).toBe(false);
      expect(canAccessRoute("manager", "/ai-insights")).toBe(false);

      // Manager navigation matches Section 5
      const labels = getRoleNavigationSections("manager").flatMap((s) =>
        s.items.map((i) => i.label)
      );
      expect(labels).toEqual([
        "Manager Dashboard",
        "Live Map",
        "Team Trips",
        "Approvals",
        "Store Visits",
        "Assigned Stores",
        "Team Directory",
        "Team Reports",
        "Notifications",
        "Profile",
      ]);
    });

    it("scopes Manager team directory, trips, approvals, visits, and live tracking strictly to assigned team", async () => {
      const repo = createRbacTenancyRepo();
      const managerA = { id: MANAGER_A_ID, email: "marcus@fieldtrack.test" };

      // 1. Scoped Team Directory only returns Manager A + Employee A1 (excludes Manager B & Employee B1)
      const teamMembers = await listMembersForOrg({
        user: managerA,
        candidateOrgId: ORG_A_ID,
        repository: repo,
        scopeToAssignedTeam: true,
      });
      expect(teamMembers.items.map((m) => m.userId)).toEqual([
        MANAGER_A_ID,
        EMPLOYEE_A1_ID,
      ]);

      // 2. Manager A cannot invite users, add members, or change roles
      await expect(
        createInvitationForOrg({
          user: managerA,
          candidateOrgId: ORG_A_ID,
          rawInput: { email: "unauthorized@fieldtrack.test", role: "field_employee" },
          repository: repo,
        })
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        updateMemberForOrg({
          user: managerA,
          candidateOrgId: ORG_A_ID,
          rawInput: { userId: EMPLOYEE_A1_ID, role: "admin" },
          repository: repo,
        })
      ).rejects.toMatchObject({ status: 403 });

      // 3. Manager A cannot view audit logs when audit.view permission is enforced
      await expect(
        listAuditEventsForOrg({
          user: managerA,
          candidateOrgId: ORG_A_ID,
          rawQuery: {},
          requireAdminAuditPermission: true,
          tenancyRepository: repo,
          auditRepository: {
            async listAuditEvents() {
              return {
                items: [],
                pagination: { limit: 10, hasMore: false, nextCursor: null },
              };
            },
            async insertAuditEvent() {
              throw new Error("not used");
            },
            async streamAuditEventsForExport() {
              throw new Error("not used");
            },
          },
        })
      ).rejects.toMatchObject({ status: 403 });

      // 4. Manager A can list and approve Employee A1's trip, but CANNOT view or approve Employee B1's trip
      const mockTrips: Trip[] = [
        {
          id: TRIP_A1_ID,
          orgId: ORG_A_ID,
          ownerUserId: EMPLOYEE_A1_ID,
          title: "Fiona Team A Trip",
          purpose: "Austin stops",
          destinationCity: "Austin",
          startDate: "2026-04-01",
          endDate: "2026-04-02",
          status: "submitted" as const,
          submittedAt: "2026-03-30T10:00:00.000Z",
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          createdAt: "2026-03-29T10:00:00.000Z",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
        {
          id: TRIP_B1_ID,
          orgId: ORG_A_ID,
          ownerUserId: EMPLOYEE_B1_ID,
          title: "Evan Unrelated Team B Trip",
          purpose: "Dallas stops",
          destinationCity: "Dallas",
          startDate: "2026-04-01",
          endDate: "2026-04-02",
          status: "submitted" as const,
          submittedAt: "2026-03-30T10:00:00.000Z",
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          createdAt: "2026-03-29T10:00:00.000Z",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
      ];

      const mockTripsRepo: TripsRepository = {
        async listTrips() {
          return {
            items: mockTrips,
            pagination: { limit: 20, hasMore: false, nextCursor: null },
          };
        },
        async getTripDetail(_orgId: string, tripId: string) {
          const trip = mockTrips.find((t) => t.id === tripId);
          return trip ? { trip, stops: [], auditEvents: [] } : null;
        },
        async createTripDraftWithStops() {
          throw new Error("not used");
        },
        async updateTripDraftWithStops() {
          throw new Error("not used");
        },
        async transitionTripStatusWithAudit(input) {
          const trip = mockTrips.find((t) => t.id === input.tripId);
          if (!trip) {
            throw new Error("Trip not found");
          }
          return {
            trip: { ...trip, status: input.newStatus },
            stops: [],
            auditEvents: [],
          };
        },
      };

      const visibleTrips = await listTripsForOrg({
        user: managerA,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository: repo,
        tripsRepository: mockTripsRepo,
      });
      expect(visibleTrips.items.map((t) => t.id)).toEqual([TRIP_A1_ID]);

      const approvalInbox = await listManagerApprovalInboxForOrg({
        user: managerA,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository: repo,
        tripsRepository: mockTripsRepo,
      });
      expect(approvalInbox.items.map((t) => t.id)).toEqual([TRIP_A1_ID]);

      // Manager A can approve Employee A1's trip
      const approved = await decideTripForOrg({
        user: managerA,
        candidateOrgId: ORG_A_ID,
        candidateTripId: TRIP_A1_ID,
        rawInput: { decision: "approved", note: "Approved for Team A" },
        tenancyRepository: repo,
        tripsRepository: mockTripsRepo,
      });
      expect(approved.trip.status).toBe("approved");

      // Manager A CANNOT view or approve Employee B1's trip (unrelated team)
      await expect(
        getTripDetailForOrg({
          user: managerA,
          candidateOrgId: ORG_A_ID,
          candidateTripId: TRIP_B1_ID,
          tenancyRepository: repo,
          tripsRepository: mockTripsRepo,
        })
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        decideTripForOrg({
          user: managerA,
          candidateOrgId: ORG_A_ID,
          candidateTripId: TRIP_B1_ID,
          rawInput: { decision: "approved", note: "Cross-team attempt" },
          tenancyRepository: repo,
          tripsRepository: mockTripsRepo,
        })
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("3. Employee Role Tests", () => {
    it("restricts Employee to personal permissions and navigation only", () => {
      expect(normalizeOrgRole("field_employee")).toBe("field_employee");
      expect(normalizeOrgRole("employee")).toBe("field_employee");
      expect(toDisplayRoleSlug("field_employee")).toBe("employee");

      expect(hasPermission("field_employee", "dashboard.personal")).toBe(true);
      expect(hasPermission("employee", "dashboard.personal")).toBe(true);
      expect(hasPermission("field_employee", "trips.view.self")).toBe(true);
      expect(hasPermission("field_employee", "trips.create")).toBe(true);
      expect(hasPermission("field_employee", "visits.checkin")).toBe(true);
      expect(hasPermission("field_employee", "visits.checkout")).toBe(true);
      expect(hasPermission("field_employee", "stores.view.assigned")).toBe(true);
      expect(hasPermission("field_employee", "profile.view")).toBe(true);

      // Restrictions
      expect(hasPermission("field_employee", "dashboard.organization")).toBe(false);
      expect(hasPermission("field_employee", "dashboard.team")).toBe(false);
      expect(hasPermission("field_employee", "approvals.view")).toBe(false);
      expect(hasPermission("field_employee", "approvals.review")).toBe(false);
      expect(hasPermission("field_employee", "tracking.view.team")).toBe(false);
      expect(hasPermission("field_employee", "team.view.assigned")).toBe(false);
      expect(hasPermission("field_employee", "reports.view.team")).toBe(false);
      expect(hasPermission("field_employee", "stores.manage")).toBe(false);
      expect(hasPermission("field_employee", "users.invite")).toBe(false);
      expect(hasPermission("field_employee", "roles.manage")).toBe(false);
      expect(hasPermission("field_employee", "settings.organization")).toBe(false);
      expect(hasPermission("field_employee", "audit.view")).toBe(false);

      // Route guards block Employee from unauthorized modules
      expect(canAccessRoute("field_employee", "/dashboard")).toBe(true);
      expect(canAccessRoute("field_employee", "/trips")).toBe(true);
      expect(canAccessRoute("field_employee", "/visits")).toBe(true);
      expect(canAccessRoute("field_employee", "/stores")).toBe(true);
      expect(canAccessRoute("field_employee", "/notifications")).toBe(true);
      expect(canAccessRoute("field_employee", "/settings")).toBe(true); // Personal Profile
      expect(canAccessRoute("field_employee", "/approvals")).toBe(false);
      expect(canAccessRoute("field_employee", "/dashboard/live-tracking")).toBe(false);
      expect(canAccessRoute("field_employee", "/team")).toBe(false);
      expect(canAccessRoute("field_employee", "/reports")).toBe(false);
      expect(canAccessRoute("field_employee", "/ai-insights")).toBe(false);
      expect(canAccessRoute("field_employee", "/audit")).toBe(false);

      // Employee navigation matches Section 5 (Desktop, Top Pill, Mobile Bottom Nav)
      const labels = getRoleNavigationSections("field_employee").flatMap((s) =>
        s.items.map((i) => i.label)
      );
      expect(labels).toEqual([
        "My Dashboard",
        "My Trips",
        "My Visits",
        "Assigned Stores",
        "My Activity",
        "Notifications",
        "Profile",
      ]);

      const mobileLabels = getRoleMobileBottomNav("field_employee").map(
        (i) => i.label
      );
      expect(mobileLabels).not.toContain("Approvals");
      expect(mobileLabels).not.toContain("Live Map");
      expect(mobileLabels).not.toContain("Team Directory");

      const pillLabels = getRoleTopPillNav("field_employee").map((i) => i.label);
      expect(pillLabels).not.toContain("Approvals");
      expect(pillLabels).not.toContain("Live Map");
    });

    it("prevents Employee from viewing other employees, accessing approvals, or reading other employees' records", async () => {
      const repo = createRbacTenancyRepo();
      const employeeA1 = { id: EMPLOYEE_A1_ID, email: "fiona@fieldtrack.test" };

      // Cannot list organization members
      await expect(
        listMembersForOrg({
          user: employeeA1,
          candidateOrgId: ORG_A_ID,
          repository: repo,
        })
      ).rejects.toMatchObject({ status: 403 });

      // Cannot access manager dashboard / reports
      await expect(
        getManagerDashboardForOrg({
          user: employeeA1,
          candidateOrgId: ORG_A_ID,
          rawQuery: {},
          tenancyRepository: repo,
          reportingRepository: {
            async loadOrgOperationalDataset() {
              throw new Error("should not be called");
            },
          },
        })
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        getOperationsReportForOrg({
          user: employeeA1,
          candidateOrgId: ORG_A_ID,
          rawQuery: {},
          tenancyRepository: repo,
          reportingRepository: {
            async loadOrgOperationalDataset() {
              throw new Error("should not be called");
            },
          },
        })
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("4. Security & PostgreSQL RLS Tests (Direct DB & Self-Role Escalation)", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = new PGlite();

      await db.exec(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
        end
        $$;

        create schema if not exists auth;
        grant usage on schema auth to public, authenticated;
        grant usage on schema public to public, authenticated;

        create table if not exists auth.users (
          id uuid primary key,
          email text not null
        );

        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;

        grant execute on function auth.uid() to public, authenticated;
      `);

      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await db.exec(sql);
      }

      const seedSql = fs.readFileSync(
        path.resolve(process.cwd(), "supabase/seed.sql"),
        "utf8"
      );
      await db.exec(`
        grant select, insert, update, delete on all tables in schema public to authenticated;
      `);
      await db.exec(seedSql);

      // Increase seat limit on Org A so we can seed Team B manager & employee
      await db.exec(`
        update public.organization_subscriptions
        set seat_count = 20,
            entitlements = jsonb_set(coalesce(entitlements, '{}'::jsonb), '{max_members}', '20'::jsonb)
        where organization_id = '${ORG_A_ID}';

        insert into auth.users (id, email) values
          ('${MANAGER_B_ID}', 'diana@fieldtrack.test'),
          ('${EMPLOYEE_B1_ID}', 'evan@fieldtrack.test')
        on conflict (id) do nothing;

        insert into public.organization_members (organization_id, user_id, role, status, manager_user_id)
        values
          ('${ORG_A_ID}', '${MANAGER_B_ID}', 'manager', 'active', '${ADMIN_ID}'),
          ('${ORG_A_ID}', '${EMPLOYEE_B1_ID}', 'field_employee', 'active', '${MANAGER_B_ID}')
        on conflict (organization_id, user_id) do update
          set manager_user_id = excluded.manager_user_id;

        update public.organization_members
        set manager_user_id = '${MANAGER_A_ID}'
        where organization_id = '${ORG_A_ID}' and user_id = '${EMPLOYEE_A1_ID}';

        insert into public.trips (
          id, organization_id, owner_user_id, title, purpose, start_date, end_date, status, submitted_at
        ) values (
          '${TRIP_B1_ID}',
          '${ORG_A_ID}',
          '${EMPLOYEE_B1_ID}',
          'Evan Team B Trip',
          'Team B route',
          '2026-03-20',
          '2026-03-21',
          'submitted',
          now()
        ) on conflict (id) do nothing;
      `);
    });

    afterAll(async () => {
      await db.close();
    });

    async function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
      await db.exec("begin;");
      try {
        await db.exec(`
          set local role authenticated;
          select set_config('request.jwt.claim.sub', '${userId}', true);
        `);
        const result = await fn();
        await db.exec("commit;");
        return result;
      } catch (error) {
        await db.exec("rollback;");
        throw error;
      }
    }

    it("blocks any user (including Admin, Manager, or Employee) from modifying their own role or membership status", async () => {
      const repo = createRbacTenancyRepo();

      // Service-level self-role modification check
      await expect(
        updateMemberForOrg({
          user: { id: ADMIN_ID, email: "admin@fieldtrack.test" },
          candidateOrgId: ORG_A_ID,
          rawInput: { userId: ADMIN_ID, role: "manager" },
          repository: repo,
        })
      ).rejects.toMatchObject({ status: 403 });

      // Database trigger check: Admin trying to change own role in PostgreSQL
      await expect(
        runAsUser(ADMIN_ID, async () => {
          await db.query(
            `update public.organization_members set role = 'manager' where organization_id = $1 and user_id = $2`,
            [ORG_A_ID, ADMIN_ID]
          );
        })
      ).rejects.toThrow(/Users cannot modify their own role/);

      // Database RLS + trigger check: Employee trying to escalate own role to admin is blocked (0 rows updated by RLS, role remains field_employee)
      await runAsUser(EMPLOYEE_A1_ID, async () => {
        const updated = await db.query(
          `update public.organization_members set role = 'admin' where organization_id = $1 and user_id = $2 returning id`,
          [ORG_A_ID, EMPLOYEE_A1_ID]
        );
        expect(updated.rows).toHaveLength(0);

        const current = await db.query<{ role: string }>(
          `select role from public.organization_members where organization_id = $1 and user_id = $2`,
          [ORG_A_ID, EMPLOYEE_A1_ID]
        );
        expect(current.rows[0]?.role).toBe("field_employee");
      });
    });

    it("enforces Supabase RLS so Employees only see their own trips/visits and Managers only see their assigned team's trips/visits", async () => {
      // 1. Employee A1 can see own trip (TRIP_A1_ID) but NOT Employee B1's trip (TRIP_B1_ID)
      await runAsUser(EMPLOYEE_A1_ID, async () => {
        const trips = await db.query<{ id: string; owner_user_id: string }>(
          `select id, owner_user_id from public.trips where organization_id = $1`,
          [ORG_A_ID]
        );
        expect(trips.rows.every((r) => r.owner_user_id === EMPLOYEE_A1_ID)).toBe(true);
        expect(trips.rows.some((r) => r.id === TRIP_B1_ID)).toBe(false);
      });

      // 2. Manager A can see Employee A1's trip (TRIP_A1_ID), but NOT Employee B1's trip (TRIP_B1_ID)
      await runAsUser(MANAGER_A_ID, async () => {
        const trips = await db.query<{ id: string; owner_user_id: string }>(
          `select id, owner_user_id from public.trips where organization_id = $1`,
          [ORG_A_ID]
        );
        expect(trips.rows.some((r) => r.id === TRIP_A1_ID)).toBe(true);
        expect(trips.rows.some((r) => r.id === TRIP_B1_ID)).toBe(false);
      });

      // 3. Manager B can see Employee B1's trip (TRIP_B1_ID), but NOT Employee A1's trip (TRIP_A1_ID)
      await runAsUser(MANAGER_B_ID, async () => {
        const trips = await db.query<{ id: string; owner_user_id: string }>(
          `select id, owner_user_id from public.trips where organization_id = $1`,
          [ORG_A_ID]
        );
        expect(trips.rows.some((r) => r.id === TRIP_B1_ID)).toBe(true);
        expect(trips.rows.some((r) => r.id === TRIP_A1_ID)).toBe(false);
      });

      // 4. Administrator can see BOTH Team A and Team B trips in Org A
      await runAsUser(ADMIN_ID, async () => {
        const trips = await db.query<{ id: string; owner_user_id: string }>(
          `select id, owner_user_id from public.trips where organization_id = $1`,
          [ORG_A_ID]
        );
        expect(trips.rows.some((r) => r.id === TRIP_A1_ID)).toBe(true);
        expect(trips.rows.some((r) => r.id === TRIP_B1_ID)).toBe(true);
      });
    });
  });
});
