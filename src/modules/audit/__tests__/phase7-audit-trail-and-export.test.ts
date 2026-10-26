import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, serializeAuditEventsToCsv } from "@/modules/audit/csv-export";
import type {
  AuditExportFilter,
  AuditLogFilter,
  InsertAuditEventInput,
  OrganizationAuditEvent,
  PaginatedAuditEventsResult,
} from "@/modules/audit/domain";
import type { AuditRepository } from "@/modules/audit/repository";
import {
  exportAuditEventsForOrg,
  listAuditEventsForOrg,
  recordAuditEventForOrg,
} from "@/modules/audit/service";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";

class MockAuditRepo implements AuditRepository {
  public events: OrganizationAuditEvent[] = [];

  async insertAuditEvent(input: InsertAuditEventInput): Promise<OrganizationAuditEvent> {
    const event: OrganizationAuditEvent = {
      id: `audit-${this.events.length + 1}`,
      orgId: input.orgId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes ?? {},
      metadata: input.metadata ?? {},
      reason: input.reason ?? null,
      correlationId: input.correlationId ?? null,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async listAuditEvents(
    orgId: string,
    filter: AuditLogFilter
  ): Promise<PaginatedAuditEventsResult> {
    let filtered = this.events.filter((e) => e.orgId === orgId);

    if (filter.actionType) {
      filtered = filtered.filter((e) => e.actionType === filter.actionType);
    }
    if (filter.entityType) {
      filtered = filtered.filter((e) => e.entityType === filter.entityType);
    }
    if (filter.actorUserId) {
      filtered = filtered.filter((e) => e.actorUserId === filter.actorUserId);
    }
    if (filter.startDateFrom) {
      const from = filter.startDateFrom;
      filtered = filtered.filter((e) => e.createdAt >= from);
    }
    if (filter.startDateTo) {
      const to = filter.startDateTo;
      filtered = filtered.filter((e) => e.createdAt <= `${to}T23:59:59.999Z`);
    }

    // Sort newest first
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const limit = filter.limit ?? 25;
    let startIndex = 0;
    if (filter.cursor) {
      const idx = filtered.findIndex((e) => e.id === filter.cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const items = filtered.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < filtered.length ? (items[items.length - 1]?.id ?? null) : null;

    return {
      items,
      pagination: {
        nextCursor,
        hasMore: Boolean(nextCursor),
        limit,
      },
    };
  }

  async streamAuditEventsForExport(
    orgId: string,
    filter: AuditExportFilter
  ): Promise<OrganizationAuditEvent[]> {
    let filtered = this.events.filter((e) => e.orgId === orgId);
    if (filter.actionType)
      filtered = filtered.filter((e) => e.actionType === filter.actionType);
    if (filter.entityType)
      filtered = filtered.filter((e) => e.entityType === filter.entityType);
    if (filter.actorUserId)
      filtered = filtered.filter((e) => e.actorUserId === filter.actorUserId);
    if (filter.startDateFrom) {
      const from = filter.startDateFrom;
      filtered = filtered.filter((e) => e.createdAt >= from);
    }
    if (filter.startDateTo) {
      const to = filter.startDateTo;
      filtered = filtered.filter((e) => e.createdAt <= `${to}T23:59:59.999Z`);
    }
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filtered.slice(0, filter.limit ?? 1000);
  }
}

class MockTenancyRepo implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];

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
        if (!organization) throw new Error("Missing org");
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(): Promise<never> {
    throw new Error("Not implemented");
  }
  async listOrgMembers(): Promise<never> {
    throw new Error("Not implemented");
  }
  async addOrgMember(): Promise<never> {
    throw new Error("Not implemented");
  }
  async createOrgInvitation(): Promise<never> {
    throw new Error("Not implemented");
  }
  async acceptOrgInvitationByTokenHash(): Promise<never> {
    throw new Error("Not implemented");
  }
}

describe("Workstream 1 & 2: Immutable Enterprise Audit Trail and Secure Export", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const otherOrgId = "22222222-2222-4222-8222-222222222222";

  const adminUser: AuthenticatedUser = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "admin@enterprise.com",
  };

  const repUser: AuthenticatedUser = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "rep@enterprise.com",
  };

