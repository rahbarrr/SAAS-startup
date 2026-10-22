import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";

export default function ApprovalsPage(): ReactNode {
  return (
    <>
      <section aria-labelledby="approvals-heading">
        <div className="card-header">
          <h1 id="approvals-heading" style={{ margin: 0, fontSize: "1.5rem" }}>
            Manager Approvals Queue
          </h1>
          <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
        </div>
        <p className="card-meta">
          Review submitted field trips and store visit outcomes for your organization.
          Only active managers and admins can approve or reject.
        </p>
      </section>

      <EmptyState
        title="Approval queue is clear"
        description="There are no submitted trip plans or store visit outcomes awaiting manager review."
      />
    </>
  );
}
