import Link from "next/link";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps): ReactNode {
  return (
    <section className="state-panel" aria-label={title}>
      <h2 className="state-title">{title}</h2>
      <p className="state-description">{description}</p>
      {actionLabel && actionHref ? (
        <div style={{ marginTop: "0.5rem" }}>
          <Link href={actionHref} className="btn btn-primary">
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({
  label = "Loading field operations workspace…",
}: LoadingStateProps): ReactNode {
  return (
    <section className="state-panel" role="status" aria-live="polite" aria-busy="true">
      <h2 className="state-title">{label}</h2>
      <p className="state-description">
        Verifying organization membership and fetching the latest field records.
      </p>
      <div className="skeleton-line" aria-hidden="true" />
      <div className="skeleton-line" style={{ maxWidth: "18rem" }} aria-hidden="true" />
    </section>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Unable to load field data",
  message,
  onRetry,
}: ErrorStateProps): ReactNode {
  return (
    <section className="state-panel state-panel--error" role="alert" aria-atomic="true">
      <h2 className="state-title">{title}</h2>
      <p className="state-description">{message}</p>
      {onRetry ? (
        <div style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={onRetry} className="btn btn-secondary">
            Try Again
          </button>
        </div>
      ) : null}
    </section>
  );
}
