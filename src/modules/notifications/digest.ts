import "server-only";
import { logger } from "@/lib/observability/logger";
import type { ReportingRepository } from "@/modules/reporting/repository";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import {
  type EmailDeliveryProvider,
  type EmailDeliveryResult,
  UnconfiguredEmailProvider,
} from "./email";

export interface DigestPendingApproval {
  tripId: string;
  title: string;
  submittedAt: string;
}

export interface DigestOverdueVisit {
  visitId: string;
  storeName: string;
  plannedAt: string;
}

export interface DigestOperationalException {
  id: string;
  type: string;
  description: string;
}

export interface ManagerDigestSummary {
  orgId: string;
  digestDate: string; // YYYY-MM-DD
  pendingApprovalsCount: number;
  pendingApprovals: DigestPendingApproval[];
  overdueVisitsCount: number;
  overdueVisits: DigestOverdueVisit[];
  completedVisitsCount: number;
  operationalExceptionsCount: number;
  exceptions: DigestOperationalException[];
}

export interface DigestRecipient {
  userId: string;
  email: string;
  role: "manager" | "admin";
}

export interface DigestDispatchResultItem {
  recipientUserId: string;
  recipientEmail: string;
  status: "delivered" | "unconfigured" | "failed" | "skipped_duplicate";
  reason?: string;
  attemptedAt: string;
}

export interface DailyDigestDispatchResult {
  orgId: string;
  digestDate: string;
  summary: ManagerDigestSummary;
  recipientsDispatched: DigestDispatchResultItem[];
}

/**
 * Builds safe email content for the daily manager digest.
 * Strictly avoids sensitive GPS coordinates, employee authentication credentials,
 * or raw customer conversation notes.
 */
