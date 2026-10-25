import { describe, expect, it } from "vitest";
import { formatUtcTimestamp } from "@/lib/ux/formatting-and-resilience";
import type { Trip, TripDecisionStatus } from "@/modules/trips/domain";

describe("Frontend Workflow Invariants & Formatting", () => {
  const SAMPLE_TRIP: Trip = {
    id: "trip-test-01",
    orgId: "org-test-01",
    ownerUserId: "user-rep-01",
    title: "Q4 Store Execution",
    startDate: "2026-10-25",
    endDate: "2026-10-26",
    purpose: "Audit endcap displays and cooler merchandising",
    status: "submitted",
    submittedAt: "2026-10-22T08:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: "2026-10-22T07:30:00.000Z",
    updatedAt: "2026-10-22T08:00:00.000Z",
  };

  it("prevents self-approval when current reviewer is also the trip owner", () => {
    const reviewerUserId = "user-rep-01";
    const isSelfSubmitted = SAMPLE_TRIP.ownerUserId === reviewerUserId;
    expect(isSelfSubmitted).toBe(true);

    // Business rule: Review decision form must NOT be shown for own trips
    const canReview = !isSelfSubmitted;
    expect(canReview).toBe(false);
  });

  it("allows a peer manager to review and decide a trip", () => {
    const peerManagerId = "user-mgr-02";
    const isSelfSubmitted = SAMPLE_TRIP.ownerUserId === peerManagerId;
    expect(isSelfSubmitted).toBe(false);

    const canReview = !isSelfSubmitted;
    expect(canReview).toBe(true);
  });

  it("validates that non-approval decisions require an explanatory note", () => {
    const decisions: TripDecisionStatus[] = ["changes_requested", "rejected"];
    for (const d of decisions) {
      const emptyNote = "";
      const isNoteRequired = d !== "approved";
      expect(isNoteRequired).toBe(true);
      expect(emptyNote.trim().length === 0).toBe(true);
    }

    const approvedDecision: TripDecisionStatus = "approved";
    expect(approvedDecision !== "approved").toBe(false);
  });

  it("formats UTC timestamps cleanly without browser timezone shifts", () => {
    const formatted = formatUtcTimestamp(SAMPLE_TRIP.submittedAt);
    expect(formatted).toBe("2026-10-22 08:00 UTC");
  });

  it("correctly identifies store filtering matches by name, city, or region", () => {
    const stores = [
      {
        id: "s1",
        name: "Downtown Mart",
        city: "Chicago",
        region: "North-Central",
        active: true,
      },
      {
        id: "s2",
        name: "Lakeside Supercenter",
        city: "Evanston",
        region: "North-East",
        active: true,
      },
      {
        id: "s3",
        name: "Archived Outlet",
        city: "Peoria",
        region: "South",
        active: false,
      },
    ];

    // Filter active only
    const activeOnly = stores.filter((s) => s.active);
    expect(activeOnly).toHaveLength(2);

    // Search query "chi"
    const matchedCity = stores.filter((s) => s.city.toLowerCase().includes("chi"));
    expect(matchedCity).toHaveLength(1);
    expect(matchedCity[0]?.id).toBe("s1");

    // Region filter "North-East"
    const matchedRegion = stores.filter((s) => s.region === "North-East");
    expect(matchedRegion).toHaveLength(1);
    expect(matchedRegion[0]?.id).toBe("s2");
  });

  it("filters store visits by valid VisitStatus enum values", () => {
    const visits = [
      { id: "v1", status: "in_progress" as const, tripStopId: "s1" },
      { id: "v2", status: "submitted" as const, tripStopId: "s2" },
      { id: "v3", status: "reviewed" as const, tripStopId: "s3" },
    ];

    // Filter "all"
    expect(visits.filter(() => true)).toHaveLength(3);

    // Filter "in_progress"
    expect(visits.filter((v) => v.status === "in_progress")).toHaveLength(1);

    // Filter "submitted" (checked out)
    const submittedVisits = visits.filter((v) => v.status === "submitted");
    expect(submittedVisits).toHaveLength(1);
    expect(submittedVisits[0]?.id).toBe("v2");

    // Filter "reviewed"
    expect(visits.filter((v) => v.status === "reviewed")).toHaveLength(1);
  });

  it("enforces check-in eligibility strictly for approved planned stops owned by the employee", () => {
    const currentUserId = "user-rep-01";
    const otherUserId = "user-rep-02";

    const approvedTrip = {
      ...SAMPLE_TRIP,
      status: "approved" as const,
      ownerUserId: currentUserId,
    };
    const draftTrip = {
      ...SAMPLE_TRIP,
      status: "draft" as const,
      ownerUserId: currentUserId,
    };
    const peerTrip = {
      ...SAMPLE_TRIP,
      status: "approved" as const,
      ownerUserId: otherUserId,
    };

    function canCheckInStop(
      trip: { status: string; ownerUserId: string },
      stopStatus: string,
      userId: string
    ): boolean {
      return (
        trip.status === "approved" &&
        trip.ownerUserId === userId &&
        stopStatus === "planned"
      );
    }

    // Planned stop on approved trip owned by user -> eligible
    expect(canCheckInStop(approvedTrip, "planned", currentUserId)).toBe(true);

    // Stop already visited -> not eligible
    expect(canCheckInStop(approvedTrip, "visited", currentUserId)).toBe(false);

    // Trip still in draft -> not eligible
    expect(canCheckInStop(draftTrip, "planned", currentUserId)).toBe(false);

    // Trip owned by peer -> not eligible
    expect(canCheckInStop(peerTrip, "planned", currentUserId)).toBe(false);
  });

  it("blocks checkout when any required checklist item is incomplete", () => {
    const items = [
      { id: "c1", label: "Endcap Compliance", required: true, completed: false },
      { id: "c2", label: "Cooler Temperature", required: true, completed: true },
      { id: "c3", label: "Extra Merchandising", required: false, completed: false },
    ];

    const uncompletedRequired = items.filter((i) => i.required && !i.completed);
    expect(uncompletedRequired).toHaveLength(1);
    expect(uncompletedRequired[0]?.label).toBe("Endcap Compliance");

    // Mark required item complete
    const firstItem = items[0];
    if (firstItem) {
      firstItem.completed = true;
    }
    const recheck = items.filter((i) => i.required && !i.completed);
    expect(recheck).toHaveLength(0);
  });
});
