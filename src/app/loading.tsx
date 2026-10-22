import type { ReactNode } from "react";
import { LoadingState } from "@/components/ui/States";

export default function GlobalLoading(): ReactNode {
  return <LoadingState label="Loading FieldTrack workspace…" />;
}
