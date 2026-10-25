/**
 * FieldTrack Phase 5 — Offline Synchronization Queue & Conflict Resolution Engine.
 *
 * Provides a reliable, tenant-scoped, persistent offline mutation queue for field operations.
 * Allows field representatives to record store visit checklists, capture evidence, and queue
 * actions when connectivity drops, with bounded retries, idempotency protection, and actionable
 * conflict resolution when server records change concurrently.
 */

import type { StorageLike } from "./visit-draft-storage";

export const OFFLINE_SUPPORTED_OPERATIONS = [
  "save_checklist",
  "record_evidence",
  "checkin_stop",
  "checkout_visit",
] as const;

export type OfflineSupportedOperationType =
  (typeof OFFLINE_SUPPORTED_OPERATIONS)[number];

export const NON_OFFLINE_OPERATIONS = [
  "trip_approval",
  "trip_rejection",
  "trip_changes_requested",
  "create_trip_draft",
  "invite_member",
] as const;

export type NonOfflineOperationType = (typeof NON_OFFLINE_OPERATIONS)[number];

export type QueuedOperationStatus =
  | "pending"
  | "in_flight"
  | "synced"
  | "failed"
  | "conflict";

export interface ConflictDetails {
  serverUpdatedAt: string;
  conflictReason: string;
  clientPayload: Record<string, unknown>;
  serverState?: Record<string, unknown>;
}

export interface QueuedOfflineOperation {
  operationId: string;
  orgId: string;
  userId: string;
  targetId: string; // visitId or tripStopId
  operationType: OfflineSupportedOperationType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  baseVersionTimestamp?: string | null;
  status: QueuedOperationStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string | null;
  syncedAt?: string | null;
  conflictDetails?: ConflictDetails | null;
  requiresReauth?: boolean;
  accessRevoked?: boolean;
  evidenceBlobId?: string | null;
}

export interface EnqueueOperationInput {
  orgId: string;
  userId: string;
  targetId: string;
  operationType: OfflineSupportedOperationType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  baseVersionTimestamp?: string | null;
  maxRetries?: number;
  evidenceBlobId?: string | null;
}

export interface ProcessSyncResult {
  totalProcessed: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  sessionExpired?: boolean;
  accessRevoked?: boolean;
  operations: QueuedOfflineOperation[];
}

export type SyncExecutorFn = (
  op: QueuedOfflineOperation
) => Promise<
  | { success: true; serverResponse?: Record<string, unknown> }
  | {
      success: false;
      isConflict?: boolean;
      isSessionExpired?: boolean;
      isAccessRevoked?: boolean;
      errorMessage: string;
      conflictDetails?: ConflictDetails;
    }
>;

const QUEUE_STORAGE_PREFIX = "ft_sync_queue_";
const DEFAULT_MAX_RETRIES = 5;

function buildQueueKey(orgId: string, userId: string): string {
  return `${QUEUE_STORAGE_PREFIX}${orgId}_${userId}`;
}

function resolveStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) {
    return customStorage;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return null;
}

/**
 * Validates whether an operation is allowed offline.
 * Manager approvals, rejections, and new trip creations strictly require live authorization.
 */
export function assertOperationSupportedOffline(
  operationType: string
): asserts operationType is OfflineSupportedOperationType {
  if ((NON_OFFLINE_OPERATIONS as readonly string[]).includes(operationType)) {
    throw new Error(
      `Operation '${operationType}' cannot be performed offline: workspace manager authorization and live database validation are required.`
    );
  }
  if (!(OFFLINE_SUPPORTED_OPERATIONS as readonly string[]).includes(operationType)) {
    throw new Error(`Unsupported offline operation type '${operationType}'.`);
  }
}

/**
 * Loads the raw list of queued operations for an organization and user.
 */
export function loadOfflineQueue(params: {
  orgId: string;
  userId: string;
  storage?: StorageLike;
}): QueuedOfflineOperation[] {
  const store = resolveStorage(params.storage);
  if (!store) return [];

  try {
    const key = buildQueueKey(params.orgId, params.userId);
    const raw = store.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter to ensure strict tenant and user boundary
    return (parsed as QueuedOfflineOperation[]).filter(
      (op) => op.orgId === params.orgId && op.userId === params.userId
    );
  } catch (err) {
    console.warn("[OfflineQueue] Failed to load offline queue:", err);
    return [];
  }
}

/**
 * Persists the entire queue for an organization and user.
 */
function saveOfflineQueue(params: {
  orgId: string;
  userId: string;
  queue: QueuedOfflineOperation[];
  storage?: StorageLike;
}): boolean {
  const store = resolveStorage(params.storage);
  if (!store) return false;

  try {
    const key = buildQueueKey(params.orgId, params.userId);
    store.setItem(key, JSON.stringify(params.queue));
    return true;
  } catch (err) {
    console.warn("[OfflineQueue] Failed to persist offline queue:", err);
    return false;
  }
}

