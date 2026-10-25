import { describe, expect, it } from "vitest";
import {
  deriveInAppNotificationsFromCommittedEvents,
  type NotificationReadReceipt,
} from "@/modules/notifications/domain";
import {
  attemptSafeNotificationEmail,
  buildSafeEmailContent,
  type EmailDeliveryProvider,
  UnconfiguredEmailProvider,
} from "@/modules/notifications/email";
import type {
  NotificationsRepository,
  OrgCommittedNotificationDataset,
} from "@/modules/notifications/repository";
import {
  listInAppNotificationsForOrg,
  markInAppNotificationReadForOrg,
} from "@/modules/notifications/service";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { Trip, TripAuditEvent } from "@/modules/trips/domain";

class MockTenancyRepo implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return (
      this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null
    );
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

class MockNotificationsRepo implements NotificationsRepository {
  public dataset: OrgCommittedNotificationDataset = {
    trips: [],
    auditEvents: [],
    readReceipts: [],
  };

  async loadOrgCommittedNotificationDataset(): Promise<OrgCommittedNotificationDataset> {
    return this.dataset;
  }

  async markNotificationReadIdempotent(params: {
    orgId: string;
    userId: string;
    auditEventId: string;
  }): Promise<NotificationReadReceipt> {
    const existing = this.dataset.readReceipts.find(
      (r) =>
        r.orgId === params.orgId &&
        r.userId === params.userId &&
        r.auditEventId === params.auditEventId
    );
    if (existing) return existing;

    const receipt: NotificationReadReceipt = {
      orgId: params.orgId,
      userId: params.userId,
      auditEventId: params.auditEventId,
      readAt: new Date().toISOString(),
    };
    this.dataset.readReceipts.push(receipt);
    return receipt;
  }

  async markAllNotificationsReadForOrg(params: {
    orgId: string;
    userId: string;
    auditEventIds: string[];
  }): Promise<NotificationReadReceipt[]> {
    const receipts: NotificationReadReceipt[] = [];
    for (const auditEventId of params.auditEventIds) {
      const r = await this.markNotificationReadIdempotent({
        orgId: params.orgId,
        userId: params.userId,
        auditEventId,
      });
      receipts.push(r);
    }
    return receipts;
  }
}

