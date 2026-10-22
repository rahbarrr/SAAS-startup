import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";

export default function EditTripPage(): ReactNode {
  return (
    <TripPlanForm
      mode="edit"
      initialTitle="Q4 Endcap Audit — Downtown"
      initialPurpose="Verify promotional endcap compliance and restock levels"
      initialStartDate="2026-10-25"
      initialEndDate="2026-10-26"
      initialStatus="draft"
      initialStops={[
        {
          storeId: "40000000-0000-4000-8000-000000000001",
          plannedAt: "2026-10-25T09:30:00Z",
        },
      ]}
    />
  );
}
