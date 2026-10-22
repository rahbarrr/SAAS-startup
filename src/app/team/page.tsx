import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";

export default function TeamPage(): ReactNode {
  return (
    <>
      <section aria-labelledby="team-heading">
        <h1 id="team-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Organization Team &amp; Memberships
        </h1>
        <p className="card-meta">
          Manage organization roles (Admin, Manager, Field Employee) and same-organization
          reporting lines.
        </p>
      </section>

      <EmptyState
        title="Sign in to view organization members"
        description="Organization membership lists are isolated per tenant and require an active authenticated membership."
      />
    </>
  );
}
