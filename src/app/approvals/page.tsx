import type { ReactNode } from "react";
import { ApprovalsInboxClient } from "@/components/approvals/ApprovalsInboxClient";
import { ErrorState } from "@/components/ui/States";
import { requireActiveWorkspace } from "@/lib/auth/workspace-context";
import type { Trip } from "@/modules/trips/domain";
import { SupabaseTripsRepository } from "@/modules/trips/repository";
import { listManagerApprovalInboxForOrg } from "@/modules/trips/service";

export default async function ApprovalsPage(): Promise<ReactNode> {
  const context = await requireActiveWorkspace();
  const { user, activeOrgId, activeOrg, role, tenancyRepository, supabase } = context;

  const isManagerOrAdmin = role === "manager" || role === "admin";
  let trips: readonly Trip[] = [];
  let errorMessage: string | null = null;

  try {
    if (isManagerOrAdmin) {
      const tripsRepository = new SupabaseTripsRepository(supabase);
      const result = await listManagerApprovalInboxForOrg({
        user,
        candidateOrgId: activeOrgId,
        rawQuery: { status: "submitted", limit: 50 },
        tenancyRepository,
        tripsRepository,
      });

      trips = result.items;
    }
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Unable to load approval inbox for your active organization.";
  }

  if (errorMessage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="inbox-heading">
          <h1 id="inbox-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Manager Approval Inbox
          </h1>
        </section>
        <ErrorState title="Failed to load approvals" message={errorMessage} />
      </div>
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <section aria-labelledby="inbox-heading">
          <h1 id="inbox-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            Manager Approval Inbox
          </h1>
        </section>
        <div
          role="note"
          className="card"
          style={{ padding: "1.25rem", fontSize: "0.9375rem" }}
        >
          <strong>Role Notice:</strong> You are currently signed in as a{" "}
          <code>{role}</code>. Reviewing and deciding trip approval submissions requires
          an active manager or admin workspace membership.
        </div>
      </div>
    );
  }

  return (
    <ApprovalsInboxClient
      initialTrips={trips}
      activeOrgId={activeOrgId}
      activeOrgName={activeOrg.name}
      currentUserId={user.id}
    />
  );
}
