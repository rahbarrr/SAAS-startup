"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { getApprovalStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type { TripStatus } from "@/modules/trips/domain";

interface TripSummaryCard {
  id: string;
  title: string;
  purpose: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  stopCount: number;
}

const SAMPLE_TRIPS: readonly TripSummaryCard[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    title: "Q4 Endcap Audit — Downtown",
    purpose: "Verify promotional endcap compliance and restock levels",
    startDate: "2026-10-25",
    endDate: "2026-10-26",
    status: "draft",
    stopCount: 1,
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    title: "Lakeside Beverage Merchandising Run",
    purpose: "Beverage cooler reset and POS display installation",
    startDate: "2026-10-27",
    endDate: "2026-10-28",
    status: "submitted",
    stopCount: 1,
  },
];

export default function TripsPage(): ReactNode {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTrips = SAMPLE_TRIPS.filter((t) =>
    statusFilter === "all" ? true : t.status === statusFilter
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="trips-heading">
        <div className="card-header">
          <div>
            <h1 id="trips-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Field Trips
            </h1>
            <p className="card-meta">
              Plan multi-store routes, submit for manager approval, and review outcomes.
              Field employees see their own trips; managers see all organization trips.
            </p>
          </div>
          <Link href="/trips/new" className="btn btn-primary">
            + Create Trip Draft
          </Link>
        </div>
      </section>

      <section className="card" aria-label="Filter trips by workflow status">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label htmlFor="trip-status-filter" style={{ fontWeight: 600 }}>
            Workflow Status:
          </label>
          <select
            id="trip-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minHeight: "var(--touch-target-min)",
              padding: "0.375rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--bg-surface)",
              fontWeight: 600,
            }}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </section>

      {filteredTrips.length === 0 ? (
        <EmptyState
          title="No field trips match the selected status"
          description="Create a draft trip plan with ordered store stops and submit it for manager approval."
          actionLabel="Create Trip Draft"
          actionHref="/trips/new"
        />
      ) : (
        <section className="card-grid" aria-label="Field trips list">
          {filteredTrips.map((trip) => (
            <article key={trip.id} className="card">
              <div className="card-header">
                <h2 className="card-title">{trip.title}</h2>
                <StatusBadge descriptor={getApprovalStatusDescriptor(trip.status)} />
              </div>
              <p className="card-meta">
                <strong>Dates:</strong> {trip.startDate} to {trip.endDate} •{" "}
                <strong>Stops:</strong> {trip.stopCount}
              </p>
              <p className="card-meta">{trip.purpose}</p>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginTop: "0.5rem",
                }}
              >
                <Link href={`/trips/${trip.id}`} className="btn btn-secondary">
                  View Trip Detail
                </Link>
                {trip.status === "draft" ||
                trip.status === "changes_requested" ||
                trip.status === "approved" ? (
                  <Link href={`/trips/${trip.id}/edit`} className="btn btn-secondary">
                    Edit Plan
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
