import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";

export default function NotFoundPage(): ReactNode {
  return (
    <EmptyState
      title="Page not found"
      description="The requested field operations route does not exist or has moved."
      actionLabel="Return to Overview"
      actionHref="/"
    />
  );
}
