import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";

export default function TripsPage(): ReactNode {
  return (
    <>
      <section aria-labelledby="trips-heading">
        <div className="card-header">
          <h1 id="trips-heading" style={{ margin: 0, fontSize: "1.5rem" }}>
            Field Trips
          </h1>
          <StatusBadge descriptor={getApprovalStatusDescriptor("draft")} />
        </div>
        <p className="card-meta">
          Plan multi-store routes, submit for manager approval, and track field execution.
        </p>
      </section>

      <EmptyState
        title="No field trips created yet"
        description="Create a draft trip plan with target retail stores and submit it to your organization manager for approval."
      />
    </>
  );
}