  function setup() {
    const tenancyRepo = new MockTenancyRepo();
    const auditRepo = new MockAuditRepo();

    tenancyRepo.organizations = [
      {
        id: orgId,
        name: "Enterprise Pilot Corp",
        slug: "pilot-corp",
        status: "active",
        createdBy: adminUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: otherOrgId,
        name: "Foreign Corp",
        slug: "foreign-corp",
        status: "active",
        createdBy: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    tenancyRepo.memberships = [
      {
        id: "m-1",
        orgId,
        userId: adminUser.id,
        role: "admin",
        status: "active",
        managerUserId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-2",
        orgId,
        userId: repUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: adminUser.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    return { tenancyRepo, auditRepo };
  }

  describe("CSV Formula Injection Protection (OWASP / RFC 4180)", () => {
    it("neutralizes formulas starting with '=', '+', '-', '@', tab, and carriage return", () => {
      expect(sanitizeCsvCell("=CMD('calc')")).toBe("\"'=CMD('calc')\"");
      expect(sanitizeCsvCell("+1234567")).toBe('"\'\x2b1234567"');
      expect(sanitizeCsvCell("-2+5")).toBe('"\'\x2d2+5"');
      expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe('"\'@SUM(A1:A10)"');
      expect(sanitizeCsvCell("\tDDE")).toBe('"\'\tDDE"');
      expect(sanitizeCsvCell("\r=1+1")).toBe('"\'\r=1+1"');
    });

    it("leaves safe text and numbers unmodified", () => {
      expect(sanitizeCsvCell("Normal Store Visit")).toBe("Normal Store Visit");
      expect(sanitizeCsvCell("2026-10-25")).toBe("2026-10-25");
      expect(sanitizeCsvCell("trip.approved")).toBe("trip.approved");
      expect(sanitizeCsvCell("")).toBe("");
    });

    it("escapes quotes properly in RFC 4180 CSV serialization", () => {
      const csv = serializeAuditEventsToCsv([
        {
          id: "ev-1",
          orgId,
          actorUserId: adminUser.id,
          actorRole: "admin",
          actionType: "trip.rejected",
          entityType: "trip",
          entityId: "trip-123",
          changes: { reason: 'He said "urgent rework required"' },
          metadata: {},
          reason: '=formula with "quotes"',
          correlationId: "corr-1",
          createdAt: "2026-10-25T12:00:00.000Z",
        },
      ]);

      expect(csv).toContain('"\'=formula with ""quotes"""');
      expect(csv).toContain("trip.rejected");
    });
  });

  describe("Audit Trail Recording & Invariants", () => {
    it("records critical operations with correlation ID and actor role", async () => {
      const { tenancyRepo, auditRepo } = setup();

      const event = await recordAuditEventForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        input: {
          orgId,
          actionType: "trip.approved",
          entityType: "trip",
          entityId: "trip-999",
          reason: "Route is fully within fuel policy.",
          changes: {
            before: { status: "submitted" },
            after: { status: "approved" },
          },
          correlationId: "req-123-abc",
        },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      expect(event.id).toBeDefined();
      expect(event.actionType).toBe("trip.approved");
      expect(event.actorRole).toBe("admin");
      expect(event.correlationId).toBe("req-123-abc");
      expect(event.changes).toEqual({
        before: { status: "submitted" },
        after: { status: "approved" },
      });
      expect(auditRepo.events).toHaveLength(1);
    });

    it("rejects cross-tenant recording attempts", async () => {
      const { tenancyRepo, auditRepo } = setup();

      await expect(
        recordAuditEventForOrg({
          user: adminUser,
          candidateOrgId: orgId,
          input: {
            orgId: otherOrgId, // Cross-tenant spoof attempt
            actionType: "trip.created",
            entityType: "trip",
            entityId: "trip-foreign",
          },
          tenancyRepository: tenancyRepo,
          auditRepository: auditRepo,
        })
      ).rejects.toThrow();
    });
  });

  describe("Audit Listing & Cursor Pagination", () => {
    it("lists audit events with action and entity filtering", async () => {
      const { tenancyRepo, auditRepo } = setup();

      // Seed events
      await recordAuditEventForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        input: { orgId, actionType: "trip.created", entityType: "trip", entityId: "t-1" },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });
      await recordAuditEventForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        input: {
          orgId,
          actionType: "visit.checked_in",
          entityType: "visit",
          entityId: "v-1",
        },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      const tripsOnly = await listAuditEventsForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        rawQuery: { actionType: "trip.created" },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      expect(tripsOnly.items).toHaveLength(1);
      expect(tripsOnly.items[0]?.actionType).toBe("trip.created");
    });
  });

  describe("Enterprise Audit Export & Role Authorization", () => {
    it("allows organization administrators to export audit logs and records an audit.exported event", async () => {
      const { tenancyRepo, auditRepo } = setup();

      // Seed an event to export
      await recordAuditEventForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        input: {
          orgId,
          actionType: "trip.approved",
          entityType: "trip",
          entityId: "t-1",
        },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      const exportResult = await exportAuditEventsForOrg({
        user: adminUser,
        candidateOrgId: orgId,
        rawQuery: { format: "csv" },
        tenancyRepository: tenancyRepo,
        auditRepository: auditRepo,
      });

      expect(exportResult.format).toBe("csv");
      expect(exportResult.recordCount).toBeGreaterThanOrEqual(1);
      expect(exportResult.content).toContain("trip.approved");

      // Verify that the export itself was audited
      const exportAuditEvent = auditRepo.events.find(
        (e) => e.actionType === "audit.exported"
      );
      expect(exportAuditEvent).toBeDefined();
      expect(exportAuditEvent?.actorUserId).toBe(adminUser.id);
      expect(exportAuditEvent?.entityType).toBe("audit_export");
    });

    it("rejects non-admin users (field employees) from exporting enterprise audit logs (403)", async () => {
      const { tenancyRepo, auditRepo } = setup();

      await expect(
        exportAuditEventsForOrg({
          user: repUser,
          candidateOrgId: orgId,
          rawQuery: { format: "csv" },
          tenancyRepository: tenancyRepo,
          auditRepository: auditRepo,
        })
      ).rejects.toThrow();
    });
  });
});
