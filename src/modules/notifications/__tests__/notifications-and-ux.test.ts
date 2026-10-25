import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyRequestFailure,
  createInFlightActionGuard,
  formatCalendarDateOnlyUtc,
  formatUtcTimestamp,
  truncateDisplayLabel,
} from "@/lib/ux/formatting-and-resilience";
import {
  deriveInAppNotificationsFromCommittedEvents,
  type NotificationReadReceipt,
} from "@/modules/notifications/domain";
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
import type { Trip, TripAuditEvent } from "@/modules/trips/domain";

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const MANAGER_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "marcus@acme-field.example",
};
const FIONA_EMPLOYEE_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "fiona@acme-field.example",
};
const OTHER_EMPLOYEE_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000009",
  email: "evan@acme-field.example",
};
const MANAGER_B: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000005",
  email: "brenda@beta-retail.example",
};

const TRIP_FIONA_ID = "50000000-0000-4000-8000-000000000001";
const TRIP_MARCUS_ID = "50000000-0000-4000-8000-000000000002";

const EVT_FIONA_SUBMITTED_ID = "e0000000-0000-4000-8000-000000000001";
const EVT_FIONA_CHANGES_REQ_ID = "e0000000-0000-4000-8000-000000000002";
const EVT_FIONA_RESUBMITTED_ID = "e0000000-0000-4000-8000-000000000003";
const EVT_FIONA_APPROVED_ID = "e0000000-0000-4000-8000-000000000004";
const EVT_MARCUS_SELF_SUBMITTED_ID = "e0000000-0000-4000-8000-000000000005";

