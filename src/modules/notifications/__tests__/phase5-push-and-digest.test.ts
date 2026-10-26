import { describe, expect, it } from "vitest";
import type {
  OrgOperationalDataset,
  ReportingRepository,
} from "@/modules/reporting/repository";
import type { MemberProfile } from "@/modules/tenancy/domain";
import type {
  PaginatedMembersResult,
  TenancyRepository,
} from "@/modules/tenancy/repository";
import type { ListOrgMembersQuery } from "@/modules/tenancy/schemas";
import { generateAndDispatchDailyManagerDigestForOrg } from "../digest";
import type {
  EmailDeliveryOptions,
  EmailDeliveryProvider,
  EmailDeliveryResult,
} from "../email";
import {
  buildSafeWebPushPayload,
  dispatchWebPushNotificationToUser,
  type WebPushRepository,
  type WebPushSender,
  type WebPushSubscriptionRecord,
} from "../push";

class MockEmailProvider implements EmailDeliveryProvider {
  public sentMails: EmailDeliveryOptions[] = [];
  public shouldFail = false;

  async sendEmail(options: EmailDeliveryOptions): Promise<EmailDeliveryResult> {
    if (this.shouldFail) {
      throw new Error("SMTP connection refused");
    }
    this.sentMails.push(options);
    return {
      provider: "smtp",
      delivered: true,
      messageId: `msg-${Date.now()}`,
      error: null,
      attemptedAt: new Date().toISOString(),
    };
  }
}

class MockReportingRepo implements ReportingRepository {
  constructor(private dataset: OrgOperationalDataset) {}

  async loadOrgOperationalDataset(_orgId: string): Promise<OrgOperationalDataset> {
    return this.dataset;
  }
  async getVisitPlannedVsActual(): Promise<never> {
    return null as never;
  }
}

