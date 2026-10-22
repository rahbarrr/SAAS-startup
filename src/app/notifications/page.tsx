import type { ReactNode } from "react";
import { InAppNotificationsList } from "@/components/notifications/InAppNotificationsList";
import { ErrorState } from "@/components/ui/States";
import { getSyncStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { getActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import {
  EXTERNAL_DELIVERY_DISCLAIMER,
  type InAppNotification,
} from "@/modules/notifications/domain";
import { SupabaseNotificationsRepository } from "@/modules/notifications/repository";
import { listInAppNotificationsForOrg } from "@/modules/notifications/service";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { resolveActiveWorkspaceForUser } from "@/modules/tenancy/service";

export default async function NotificationsPage(): Promise<ReactNode> {
  let activeOrgId: string | null = null;
  let activeOrgName: string | null = null;
  let items: readonly InAppNotification[] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      const preferredOrgId = await getActiveOrgCookie();
      const tenancyRepository = new SupabaseTenancyRepository(supabase);
      const workspace = await resolveActiveWorkspaceForUser({
        user,
        preferredOrgId,
        repository: tenancyRepository,
      });

      if (workspace.activeOrganization) {
        activeOrgId = workspace.activeOrganization.organization.id;
        activeOrgName = workspace.activeOrganization.organization.name;

        const notificationsRepository = new SupabaseNotificationsRepository(supabase);
        const overview = await listInAppNotificationsForOrg({
          user,
          candidateOrgId: activeOrgId,
          rawQuery: {},
          tenancyRepository,
          notificationsRepository,
        });
        items = overview.items;
      }
    }
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
              {activeOrgName
                ? `Active Organization: ${activeOrgName} (${activeOrgId})`
                : "Sign in to view committed trip submission and approval decision notifications."}
            </p>
          </div>
          <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
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