describe("Phase 4: In-App Notifications & Delivery Isolation", () => {
  const managerUser: AuthenticatedUser = {
    id: "user-mgr-01",
    email: "manager@company.com",
  };

  const repUser: AuthenticatedUser = {
    id: "user-rep-01",
    email: "rep@company.com",
  };

  const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherOrgId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function setupFixture() {
    const tenancyRepo = new MockTenancyRepo();
    tenancyRepo.organizations = [
      {
        id: orgId,
        name: "Acme Retail Operations",
        slug: "acme-retail",
        status: "active",
        createdBy: managerUser.id,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    tenancyRepo.memberships = [
      {
        id: "mem-mgr",
        orgId,
        userId: managerUser.id,
        role: "manager",
        status: "active",
        managerUserId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "mem-rep",
        orgId,
        userId: repUser.id,
        role: "field_employee",
        status: "active",
        managerUserId: managerUser.id,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const testTrips: Trip[] = [
      {
        id: "trip-01",
        orgId,
        ownerUserId: repUser.id,
        title: "Q4 Shelf Audit Route",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        purpose: "audit",
        status: "submitted",
        submittedAt: "2026-10-25T08:00:00Z",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        createdAt: "2026-10-25T08:00:00Z",
        updatedAt: "2026-10-25T08:00:00Z",
      },
      {
        id: "trip-02",
        orgId,
        ownerUserId: repUser.id,
        title: "Downtown Merchandising",
        startDate: "2026-10-27",
        endDate: "2026-10-28",
        purpose: "merchandising",
        status: "approved",
        submittedAt: "2026-10-24T08:00:00Z",
        decidedBy: managerUser.id,
        decidedAt: "2026-10-24T10:00:00Z",
        decisionNote: "Route approved",
        createdAt: "2026-10-24T08:00:00Z",
        updatedAt: "2026-10-24T10:00:00Z",
      },
      {
        id: "trip-foreign",
        orgId: otherOrgId,
        ownerUserId: "foreign-user",
        title: "Foreign Org Trip",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        purpose: "sales",
        status: "submitted",
        submittedAt: "2026-10-25T08:00:00Z",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        createdAt: "2026-10-25T08:00:00Z",
        updatedAt: "2026-10-25T08:00:00Z",
      },
    ];

    const testAuditEvents: TripAuditEvent[] = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        orgId,
        tripId: "trip-01",
        actorUserId: repUser.id,
        eventType: "trip_submitted",
        oldStatus: "draft",
        newStatus: "submitted",
        note: "Please review",
        metadata: {},
        createdAt: "2026-10-25T08:00:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        orgId,
        tripId: "trip-02",
        actorUserId: managerUser.id,
        eventType: "trip_approved",
        oldStatus: "submitted",
        newStatus: "approved",
        note: "Route approved",
        metadata: {},
        createdAt: "2026-10-24T10:00:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        orgId: otherOrgId,
        tripId: "trip-foreign",
        actorUserId: "foreign-user",
        eventType: "trip_submitted",
        oldStatus: "draft",
        newStatus: "submitted",
        note: "Foreign submission",
        metadata: {},
        createdAt: "2026-10-25T08:00:00Z",
      },
    ];

    const notificationsRepo = new MockNotificationsRepo();
    notificationsRepo.dataset = {
      trips: testTrips,
      auditEvents: testAuditEvents,
      readReceipts: [],
    };

    return { tenancyRepo, notificationsRepo };
  }

  it("routes submission notifications to managers and decision notifications to owners", () => {
    const { notificationsRepo } = setupFixture();

    // 1. Manager viewpoint
    const managerOverview = deriveInAppNotificationsFromCommittedEvents({
      orgId,
      recipientUserId: managerUser.id,
      recipientRole: "manager",
      trips: notificationsRepo.dataset.trips,
      auditEvents: notificationsRepo.dataset.auditEvents,
      readReceipts: [],
    });

    // Manager should see the submitted trip from repUser, but not foreign org event
    expect(managerOverview.items.length).toBe(1);
    expect(managerOverview.items[0]?.eventType).toBe("trip_submitted");
    expect(managerOverview.items[0]?.tripTitle).toBe("Q4 Shelf Audit Route");
    expect(managerOverview.items[0]?.actionHref).toBe("/approvals");
    expect(managerOverview.unreadCount).toBe(1);

    // 2. Representative viewpoint
    const repOverview = deriveInAppNotificationsFromCommittedEvents({
      orgId,
      recipientUserId: repUser.id,
      recipientRole: "field_employee",
      trips: notificationsRepo.dataset.trips,
      auditEvents: notificationsRepo.dataset.auditEvents,
      readReceipts: [],
    });

    // Rep should see their approved trip decision, but NOT their own submission
    expect(repOverview.items.length).toBe(1);
    expect(repOverview.items[0]?.eventType).toBe("trip_approved");
    expect(repOverview.items[0]?.tripTitle).toBe("Downtown Merchandising");
    expect(repOverview.items[0]?.actionHref).toBe("/trips/trip-02");
    expect(repOverview.unreadCount).toBe(1);
  });

  it("deduplicates event notifications and prevents duplicate deliveries on retry", () => {
    const { notificationsRepo } = setupFixture();

    const firstEvent = notificationsRepo.dataset.auditEvents[0];
    if (!firstEvent) throw new Error("Expected audit event");
    const duplicateEvents = [firstEvent, firstEvent];

    const overview = deriveInAppNotificationsFromCommittedEvents({
      orgId,
      recipientUserId: managerUser.id,
      recipientRole: "manager",
      trips: notificationsRepo.dataset.trips,
      auditEvents: duplicateEvents,
      readReceipts: [],
    });

    expect(overview.items.length).toBe(1);
    expect(overview.totalCount).toBe(1);
  });

  it("marks single notifications and all notifications as read idempotently", async () => {
    const { tenancyRepo, notificationsRepo } = setupFixture();

    // List notifications before read
    const before = await listInAppNotificationsForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: {},
      tenancyRepository: tenancyRepo,
      notificationsRepository: notificationsRepo,
    });
    expect(before.unreadCount).toBe(1);

    // Mark single notification read
    const receipt = await markInAppNotificationReadForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawInput: { auditEventId: "00000000-0000-4000-8000-000000000001" },
      tenancyRepository: tenancyRepo,
      notificationsRepository: notificationsRepo,
    });
    expect(receipt.auditEventId).toBe("00000000-0000-4000-8000-000000000001");
    expect(receipt.userId).toBe(managerUser.id);

    // List notifications after read
    const after = await listInAppNotificationsForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawQuery: {},
      tenancyRepository: tenancyRepo,
      notificationsRepository: notificationsRepo,
    });
    expect(after.unreadCount).toBe(0);
    expect(after.items[0]?.isRead).toBe(true);

    // Mark all as read action
    const markAllReceipt = await markInAppNotificationReadForOrg({
      user: managerUser,
      candidateOrgId: orgId,
      rawInput: { action: "mark_all_read" },
      tenancyRepository: tenancyRepo,
      notificationsRepository: notificationsRepo,
    });
    expect(markAllReceipt.readAt).toBeDefined();
  });

  it("safely attempts email delivery without leaking secrets or throwing on provider error", async () => {
    const { notificationsRepo } = setupFixture();
    const overview = deriveInAppNotificationsFromCommittedEvents({
      orgId,
      recipientUserId: managerUser.id,
      recipientRole: "manager",
      trips: notificationsRepo.dataset.trips,
      auditEvents: notificationsRepo.dataset.auditEvents,
      readReceipts: [],
    });

    const notif = overview.items[0];
    if (!notif) throw new Error("Expected notification item");

    // 1. Unconfigured provider does not crash and reports truth
    const unconfigured = new UnconfiguredEmailProvider();
    const unconfiguredResult = await attemptSafeNotificationEmail({
      provider: unconfigured,
      recipientEmail: "manager@company.com",
      notification: notif,
    });
    expect(unconfiguredResult.delivered).toBe(false);
    expect(unconfiguredResult.provider).toBe("unconfigured");

    // 2. Faulty provider does not bubble errors to caller
    const failingProvider: EmailDeliveryProvider = {
      async sendEmail() {
        throw new Error("Connection timed out to SMTP gateway");
      },
    };

    const failedResult = await attemptSafeNotificationEmail({
      provider: failingProvider,
      recipientEmail: "manager@company.com",
      notification: notif,
    });
    expect(failedResult.delivered).toBe(false);
    expect(failedResult.error).toContain("timed out");

    // 3. Payload sanitization excludes coordinates, raw tokens, or secrets
    const safeContent = buildSafeEmailContent(notif);
    expect(safeContent.subject).toContain("FieldTrack");
    expect(safeContent.textContent).not.toContain("password");
    expect(safeContent.textContent).not.toContain("token");
    expect(safeContent.textContent).not.toContain("lat");
  });
});