class FakeTenancyRepository implements TenancyRepository {
  private readonly orgs = new Map<string, Organization>([
    [
      ORG_A_ID,
      {
        id: ORG_A_ID,
        name: "Acme Retail Merchandising",
        slug: "acme-retail",
        status: "active",
        createdBy: MANAGER_A.id,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    [
      ORG_B_ID,
      {
        id: ORG_B_ID,
        name: "Beta Stores",
        slug: "beta-stores",
        status: "active",
        createdBy: MANAGER_B.id,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
  ]);

  private readonly memberships: OrganizationMembership[] = [
    {
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_A_ID,
      userId: MANAGER_A.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      orgId: ORG_A_ID,
      userId: FIONA_EMPLOYEE_A.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000009",
      orgId: ORG_A_ID,
      userId: OTHER_EMPLOYEE_A.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      orgId: ORG_B_ID,
      userId: MANAGER_B.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.orgId === orgId && m.userId === userId) ?? null;
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.memberships
      .filter((m) => m.userId === userId)
      .map((membership) => {
        const organization = this.orgs.get(membership.orgId);
        if (!organization) {
          throw new Error("Missing organization fixture");
        }
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(
    _userId: string,
    _input: CreateOrganizationInput
  ): Promise<Organization> {
    throw new Error("Not used");
  }

  async listOrgMembers(
    _orgId: string,
    _query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    throw new Error("Not used");
  }

  async addOrgMember(
    _orgId: string,
    _input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }

  async createOrgInvitation(
    _input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    throw new Error("Not used");
  }

  async acceptOrgInvitationByTokenHash(): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }
}

class InMemoryNotificationsRepository implements NotificationsRepository {
  public readReceipts: NotificationReadReceipt[] = [];

  public trips: Trip[] = [
    {
      id: TRIP_FIONA_ID,
      orgId: ORG_A_ID,
      ownerUserId: FIONA_EMPLOYEE_A.id,
      title:
        "North-East Flagship & Regional Supercenter Q4 Promotional Compliance Audit Route",
      startDate: "2026-10-25",
      endDate: "2026-10-26",
      purpose: "Audit Q4 promotional endcaps",
      status: "approved",
      submittedAt: "2026-10-22T09:00:00.000Z",
      decidedBy: MANAGER_A.id,
      decidedAt: "2026-10-22T11:00:00.000Z",
      decisionNote: "Approved after adding store #204",
      createdAt: "2026-10-22T08:00:00.000Z",
      updatedAt: "2026-10-22T11:00:00.000Z",
    },
    {
      id: TRIP_MARCUS_ID,
      orgId: ORG_A_ID,
      ownerUserId: MANAGER_A.id,
      title: "Manager Marcus Own Route (Cannot Self-Approve)",
      startDate: "2026-10-28",
      endDate: "2026-10-29",
      purpose: "Executive store walk",
      status: "submitted",
      submittedAt: "2026-10-22T11:30:00.000Z",
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: "2026-10-22T11:15:00.000Z",
      updatedAt: "2026-10-22T11:30:00.000Z",
    },
  ];

  public auditEvents: TripAuditEvent[] = [
    {
      id: EVT_FIONA_SUBMITTED_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_FIONA_ID,
      actorUserId: FIONA_EMPLOYEE_A.id,
      eventType: "trip_submitted",
      oldStatus: "draft",
      newStatus: "submitted",
      note: null,
      metadata: { stop_count: 1 },
      createdAt: "2026-10-22T09:00:00.000Z",
    },
    {
      id: EVT_FIONA_CHANGES_REQ_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_FIONA_ID,
      actorUserId: MANAGER_A.id,
      eventType: "trip_changes_requested",
      oldStatus: "submitted",
      newStatus: "changes_requested",
      note: "Please include store #204",
      metadata: { stop_count: 1 },
      createdAt: "2026-10-22T09:30:00.000Z",
    },
    {
      id: EVT_FIONA_RESUBMITTED_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_FIONA_ID,
      actorUserId: FIONA_EMPLOYEE_A.id,
      eventType: "trip_resubmitted",
      oldStatus: "changes_requested",
      newStatus: "submitted",
      note: "Added store #204",
      metadata: { stop_count: 2 },
      createdAt: "2026-10-22T10:15:00.000Z",
    },
    {
      id: EVT_FIONA_APPROVED_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_FIONA_ID,
      actorUserId: MANAGER_A.id,
      eventType: "trip_approved",
      oldStatus: "submitted",
      newStatus: "approved",
      note: "Approved after adding store #204",
      metadata: { stop_count: 2 },
      createdAt: "2026-10-22T11:00:00.000Z",
    },
    {
      id: EVT_MARCUS_SELF_SUBMITTED_ID,
      orgId: ORG_A_ID,
      tripId: TRIP_MARCUS_ID,
      actorUserId: MANAGER_A.id,
      eventType: "trip_submitted",
      oldStatus: "draft",
      newStatus: "submitted",
      note: null,
      metadata: { stop_count: 1 },
      createdAt: "2026-10-22T11:30:00.000Z",
    },
  ];

  async loadOrgCommittedNotificationDataset(params: {
    orgId: string;
    userId: string;
  }): Promise<OrgCommittedNotificationDataset> {
    return {
      trips: this.trips.filter((t) => t.orgId === params.orgId),
      auditEvents: this.auditEvents.filter((e) => e.orgId === params.orgId),
      readReceipts: this.readReceipts.filter(
        (r) => r.orgId === params.orgId && r.userId === params.userId
      ),
    };
  }

  async markNotificationReadIdempotent(params: {
    orgId: string;
    userId: string;
    auditEventId: string;
  }): Promise<NotificationReadReceipt> {
    const existing = this.readReceipts.find(
      (r) =>
        r.orgId === params.orgId &&
        r.userId === params.userId &&
        r.auditEventId === params.auditEventId
    );
    if (existing) {
      return existing;
    }

    const receipt: NotificationReadReceipt = {
      orgId: params.orgId,
      userId: params.userId,
      auditEventId: params.auditEventId,
      readAt: "2026-10-22T12:00:00.000Z",
    };
    this.readReceipts.push(receipt);
    return receipt;
  }

  async markAllNotificationsReadForOrg(params: {
    orgId: string;
    userId: string;
    auditEventIds: string[];
  }): Promise<NotificationReadReceipt[]> {
    const receipts: NotificationReadReceipt[] = [];
    for (const auditEventId of params.auditEventIds) {
      receipts.push(
        await this.markNotificationReadIdempotent({
          orgId: params.orgId,
          userId: params.userId,
          auditEventId,
        })
      );
    }
    return receipts;
  }
}

describe("Event-derived idempotent in-app notifications, UTC date/timestamp formatting, resilience guards, and WCAG accessibility", () => {
  it("derives in-app notifications from committed trip_audit_events, deduplicates retries, enforces role/owner routing, and never claims email/SMS/push delivery", async () => {
    const tenancyRepository = new FakeTenancyRepository();
    const notificationsRepository = new InMemoryNotificationsRepository();

    // 1. Manager Marcus sees Fiona's `trip_submitted` and `trip_resubmitted` events,
    //    but NOT his own submitted trip (`EVT_MARCUS_SELF_SUBMITTED_ID`, since self-approval is forbidden)
    const managerOverview = await listInAppNotificationsForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      notificationsRepository,
    });

    expect(managerOverview.deliveryChannel).toBe("in_app_only");
    expect(managerOverview.externalProvidersConfigured).toEqual({
      email: false,
      sms: false,
      push: false,
    });
    expect(managerOverview.items.map((i) => i.auditEventId)).toEqual([
      EVT_FIONA_RESUBMITTED_ID,
      EVT_FIONA_SUBMITTED_ID,
    ]);
    expect(managerOverview.unreadCount).toBe(2);

    // 2. Employee Fiona sees `trip_approved` and `trip_changes_requested` decisions on her trip
    const fionaOverview = await listInAppNotificationsForOrg({
      user: FIONA_EMPLOYEE_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      notificationsRepository,
    });

    expect(fionaOverview.items.map((i) => i.auditEventId)).toEqual([
      EVT_FIONA_APPROVED_ID,
      EVT_FIONA_CHANGES_REQ_ID,
    ]);
    expect(fionaOverview.unreadCount).toBe(2);

    // 3. Another employee (Evan) does not see Fiona's trip decisions or manager submission alerts
    const evanOverview = await listInAppNotificationsForOrg({
      user: OTHER_EMPLOYEE_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      notificationsRepository,
    });
    expect(evanOverview.items).toHaveLength(0);

    // 4. Cross-organization manager (Brenda in Org B) is denied access to Org A notifications
    await expect(
      listInAppNotificationsForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_A_ID,
        rawQuery: {},
        tenancyRepository,
        notificationsRepository,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN_ORG_ACCESS", status: 403 });

    // 5. Duplicate event rows in input never produce duplicate notifications (idempotency on retry)
    const duplicatedOverview = deriveInAppNotificationsFromCommittedEvents({
      orgId: ORG_A_ID,
      recipientUserId: FIONA_EMPLOYEE_A.id,
      recipientRole: "field_employee",
      trips: notificationsRepository.trips,
      auditEvents: [
        ...notificationsRepository.auditEvents,
        ...notificationsRepository.auditEvents,
      ],
      readReceipts: [],
    });
    expect(duplicatedOverview.items).toHaveLength(2);

    // 6. Marking a notification as read is idempotent on retries and updates unreadCount
    const firstReceipt = await markInAppNotificationReadForOrg({
      user: FIONA_EMPLOYEE_A,
      candidateOrgId: ORG_A_ID,
      rawInput: { auditEventId: EVT_FIONA_APPROVED_ID },
      tenancyRepository,
      notificationsRepository,
    });
    const retryReceipt = await markInAppNotificationReadForOrg({
      user: FIONA_EMPLOYEE_A,
      candidateOrgId: ORG_A_ID,
      rawInput: { auditEventId: EVT_FIONA_APPROVED_ID },
      tenancyRepository,
      notificationsRepository,
    });
    expect(retryReceipt).toEqual(firstReceipt);
    expect(notificationsRepository.readReceipts).toHaveLength(1);

    const fionaUnreadOnly = await listInAppNotificationsForOrg({
      user: FIONA_EMPLOYEE_A,
      candidateOrgId: ORG_A_ID,
      rawQuery: { onlyUnread: "true" },
      tenancyRepository,
      notificationsRepository,
    });
    expect(fionaUnreadOnly.unreadCount).toBe(1);
    expect(fionaUnreadOnly.items.map((i) => i.auditEventId)).toEqual([
      EVT_FIONA_CHANGES_REQ_ID,
    ]);
  });

  it("handles date-only vs UTC timestamps, long names, expired sessions, slow networks, and double-clicks", () => {
    // 1. Date-only strings (`YYYY-MM-DD`) never shift to the previous day in negative UTC offsets
    expect(formatCalendarDateOnlyUtc("2026-10-25")).toBe("Oct 25, 2026 (UTC)");
    expect(formatCalendarDateOnlyUtc("2026-01-01")).toBe("Jan 01, 2026 (UTC)");
    expect(formatCalendarDateOnlyUtc(null)).toBe("—");

    // 2. Server timestamps convert deterministically to UTC
    expect(formatUtcTimestamp("2026-10-22T14:30:00+05:30")).toBe("2026-10-22 09:00 UTC");

    // 3. Long store/trip names truncate cleanly while keeping full text for accessible attributes
    const longStoreName =
      "Super-Regional Flagship Hypermarket & Distribution Hub #9042 — North-Central Metropolitan District";
    const truncated = truncateDisplayLabel(longStoreName, 40);
    expect(truncated.isTruncated).toBe(true);
    expect(truncated.displayText.length).toBeLessThanOrEqual(40);
    expect(truncated.displayText.endsWith("…")).toBe(true);
    expect(truncated.fullText).toBe(longStoreName);

    // 4. Failure classification for expired sessions, slow networks, and conflicts
    const expired = classifyRequestFailure({
      status: 401,
      errorCode: "UNAUTHENTICATED",
    });
    expect(expired.category).toBe("expired_session");
    expect(expired.requiresReauth).toBe(true);
    expect(expired.canRetrySafely).toBe(false);

    const timeoutErr = new Error("Request timed out");
    timeoutErr.name = "AbortError";
    const slowNet = classifyRequestFailure({ networkError: timeoutErr });
    expect(slowNet.category).toBe("slow_network_or_timeout");
    expect(slowNet.canRetrySafely).toBe(true);

    const conflict = classifyRequestFailure({
      status: 409,
      errorCode: "CONFLICT",
    });
    expect(conflict.category).toBe("rate_limited_or_conflict");
    expect(conflict.canRetrySafely).toBe(false);

    // 5. Synchronous double-click guard prevents duplicate concurrent submissions
    const guard = createInFlightActionGuard();
    expect(guard.isInFlight()).toBe(false);
    expect(guard.tryAcquire()).toBe(true);
    expect(guard.isInFlight()).toBe(true);
    expect(guard.tryAcquire()).toBe(false); // second rapid click blocked!
    guard.release();
    expect(guard.isInFlight()).toBe(false);
    expect(guard.tryAcquire()).toBe(true);
  });

  it("verifies WCAG 2.1 AA focus, 44px touch targets, narrow-mobile rules, and accessible headings/labels across the app", () => {
    const cssContent = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8"
    );

    // Focus visibility, skip-link, 44px touch targets, and narrow-mobile breakpoint
    expect(cssContent).toContain(":focus-visible");
    expect(cssContent).toContain(".skip-link");
    expect(cssContent).toContain("--touch-target-min: 2.75rem");
    expect(cssContent).toContain("@media (max-width: 480px)");
    expect(cssContent).toContain(".break-long-words");
    expect(cssContent).toContain(".btn:disabled");

    // Primary pages have semantic <h1> headings and aria-labelledby sections
    const pagePaths = [
      "src/app/page.tsx",
      "src/app/stores/page.tsx",
      "src/app/trips/page.tsx",
      "src/app/visits/page.tsx",
      "src/app/approvals/page.tsx",
      "src/app/notifications/page.tsx",
    ];

    for (const relPath of pagePaths) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
      expect(content).toContain("<h1");
      expect(content).toContain("aria-labelledby");
    }
  });
});