class MockTenancyRepo implements TenancyRepository {
  async getMembershipByUserAndOrg(): Promise<never> {
    return null as never;
  }
  async listUserOrganizations(): Promise<never[]> {
    return [];
  }
  async createOrganizationWithOwner(): Promise<never> {
    return {} as never;
  }
  async listOrgMembers(
    _orgId: string,
    _query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    return {
      items: [
        {
          id: "mem-1",
          orgId: "org-1",
          userId: "user-mgr-1",
          role: "manager",
          status: "active",
          managerUserId: null,
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
      pagination: { hasMore: false, limit: 50, nextCursor: null },
    };
  }
  async addOrgMember(): Promise<never> {
    return {} as never;
  }
  async createOrgInvitation(): Promise<never> {
    return {} as never;
  }
  async acceptOrgInvitationByTokenHash(): Promise<never> {
    return {} as never;
  }
  async getProfilesByUserIds(_userIds: string[]): Promise<Record<string, MemberProfile>> {
    return {
      "user-mgr-1": {
        id: "user-mgr-1",
        email: "manager@company.internal",
        fullName: "Operations Lead",
      },
    };
  }
}

describe("Phase 5: Scheduled Manager Digest & Web Push Notifications", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  it("aggregates pending approvals, overdue visits, and operational exceptions accurately", async () => {
    const dataset: OrgOperationalDataset = {
      stores: [
        {
          id: "store-1",
          orgId,
          name: "Superstore Downtown",
          region: "Metro",
          city: "Metro City",
          stateProvince: "CA",
          countryCode: "US",
          addressLine1: "100 Broadway",
          addressLine2: null,
          postalCode: "90001",
          latitude: 34.05,
          longitude: -118.25,
          active: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      trips: [
        {
          id: "trip-sub-1",
          orgId,
          ownerUserId: "emp-1",
          title: "Q4 Shelf Audit Route",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          purpose: "Audits",
          status: "submitted",
          submittedAt: "2026-10-25T08:00:00Z",
          decidedBy: null,
          decidedAt: null,
          decisionNote: null,
          createdAt: "2026-10-25T07:00:00Z",
          updatedAt: "2026-10-25T08:00:00Z",
        },
      ],
      tripStops: [
        {
          id: "stop-overdue-1",
          orgId,
          tripId: "trip-sub-1",
          storeId: "store-1",
          sequenceNumber: 1,
          plannedAt: "2026-10-20T10:00:00Z", // Past date, overdue
          status: "planned",
          createdAt: "2026-10-20T08:00:00Z",
          updatedAt: "2026-10-20T08:00:00Z",
        },
      ],
      visits: [],
      checklistItems: [
        {
          id: "chk-flag-1",
          orgId,
          visitId: "v-1",
          questionKey: "stock_level",
          label: "Promotional Display Stocked",
          answerType: "boolean",
          answerValue: false,
          answerText: null,
          flagged: true,
          required: true,
          completedAt: "2026-10-25T09:00:00Z",
          completedBy: "emp-1",
          createdAt: "2026-10-25T08:00:00Z",
          updatedAt: "2026-10-25T09:00:00Z",
        },
      ],
      evidence: [],
      auditEvents: [],
    };

    const reportingRepo = new MockReportingRepo(dataset);
    const tenancyRepo = new MockTenancyRepo();
    const emailProvider = new MockEmailProvider();

    const result = await generateAndDispatchDailyManagerDigestForOrg({
      orgId,
      digestDate: "2026-10-25",
      reportingRepository: reportingRepo,
      tenancyRepository: tenancyRepo,
      emailProvider,
      mockRecipients: [
        {
          userId: "mgr-1",
          email: "mgr@fieldtrack.internal",
          role: "manager",
        },
      ],
    });

    expect(result.summary.pendingApprovalsCount).toBe(1);
    expect(result.summary.overdueVisitsCount).toBe(1);
    expect(result.summary.operationalExceptionsCount).toBe(1);
    expect(result.recipientsDispatched[0]?.status).toBe("delivered");
    expect(emailProvider.sentMails.length).toBe(1);

    // Verify safe email content: sensitive GPS coordinates and private notes are omitted
    const mailContent = emailProvider.sentMails[0];
    expect(mailContent?.subject).toMatch(/Morning Digest/i);
    expect(mailContent?.textContent).not.toMatch(/34\.05|latitude|longitude/);
  });

  it("safely handles non-blocking email transport failures without crashing digest generation", async () => {
    const dataset: OrgOperationalDataset = {
      stores: [],
      trips: [],
      tripStops: [],
      visits: [],
      checklistItems: [],
      evidence: [],
      auditEvents: [],
    };

    const reportingRepo = new MockReportingRepo(dataset);
    const tenancyRepo = new MockTenancyRepo();
    const failingProvider = new MockEmailProvider();
    failingProvider.shouldFail = true;

    const result = await generateAndDispatchDailyManagerDigestForOrg({
      orgId,
      digestDate: "2026-10-25",
      reportingRepository: reportingRepo,
      tenancyRepository: tenancyRepo,
      emailProvider: failingProvider,
      mockRecipients: [
        {
          userId: "mgr-2",
          email: "mgr2@fieldtrack.internal",
          role: "manager",
        },
      ],
    });

    expect(result.recipientsDispatched[0]?.status).toBe("failed");
    expect(result.recipientsDispatched[0]?.reason).toMatch(/refused|failed/i);
  });

  it("builds lock-screen safe web push payloads and handles subscription revocation / 410 cleanup", async () => {
    const safePush = buildSafeWebPushPayload({
      title: "Trip Approved: Regional Route",
      message: "Manager approved trip 00000000-0000-4000-8000-000000000001.",
      targetUrl: "/trips/00000000-0000-4000-8000-000000000001",
    });

    expect(safePush.title).toBe("Trip Approved: Regional Route");
    expect(safePush.icon).toBe("/icons/icon-192.svg");
    expect(safePush.targetUrl).toMatch(/\/trips\//);

    // Test subscription dispatch and 410 Gone cleanup
    let deletedEndpoint: string | null = null;
    const mockPushRepo: WebPushRepository = {
      async upsertSubscription(): Promise<never> {
        return {} as never;
      },
      async revokeSubscription(): Promise<boolean> {
        return true;
      },
      async listActiveSubscriptionsForUser(): Promise<WebPushSubscriptionRecord[]> {
        return [
          {
            id: "sub-1",
            orgId,
            userId: "user-1",
            endpoint: "https://fcm.googleapis.com/fcm/send/expired-sub",
            p256dhKey: "key-p256dh",
            authKey: "key-auth",
            userAgent: "Mozilla/5.0",
            revoked: false,
            createdAt: "2026-10-01T00:00:00Z",
            updatedAt: "2026-10-01T00:00:00Z",
          },
        ];
      },
      async deleteSubscriptionByEndpoint(_orgId, _userId, endpoint): Promise<void> {
        deletedEndpoint = endpoint;
      },
    };

    const mockSender: WebPushSender = {
      async sendPush(sub) {
        // Simulate provider responding with 410 Gone (unsubscribed)
        return {
          endpoint: sub.endpoint,
          sent: false,
          statusCode: 410,
          unsubscribed: true,
          error: "Push subscription has expired or been unsubscribed.",
        };
      },
    };

    const dispatchResults = await dispatchWebPushNotificationToUser({
      orgId,
      userId: "user-1",
      payload: safePush,
      pushRepository: mockPushRepo,
      pushSender: mockSender,
    });

    expect(dispatchResults.length).toBe(1);
    expect(dispatchResults[0]?.unsubscribed).toBe(true);
    expect(deletedEndpoint).toBe("https://fcm.googleapis.com/fcm/send/expired-sub");
  });
});