/**
 * Enqueues an offline operation into the persistent queue.
 * Deduplicates pending operations targeting the same resource and operation type
 * or sharing the same idempotency key.
 */
export function enqueueOfflineOperation(params: {
  input: EnqueueOperationInput;
  storage?: StorageLike;
  now?: Date;
}): QueuedOfflineOperation {
  assertOperationSupportedOffline(params.input.operationType);

  const nowIso = (params.now ?? new Date()).toISOString();
  const queue = loadOfflineQueue({
    orgId: params.input.orgId,
    userId: params.input.userId,
    storage: params.storage,
  });

  const idempotencyKey = params.input.idempotencyKey ?? crypto.randomUUID();

  // Deduplication: check if an identical operation is already pending
  const existingPendingIndex = queue.findIndex(
    (op) =>
      op.status === "pending" &&
      (op.idempotencyKey === idempotencyKey ||
        (op.targetId === params.input.targetId &&
          op.operationType === params.input.operationType))
  );

  if (existingPendingIndex >= 0) {
    const existing = queue[existingPendingIndex];
    if (existing) {
      // Coalesce / update the pending operation payload with the latest edits
      const updatedOp: QueuedOfflineOperation = {
        ...existing,
        payload: { ...existing.payload, ...params.input.payload },
        createdAt: nowIso,
        baseVersionTimestamp:
          params.input.baseVersionTimestamp ?? existing.baseVersionTimestamp,
        retryCount: 0,
        lastError: null,
      };
      queue[existingPendingIndex] = updatedOp;
      saveOfflineQueue({
        orgId: params.input.orgId,
        userId: params.input.userId,
        queue,
        storage: params.storage,
      });
      return updatedOp;
    }
  }

  const newOp: QueuedOfflineOperation = {
    operationId: crypto.randomUUID(),
    orgId: params.input.orgId,
    userId: params.input.userId,
    targetId: params.input.targetId,
    operationType: params.input.operationType,
    payload: params.input.payload,
    idempotencyKey,
    createdAt: nowIso,
    baseVersionTimestamp: params.input.baseVersionTimestamp ?? null,
    status: "pending",
    retryCount: 0,
    maxRetries: params.input.maxRetries ?? DEFAULT_MAX_RETRIES,
    lastError: null,
    syncedAt: null,
    conflictDetails: null,
  };

  queue.push(newOp);
  saveOfflineQueue({
    orgId: params.input.orgId,
    userId: params.input.userId,
    queue,
    storage: params.storage,
  });

  return newOp;
}

/**
 * Updates an operation's state in the queue.
 */
export function updateQueuedOperation(params: {
  orgId: string;
  userId: string;
  operationId: string;
  updates: Partial<QueuedOfflineOperation>;
  storage?: StorageLike;
}): QueuedOfflineOperation | null {
  const queue = loadOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    storage: params.storage,
  });

  const index = queue.findIndex((op) => op.operationId === params.operationId);
  if (index < 0) return null;

  const current = queue[index];
  if (!current) return null;

  const updated: QueuedOfflineOperation = { ...current, ...params.updates };
  queue[index] = updated;

  saveOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    queue,
    storage: params.storage,
  });

  return updated;
}

/**
 * Retries a failed or conflict operation by setting its status back to "pending".
 */
export function retryQueuedOperation(params: {
  orgId: string;
  userId: string;
  operationId: string;
  storage?: StorageLike;
}): QueuedOfflineOperation | null {
  return updateQueuedOperation({
    orgId: params.orgId,
    userId: params.userId,
    operationId: params.operationId,
    updates: {
      status: "pending",
      retryCount: 0,
      lastError: null,
    },
    storage: params.storage,
  });
}

/**
 * Actionable conflict resolution:
 * - "keep_client": marks pending with updated base timestamp so client overwrites.
 * - "accept_server": discards the client change in favor of the current server state.
 * - "discard": cancels and removes the operation from the queue.
 */
export function resolveQueuedConflict(params: {
  orgId: string;
  userId: string;
  operationId: string;
  resolution: "keep_client" | "accept_server" | "discard";
  storage?: StorageLike;
}): QueuedOfflineOperation | null {
  const queue = loadOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    storage: params.storage,
  });

  const index = queue.findIndex((op) => op.operationId === params.operationId);
  if (index < 0) return null;

  const current = queue[index];
  if (!current) return null;

  if (params.resolution === "discard" || params.resolution === "accept_server") {
    queue.splice(index, 1);
    saveOfflineQueue({
      orgId: params.orgId,
      userId: params.userId,
      queue,
      storage: params.storage,
    });
    return null;
  }

  // "keep_client": clear conflict state and force retry with fresh baseVersion
  const updated: QueuedOfflineOperation = {
    ...current,
    status: "pending",
    retryCount: 0,
    lastError: null,
    baseVersionTimestamp: current.conflictDetails?.serverUpdatedAt ?? null,
    conflictDetails: null,
  };

  queue[index] = updated;
  saveOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    queue,
    storage: params.storage,
  });

  return updated;
}

