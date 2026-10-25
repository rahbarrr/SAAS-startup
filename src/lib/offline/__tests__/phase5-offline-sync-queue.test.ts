import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCachedDataForOrg,
  loadCachedTrip,
  saveCachedTrip,
} from "../cached-trips-storage";
import {
  assertOperationSupportedOffline,
  enqueueOfflineOperation,
  loadOfflineQueue,
  processOfflineSyncQueue,
  purgeCompletedOperations,
  resolveQueuedConflict,
  retryQueuedOperation,
} from "../sync-queue";
import type { StorageLike } from "../visit-draft-storage";

class MockMemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  clear(): void {
    this.map.clear();
  }
}

describe("Phase 5: Offline Sync Queue & Conflict Resolution", () => {
  let storage: MockMemoryStorage;
  const orgId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    storage = new MockMemoryStorage();
  });

  it("enqueues operations and deduplicates pending mutations for same target and operation type", () => {
    const visitId = "00000000-0000-4000-8000-000000000003";

    const op1 = enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: visitId,
        operationType: "save_checklist",
        payload: { notes: "Draft notes v1" },
      },
      storage,
    });

    expect(op1.status).toBe("pending");
    expect(op1.retryCount).toBe(0);

    // Enqueue second edit for same visit checklist
    enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: visitId,
        operationType: "save_checklist",
        payload: { notes: "Draft notes v2 (updated)" },
      },
      storage,
    });

    const queue = loadOfflineQueue({ orgId, userId, storage });
    expect(queue.length).toBe(1);
    expect(queue[0]?.operationId).toBe(op1.operationId);
    expect(queue[0]?.payload.notes).toBe("Draft notes v2 (updated)");
  });

  it("strictly rejects non-offline operations such as manager approvals or trip creation", () => {
    expect(() =>
      assertOperationSupportedOffline("trip_approval")
    ).toThrow(/cannot be performed offline/i);

    expect(() =>
      assertOperationSupportedOffline("create_trip_draft")
    ).toThrow(/cannot be performed offline/i);

    expect(() =>
      assertOperationSupportedOffline("save_checklist")
    ).not.toThrow();
  });

  it("processes queue sequentially, bounded retries on failure, and marks permanently failed after maxRetries", async () => {
    const visitId = "00000000-0000-4000-8000-000000000004";

    enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: visitId,
        operationType: "checkout_visit",
        payload: { notes: "Check-out notes" },
        maxRetries: 2,
      },
      storage,
    });

    // 1st attempt: fails
    const res1 = await processOfflineSyncQueue({
      orgId,
      userId,
      storage,
      executor: async () => ({
        success: false,
        isConflict: false,
        errorMessage: "Network timeout",
      }),
    });

    expect(res1.failedCount).toBe(1);
    expect(res1.operations[0]?.status).toBe("pending"); // Retryable because retryCount (1) < maxRetries (2)
    expect(res1.operations[0]?.retryCount).toBe(1);

    // 2nd attempt: fails again reaching maxRetries
    const res2 = await processOfflineSyncQueue({
      orgId,
      userId,
      storage,
      executor: async () => ({
        success: false,
        isConflict: false,
        errorMessage: "Connection dropped",
      }),
    });

    expect(res2.operations[0]?.status).toBe("failed");
    expect(res2.operations[0]?.retryCount).toBe(2);

    // Manual retry resets status to pending
    const failedOpId = res2.operations[0]?.operationId;
    const retried = retryQueuedOperation({
      orgId,
      userId,
      operationId: failedOpId ?? "",
      storage,
    });

    expect(retried?.status).toBe("pending");
    expect(retried?.retryCount).toBe(0);
  });

  it("detects version conflicts and provides actionable conflict resolution without silent overwrite", async () => {
    const visitId = "00000000-0000-4000-8000-000000000005";

    const op = enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: visitId,
        operationType: "save_checklist",
        payload: { notes: "Client offline notes" },
        baseVersionTimestamp: "2026-10-25T10:00:00Z",
      },
      storage,
    });

    // Process sync with conflict returned
    const syncRes = await processOfflineSyncQueue({
      orgId,
      userId,
      storage,
      executor: async () => ({
        success: false,
        isConflict: true,
        errorMessage: "Record modified concurrently by another session",
        conflictDetails: {
          serverUpdatedAt: "2026-10-25T11:00:00Z",
          conflictReason: "Record modified concurrently",
          clientPayload: { notes: "Client offline notes" },
        },
      }),
    });

    expect(syncRes.conflictCount).toBe(1);
    expect(syncRes.operations[0]?.status).toBe("conflict");
    expect(syncRes.operations[0]?.conflictDetails?.serverUpdatedAt).toBe("2026-10-25T11:00:00Z");

    // Actionable resolution: "keep_client" forces pending state with server base timestamp
    const resolved = resolveQueuedConflict({
      orgId,
      userId,
      operationId: op.operationId,
      resolution: "keep_client",
      storage,
    });

    expect(resolved?.status).toBe("pending");
    expect(resolved?.baseVersionTimestamp).toBe("2026-10-25T11:00:00Z");
    expect(resolved?.conflictDetails).toBeNull();

    // Now sync succeeds
    const successSync = await processOfflineSyncQueue({
      orgId,
      userId,
      storage,
      executor: async () => ({ success: true }),
    });

    expect(successSync.syncedCount).toBe(1);
    expect(successSync.operations[0]?.status).toBe("synced");

    // Purge completed operations
    const purged = purgeCompletedOperations({ orgId, userId, storage });
    expect(purged).toBe(1);
    expect(loadOfflineQueue({ orgId, userId, storage }).length).toBe(0);
  });

  it("persists and isolates cached trips and visits for offline viewing", () => {
    const otherOrgId = "00000000-0000-4000-8000-000000000099";

    saveCachedTrip(
      {
        id: "trip-01",
        orgId,
        title: "Western Territory Route",
        startDate: "2026-10-26",
        endDate: "2026-10-27",
        purpose: "Q4 Store Audits",
        status: "approved",
        stops: [
          {
            id: "stop-01",
            tripId: "trip-01",
            storeId: "store-01",
            sequenceNumber: 1,
            plannedAt: "2026-10-26T09:00:00Z",
            status: "planned",
            store: {
              id: "store-01",
              name: "Downtown Supercenter",
              region: "West",
              city: "Seattle",
              addressLine1: "100 Pine St",
              latitude: 47.6097,
              longitude: -122.3331,
            },
          },
        ],
        cachedAt: new Date().toISOString(),
      },
      storage
    );

    const loaded = loadCachedTrip({ orgId, tripId: "trip-01", storage });
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe("Western Territory Route");
    expect(loaded?.stops[0]?.store.name).toBe("Downtown Supercenter");

    // Tenant isolation: requesting with another org ID returns null
    const crossTenant = loadCachedTrip({ orgId: otherOrgId, tripId: "trip-01", storage });
    expect(crossTenant).toBeNull();

    // Organization cache purge
    clearCachedDataForOrg(orgId, storage);
    expect(loadCachedTrip({ orgId, tripId: "trip-01", storage })).toBeNull();
  });
});