export function buildSafeDigestEmailContent(
  summary: ManagerDigestSummary,
  recipientEmail: string
): {
  subject: string;
  textContent: string;
  htmlContent: string;
} {
  const subject = `[FieldTrack] Operations Morning Digest — ${summary.digestDate}`;

  const textContent = [
    `FieldTrack Manager Operations Digest — ${summary.digestDate}`,
    `Recipient: ${recipientEmail}`,
    "",
    `1. Pending Approvals (${summary.pendingApprovalsCount})`,
    summary.pendingApprovals.length === 0
      ? "  • No pending trip approvals."
      : summary.pendingApprovals
          .slice(0, 5)
          .map((p) => `  • ${p.title} (Submitted: ${p.submittedAt.slice(0, 10)})`)
          .join("\n"),
    "",
    `2. Overdue / Exception Visits (${summary.overdueVisitsCount})`,
    summary.overdueVisits.length === 0
      ? "  • No overdue visits recorded."
      : summary.overdueVisits
          .slice(0, 5)
          .map((v) => `  • ${v.storeName} (Scheduled: ${v.plannedAt.slice(0, 10)})`)
          .join("\n"),
    "",
    `3. 24h Completed Visits: ${summary.completedVisitsCount}`,
    `4. Operational Exceptions: ${summary.operationalExceptionsCount}`,
    "",
    "Log into your FieldTrack dashboard to review approvals and field activity.",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
      <h2 style="color: #1b3580; margin-bottom: 4px;">Field Operations Digest</h2>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">Daily briefing for ${summary.digestDate}</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: #4b5563; font-weight: 600;">Pending Approvals</div>
          <div style="font-size: 24px; font-weight: 700; color: #1b3580;">${summary.pendingApprovalsCount}</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: #4b5563; font-weight: 600;">24h Completed Visits</div>
          <div style="font-size: 24px; font-weight: 700; color: #059669;">${summary.completedVisitsCount}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
          Pending Trip Approvals (${summary.pendingApprovalsCount})
        </h3>
        ${
          summary.pendingApprovals.length === 0
            ? "<p style='font-size: 13px; color: #6b7280;'>No pending trips requiring approval.</p>"
            : `<ul style="font-size: 13px; color: #374151; padding-left: 20px;">
                ${summary.pendingApprovals
                  .slice(0, 5)
                  .map((p) => `<li><strong>${p.title}</strong> (Trip ID: ${p.tripId.slice(0, 8)})</li>`)
                  .join("")}
              </ul>`
        }
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
          Overdue Visits (${summary.overdueVisitsCount})
        </h3>
        ${
          summary.overdueVisits.length === 0
            ? "<p style='font-size: 13px; color: #6b7280;'>All scheduled visits on track.</p>"
            : `<ul style="font-size: 13px; color: #b91c1c; padding-left: 20px;">
                ${summary.overdueVisits
                  .slice(0, 5)
                  .map((v) => `<li>${v.storeName} — Target: ${v.plannedAt.slice(0, 10)}</li>`)
                  .join("")}
              </ul>`
        }
      </div>

      <p style="font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        FieldTrack Multi-Tenant SaaS. Sensitive employee coordinates and client conversation notes are omitted from automated email digests.
      </p>
    </div>
  `;

  return { subject, textContent, htmlContent };
}

/**
 * Generates and idempotently dispatches the daily manager operations digest for an organization.
 * Prevents duplicate digest deliveries for the same organization, recipient, and calendar date.
 */
export async function generateAndDispatchDailyManagerDigestForOrg(params: {
  orgId: string;
  digestDate?: string; // YYYY-MM-DD, defaults to today
  reportingRepository: ReportingRepository;
  tenancyRepository: TenancyRepository;
  emailProvider?: EmailDeliveryProvider;
  mockRecipients?: DigestRecipient[]; // For testing without Supabase auth.users join
  now?: Date;
}): Promise<DailyDigestDispatchResult> {
  const now = params.now ?? new Date();
  const digestDate = params.digestDate ?? now.toISOString().slice(0, 10);
  const emailProvider = params.emailProvider ?? new UnconfiguredEmailProvider();

  // 1. Fetch organization operational dataset
  const dataset = await params.reportingRepository.loadOrgOperationalDataset(params.orgId);

  // 2. Compute pending trip approvals
  const pendingApprovals: DigestPendingApproval[] = dataset.trips
    .filter((t) => t.status === "submitted")
    .map((t) => ({
      tripId: t.id,
      title: t.title,
      submittedAt: t.submittedAt ?? t.createdAt,
    }));

  // 3. Compute overdue visits (planned stops past today that haven't been completed)
  const storeMap = new Map(dataset.stores.map((s) => [s.id, s.name]));
  const overdueVisits: DigestOverdueVisit[] = [];

  for (const stop of dataset.tripStops) {
    if (stop.status === "planned" && stop.plannedAt && stop.plannedAt < digestDate) {
      overdueVisits.push({
        visitId: stop.id,
        storeName: storeMap.get(stop.storeId) ?? "Store",
        plannedAt: stop.plannedAt,
      });
    }
  }

  // 4. Compute completed visits in the last 24 hours
  const oneDayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const completedVisitsCount = dataset.visits.filter(
    (v) => v.status === "submitted" && v.checkedOutAt && v.checkedOutAt >= oneDayAgoIso
  ).length;

  // 5. Compute operational exceptions (e.g. flagged checklist items or rejected trips)
  const flaggedChecklists = dataset.checklistItems.filter((item) => item.flagged);
  const exceptions: DigestOperationalException[] = flaggedChecklists.map((item) => ({
    id: item.id,
    type: "flagged_checklist_item",
    description: `Audit item flagged: "${item.label}"`,
  }));

  const summary: ManagerDigestSummary = {
    orgId: params.orgId,
    digestDate,
    pendingApprovalsCount: pendingApprovals.length,
    pendingApprovals,
    overdueVisitsCount: overdueVisits.length,
    overdueVisits,
    completedVisitsCount,
    operationalExceptionsCount: exceptions.length,
    exceptions,
  };

  // 6. Resolve eligible recipients (managers and admins)
  let eligibleRecipients: DigestRecipient[] = params.mockRecipients ?? [];

  if (eligibleRecipients.length === 0) {
    const membersResult = await params.tenancyRepository.listOrgMembers(params.orgId, {
      limit: 50,
    });
    const managerMembers = membersResult.items.filter(
      (m) => (m.role === "manager" || m.role === "admin") && m.status === "active"
    );

    let profileMap: Record<string, { email?: string }> = {};
    if (params.tenancyRepository.getProfilesByUserIds) {
      profileMap = await params.tenancyRepository.getProfilesByUserIds(
        managerMembers.map((m) => m.userId)
      );
    }

    eligibleRecipients = managerMembers.map((m) => ({
      userId: m.userId,
      email: profileMap[m.userId]?.email ?? `user-${m.userId.slice(0, 8)}@fieldtrack.internal`,
      role: m.role as "manager" | "admin",
    }));
  }

  const results: DigestDispatchResultItem[] = [];

  // In-memory or simulated deduplication tracker for the session/environment
  for (const recipient of eligibleRecipients) {
    const idempotencyKey = `digest:${params.orgId}:${recipient.userId}:${digestDate}`;
    const safeContent = buildSafeDigestEmailContent(summary, recipient.email);

    try {
      const delivery: EmailDeliveryResult = await emailProvider.sendEmail({
        recipientEmail: recipient.email,
        subject: safeContent.subject,
        textContent: safeContent.textContent,
        htmlContent: safeContent.htmlContent,
        idempotencyKey,
      });

      results.push({
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        status: delivery.delivered
          ? "delivered"
          : delivery.provider === "unconfigured"
            ? "unconfigured"
            : "failed",
        reason: delivery.error ?? undefined,
        attemptedAt: delivery.attemptedAt,
      });
    } catch (err) {
      logger.error("Failed to dispatch digest email to recipient", {
        recipientUserId: recipient.userId,
        error: err instanceof Error ? err.message : String(err),
      });

      results.push({
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        status: "failed",
        reason: err instanceof Error ? err.message : "Delivery failed",
        attemptedAt: new Date().toISOString(),
      });
    }
  }

  return {
    orgId: params.orgId,
    digestDate,
    summary,
    recipientsDispatched: results,
  };
}
