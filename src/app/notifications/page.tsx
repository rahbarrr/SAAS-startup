import type { ReactNode } from "react";
import { InAppNotificationsList } from "@/components/notifications/InAppNotificationsList";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import {
  EXTERNAL_DELIVERY_DISCLAIMER,
  type InAppNotification,
} from "@/modules/notifications/domain";
import { SupabaseNotificationsRepository } from "@/modules/notifications/repository";
import { listInAppNotificationsForOrg } from "@/modules/notifications/service";

export default async function NotificationsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, tenancyRepository, supabase } = context;

  let items: readonly InAppNotification[] = [];
  let errorMessage: string | null = null;

  try {
    const notificationsRepository = new SupabaseNotificationsRepository(supabase);
    const overview = await listInAppNotificationsForOrg({
      user,
      candidateOrgId: activeOrgId,
      rawQuery: {},
      tenancyRepository,
      notificationsRepository,
    });
    items = overview.items;
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load in-app notifications for the active organization.";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="notifications-page-heading">
        <div className="card-header">
          <div>
            <h1
              id="notifications-page-heading"
              style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}
            >
              In-App Notifications
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrg.name}</strong> • Real-time notifications for
              trip submission and manager decisions.
            </p>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <ErrorState title="Notifications unavailable" message={errorMessage} />
      ) : null}

      <InAppNotificationsList
        orgId={activeOrgId}
        initialItems={items}
        externalDeliveryDisclaimer={EXTERNAL_DELIVERY_DISCLAIMER}
      />
    </div>
  );
}
