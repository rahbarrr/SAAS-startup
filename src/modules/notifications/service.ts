import "server-only";
import { AppError } from "@/lib/http/envelope";
import { resolveTenantContext } from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import {
  deriveInAppNotificationsFromCommittedEvents,
  type InAppNotificationsOverview,
  type NotificationReadReceipt,
} from "./domain";
import type { NotificationsRepository } from "./repository";
import { listNotificationsQuerySchema, markNotificationReadInputSchema } from "./schemas";

export async function listInAppNotificationsForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  notificationsRepository: NotificationsRepository;
}): Promise<InAppNotificationsOverview> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  const query = listNotificationsQuerySchema.parse(params.rawQuery ?? {});
  const dataset =
    await params.notificationsRepository.loadOrgCommittedNotificationDataset({
      orgId: context.orgId,
      userId: context.user.id,
    });

  const overview = deriveInAppNotificationsFromCommittedEvents({
    orgId: context.orgId,
    recipientUserId: context.user.id,
    recipientRole: context.role,
    trips: dataset.trips,
    auditEvents: dataset.auditEvents,
    readReceipts: dataset.readReceipts,
    onlyUnread: query.onlyUnread,
  });

  return {
    ...overview,
    items: overview.items.slice(0, query.limit),
  };
}

export async function markInAppNotificationReadForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  notificationsRepository: NotificationsRepository;
}): Promise<NotificationReadReceipt> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  const input = markNotificationReadInputSchema.parse(params.rawInput ?? {});
  const dataset =
    await params.notificationsRepository.loadOrgCommittedNotificationDataset({
      orgId: context.orgId,
      userId: context.user.id,
    });

  const overview = deriveInAppNotificationsFromCommittedEvents({
    orgId: context.orgId,
    recipientUserId: context.user.id,
    recipientRole: context.role,
    trips: dataset.trips,
    auditEvents: dataset.auditEvents,
    readReceipts: dataset.readReceipts,
  });

  const targetNotification = overview.items.find(
    (item) => item.auditEventId === input.auditEventId
  );

  if (!targetNotification) {
    throw new AppError(
      "FORBIDDEN_RESOURCE_ACCESS",
      "You do not have permission to access this notification",
      403
    );
  }

  return params.notificationsRepository.markNotificationReadIdempotent({
    orgId: context.orgId,
    userId: context.user.id,
    auditEventId: input.auditEventId,
  });
}
