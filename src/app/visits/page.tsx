import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";
import { getSyncStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";

export default function VisitsPage(): ReactNode {
  return (
    <>
      <section aria-labelledby="visits-heading">
        <div className="card-header">
          <h1 id="visits-heading" style={{ margin: 0, fontSize: "1.5rem" }}>
            Store Visits &amp; Evidence
          </h1>
          <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
        </div>
        <p className="card-meta">
          Capture store check-ins, shelf/stock evidence, and visit outcome notes.
        </p>
      </section>

      <EmptyState
        title="No store visits recorded in this period"
        description="Select an approved trip or start an ad-hoc store check-in to capture visit evidence."
      />
    </>
  );
}
