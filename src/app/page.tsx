import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";
import {
  getApprovalStatusDescriptor,
  getProvenanceStatusDescriptor,
  getSyncStatusDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";

export default function HomePage(): ReactNode {
  return (
    <>
      <section aria-labelledby="overview-heading">
        <h1 id="overview-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Field Operations Overview
        </h1>
        <p className="card-meta">
          Multi-tenant operations workspace with server-verified organization membership
          and explicit workflow status indicators.
        </p>
      </section>

      <section className="card-grid" aria-label="Operational status summary">
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Trip Approvals</h2>
            <StatusBadge descriptor={getApprovalStatusDescriptor("submitted")} />
          </div>
          <p className="card-meta">
            Field trips require manager or admin approval before execution in the active
            organization.
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Store Visit Sync</h2>
            <StatusBadge descriptor={getSyncStatusDescriptor("synced")} />
          </div>
          <p className="card-meta">
            Check-ins, shelf evidence, and outcome notes display real-time sync and
            queuing status.
          </p>
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Outcome Verification</h2>
            <StatusBadge descriptor={getProvenanceStatusDescriptor("human_verified")} />
          </div>
          <p className="card-meta">
            Every visit summary clearly distinguishes human-verified outcomes from draft
            or generated notes.
          </p>
        </article>
      </section>

      <EmptyState
        title="No active field trips scheduled for today"
        description="Start by planning a store route for your territory or recording an on-site store visit."
        actionLabel="Plan Field Trip"
        actionHref="/trips"
      />
    </>
  );
}
