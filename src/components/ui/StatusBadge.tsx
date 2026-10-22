import type { ReactNode } from "react";

export type SyncState = "synced" | "pending_sync" | "offline" | "sync_error";
export type ApprovalState =
  "draft" | "submitted" | "approved" | "rejected" | "in_progress" | "completed";
export type ProvenanceState = "human_verified" | "generated_draft";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusDescriptor {
  label: string;
  symbol: string;
  tone: StatusTone;
  ariaLabel: string;
}

const SYNC_DESCRIPTORS: Readonly<Record<SyncState, StatusDescriptor>> = {
  synced: {
    label: "Synced",
    symbol: "✓",
    tone: "success",
    ariaLabel: "Sync status: All field records synced",
  },
  pending_sync: {
    label: "Pending Sync",
    symbol: "↻",
    tone: "warning",
    ariaLabel: "Sync status: Changes queued to sync",
  },
  offline: {
    label: "Offline Mode",
    symbol: "⚡",
    tone: "neutral",
    ariaLabel: "Sync status: Device offline, saving locally",
  },
  sync_error: {
    label: "Sync Attention Needed",
    symbol: "!",
    tone: "danger",
    ariaLabel: "Sync status: Sync failed, action required",
  },
};

const APPROVAL_DESCRIPTORS: Readonly<Record<ApprovalState, StatusDescriptor>> = {
  draft: {
    label: "Draft",
    symbol: "✎",
    tone: "neutral",
    ariaLabel: "Approval status: Draft",
  },
  submitted: {
    label: "Pending Approval",
    symbol: "⏳",
    tone: "warning",
    ariaLabel: "Approval status: Pending manager approval",
  },
  approved: {
    label: "Approved",
    symbol: "✓",
    tone: "success",
    ariaLabel: "Approval status: Approved by manager",
  },
  rejected: {
    label: "Changes Requested",
    symbol: "✕",
    tone: "danger",
    ariaLabel: "Approval status: Rejected, changes requested",
  },
  in_progress: {
    label: "In Field",
    symbol: "▶",
    tone: "info",
    ariaLabel: "Trip status: Currently in progress",
  },
  completed: {
    label: "Completed",
    symbol: "✓",
    tone: "success",
    ariaLabel: "Trip status: Completed",
  },
};

const PROVENANCE_DESCRIPTORS: Readonly<Record<ProvenanceState, StatusDescriptor>> = {
  human_verified: {
    label: "Human Verified",
    symbol: "✓",
    tone: "success",
    ariaLabel: "Record provenance: Verified by human reviewer",
  },
  generated_draft: {
    label: "Generated Draft — Review Required",
    symbol: "✦",
    tone: "info",
    ariaLabel:
      "Record provenance: Automatically generated summary, requires human verification",
  },
};

export function getSyncStatusDescriptor(state: SyncState): StatusDescriptor {
  return SYNC_DESCRIPTORS[state];
}

export function getApprovalStatusDescriptor(state: ApprovalState): StatusDescriptor {
  return APPROVAL_DESCRIPTORS[state];
}

export function getProvenanceStatusDescriptor(state: ProvenanceState): StatusDescriptor {
  return PROVENANCE_DESCRIPTORS[state];
}

export function StatusBadge({
  descriptor,
  liveRegion = false,
}: {
  descriptor: StatusDescriptor;
  liveRegion?: boolean;
}): ReactNode {
  return (
    <span
      className={`status-badge status-badge--${descriptor.tone}`}
      aria-label={descriptor.ariaLabel}
      role={liveRegion ? "status" : undefined}
      aria-live={liveRegion ? "polite" : undefined}
    >
      <span aria-hidden="true">{descriptor.symbol}</span>
      <span>{descriptor.label}</span>
    </span>
  );
}