/**
 * Removes completed ("synced") operations to keep local storage clean and performant.
 */
export function purgeCompletedOperations(params: {
  orgId: string;
  userId: string;
  storage?: StorageLike;
}): number {
  const queue = loadOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    storage: params.storage,
  });

  const remaining = queue.filter((op) => op.status !== "synced");
  const purgedCount = queue.length - remaining.length;

  saveOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    queue: remaining,
    storage: params.storage,
  });

  return purgedCount;
}

/**
 * Processes all pending operations in the queue sequentially.
 * Enforces retry bounds and handles version conflicts gracefully.
 */
export async function processOfflineSyncQueue(params: {
  orgId: string;
  userId: string;
  executor: SyncExecutorFn;
  storage?: StorageLike;
  now?: Date;
}): Promise<ProcessSyncResult> {
  const queue = loadOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    storage: params.storage,
  });

  const pendingOps = queue.filter(
    (op) => op.status === "pending" || (op.status === "failed" && op.retryCount < op.maxRetries)
  );

  let syncedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;

  for (const op of pendingOps) {
    updateQueuedOperation({
      orgId: params.orgId,
      userId: params.userId,
      operationId: op.operationId,
      updates: { status: "in_flight" },
      storage: params.storage,
    });

    try {
      const result = await params.executor(op);

      if (result.success) {
        updateQueuedOperation({
          orgId: params.orgId,
          userId: params.userId,
          operationId: op.operationId,
          updates: {
            status: "synced",
            syncedAt: (params.now ?? new Date()).toISOString(),
            lastError: null,
            requiresReauth: false,
          },
          storage: params.storage,
        });
        syncedCount++;
      } else if (result.isSessionExpired) {
        // 401 Unauthenticated: halt queue processing immediately without consuming retries
        updateQueuedOperation({
          orgId: params.orgId,
          userId: params.userId,
          operationId: op.operationId,
          updates: {
            status: "pending",
            requiresReauth: true,
            lastError: result.errorMessage || "Session expired. Please log in again to sync.",
          },
          storage: params.storage,
        });
        const updatedQueue = loadOfflineQueue({
          orgId: params.orgId,
          userId: params.userId,
          storage: params.storage,
        });
        return {
          totalProcessed: syncedCount + failedCount + conflictCount,
          syncedCount,
          failedCount,
          conflictCount,
          sessionExpired: true,
          operations: updatedQueue,
        };
      } else if (result.isAccessRevoked) {
        // 403 Forbidden: workspace access revoked, halt queue processing and preserve data
        updateQueuedOperation({
          orgId: params.orgId,
          userId: params.userId,
          operationId: op.operationId,
          updates: {
            status: "failed",
            accessRevoked: true,
            lastError: result.errorMessage || "Workspace access revoked.",
          },
          storage: params.storage,
        });
        failedCount++;
        const updatedQueue = loadOfflineQueue({
          orgId: params.orgId,
          userId: params.userId,
          storage: params.storage,
        });
        return {
          totalProcessed: syncedCount + failedCount + conflictCount,
          syncedCount,
          failedCount,
          conflictCount,
          accessRevoked: true,
          operations: updatedQueue,
        };
      } else if (result.isConflict) {
        updateQueuedOperation({
          orgId: params.orgId,
          userId: params.userId,
          operationId: op.operationId,
          updates: {
            status: "conflict",
            lastError: result.errorMessage,
            conflictDetails: result.conflictDetails ?? {
              serverUpdatedAt: new Date().toISOString(),
              conflictReason: result.errorMessage,
              clientPayload: op.payload,
            },
          },
          storage: params.storage,
        });
        conflictCount++;
      } else {
        const nextRetry = op.retryCount + 1;
        const isPermanentlyFailed = nextRetry >= op.maxRetries;
        updateQueuedOperation({
          orgId: params.orgId,
          userId: params.userId,
          operationId: op.operationId,
          updates: {
            status: isPermanentlyFailed ? "failed" : "pending",
            retryCount: nextRetry,
            lastError: result.errorMessage,
          },
          storage: params.storage,
        });
        failedCount++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unexpected synchronization error";
      const nextRetry = op.retryCount + 1;
      updateQueuedOperation({
        orgId: params.orgId,
        userId: params.userId,
        operationId: op.operationId,
        updates: {
          status: nextRetry >= op.maxRetries ? "failed" : "pending",
          retryCount: nextRetry,
          lastError: errorMsg,
        },
        storage: params.storage,
      });
      failedCount++;
    }
  }

  const updatedQueue = loadOfflineQueue({
    orgId: params.orgId,
    userId: params.userId,
    storage: params.storage,
  });

  return {
    totalProcessed: pendingOps.length,
    syncedCount,
    failedCount,
    conflictCount,
    operations: updatedQueue,
  };
}
