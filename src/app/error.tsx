"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactNode {
  return (
    <ErrorState
      title="Something went wrong in this workspace view"
      message={
        error.message ||
        "An unexpected error occurred while loading your organization data."
      }
      onRetry={reset}
    />
  );
}
