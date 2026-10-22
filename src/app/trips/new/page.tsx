import type { ReactNode } from "react";
import { TripPlanForm } from "@/components/trips/TripPlanForm";

export default function NewTripPage(): ReactNode {
  return <TripPlanForm mode="create" />;
}
