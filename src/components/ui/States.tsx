import Link from "next/link";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
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
      ) : actionLabel && onAction ? (
        <div style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={onAction} className="btn btn-primary">
            {actionLabel}
          </button>
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
    <section
      className="state-panel state-panel--loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <h2 className="state-title">{label}</h2>
      <p className="state-description">
        Verifying organization membership and fetching the latest field records.
      </p>
      <div className="bento-skeleton-grid" aria-hidden="true">
        <div className="bento-skeleton-card bento-skeleton-card--light">
          <div className="skeleton-line" style={{ maxWidth: "45%" }} />
          <div className="skeleton-line" style={{ maxWidth: "75%", height: "1.5rem" }} />
          <div className="skeleton-line" style={{ maxWidth: "90%" }} />
        </div>
        <div className="bento-skeleton-card bento-skeleton-card--obsidian">
          <div className="skeleton-line" style={{ maxWidth: "50%", opacity: 0.25 }} />
          <div
            className="skeleton-line"
            style={{ maxWidth: "65%", height: "1.5rem", opacity: 0.35 }}
          />
        </div>
      </div>
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
