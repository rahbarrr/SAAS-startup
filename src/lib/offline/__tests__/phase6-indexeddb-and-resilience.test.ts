import { describe, expect, it } from "vitest";
import {
  checkStorageQuota,
  clearAllOfflineEvidenceForOrg,
  deleteOfflineEvidenceBlob,
  getOfflineEvidenceBlob,
  listOfflineEvidenceForVisit,
  storeOfflineEvidenceBlob,
} from "../indexeddb-storage";
import {
  enqueueOfflineOperation,
  loadOfflineQueue,
  processOfflineSyncQueue,
  type SyncExecutorFn,
} from "../sync-queue";
import type { StorageLike } from "../visit-draft-storage";

class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe("Phase 6: Offline Resilience, IndexedDB, and Boundary Enforcement", () => {
  it("persists, lists, retrieves, and deletes binary offline photo evidence in IndexedDB store", async () => {
    const orgId = "org-123";
    const visitId = "visit-456";
    const mockImageData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const record = {
      evidenceId: "ev-test-1",
      orgId,
      visitId,
      mimeType: "image/png",
      sizeBytes: mockImageData.byteLength,
      dataUrlOrBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      caption: "Endcap shelf compliance check",
      createdAt: new Date().toISOString(),
    };

    await storeOfflineEvidenceBlob(record);

    // Retrieve single record
    const retrieved = await getOfflineEvidenceBlob("ev-test-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.evidenceId).toBe("ev-test-1");
    expect(retrieved?.caption).toBe("Endcap shelf compliance check");
    expect(retrieved?.sizeBytes).toBe(mockImageData.byteLength);

    // List by visit
    const visitEvidence = await listOfflineEvidenceForVisit(orgId, visitId);
    expect(visitEvidence.length).toBe(1);
    expect(visitEvidence[0]?.evidenceId).toBe("ev-test-1");

    // Delete single evidence record
    await deleteOfflineEvidenceBlob("ev-test-1");

    const postDelete = await getOfflineEvidenceBlob("ev-test-1");
    expect(postDelete).toBeNull();
  });

  it("safely estimates storage quota and warns when quota is nearing exhaustion", async () => {
    const quotaInfo = await checkStorageQuota();
    expect(quotaInfo).toHaveProperty("quotaBytes");
    expect(quotaInfo).toHaveProperty("usageBytes");
    expect(quotaInfo).toHaveProperty("percentUsed");
    expect(quotaInfo).toHaveProperty("isConstrained");
  });

  it("clears all offline evidence for an organization on logout / account purge", async () => {
    const orgA = "org-alpha";
    const orgB = "org-beta";

    await storeOfflineEvidenceBlob({
      evidenceId: "ev-a",
      orgId: orgA,
      visitId: "visit-1",
      mimeType: "text/plain",
      sizeBytes: 100,
      dataUrlOrBase64: "data:text/plain;base64,YWJj",
      caption: "A",
      createdAt: new Date().toISOString(),
    });
    await storeOfflineEvidenceBlob({
      evidenceId: "ev-b",
      orgId: orgB,
      visitId: "visit-2",
      mimeType: "text/plain",
      sizeBytes: 100,
      dataUrlOrBase64: "data:text/plain;base64,YWJj",
      caption: "B",
      createdAt: new Date().toISOString(),
    });

    await clearAllOfflineEvidenceForOrg(orgA);

    const remainingA = await listOfflineEvidenceForVisit(orgA, "visit-1");
    expect(remainingA.length).toBe(0);

    const remainingB = await listOfflineEvidenceForVisit(orgB, "visit-2");
    expect(remainingB.length).toBe(1);
  });

  it("halts queue processing on session expiry (401) without consuming retries or losing data", async () => {
    const storage = new MemoryStorage();
    const orgId = "org-session";
    const userId = "user-rep";

    enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: "visit-1",
        operationType: "save_checklist",
        payload: { completedCount: 5 },
      },
      storage,
    });

    enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: "visit-1",
        operationType: "record_evidence",
        payload: { caption: "Checklist done photo" },
      },
      storage,
    });

    const executor: SyncExecutorFn = async (op) => {
      if (op.operationType === "save_checklist") {
        return {
          success: false,
          isSessionExpired: true,
          errorMessage: "Session expired (401 UNAUTHENTICATED)",
        };
      }
      return { success: true };
    };

    const result = await processOfflineSyncQueue({
      orgId,
      userId,
      executor,
      storage,
    });

    expect(result.sessionExpired).toBe(true);
    expect(result.syncedCount).toBe(0);

    const queue = loadOfflineQueue({ orgId, userId, storage });
    expect(queue.length).toBe(2);

    const firstOp = queue[0];
    expect(firstOp?.status).toBe("pending");
    expect(firstOp?.requiresReauth).toBe(true);
    expect(firstOp?.retryCount).toBe(0); // Retry count preserved!

    const secondOp = queue[1];
    expect(secondOp?.status).toBe("pending"); // Unattempted due to early halt
  });

  it("halts queue processing and preserves mutations when workspace access is revoked (403)", async () => {
    const storage = new MemoryStorage();
    const orgId = "org-revoked";
    const userId = "user-rep";

    enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: "visit-7",
        operationType: "save_checklist",
        payload: { notes: "Draft notes" },
      },
      storage,
    });

    const executor: SyncExecutorFn = async () => ({
      success: false,
      isAccessRevoked: true,
      errorMessage: "Workspace access revoked by administrator (403 FORBIDDEN)",
    });

    const result = await processOfflineSyncQueue({
      orgId,
      userId,
      executor,
      storage,
    });

    expect(result.accessRevoked).toBe(true);
    expect(result.failedCount).toBe(1);

    const queue = loadOfflineQueue({ orgId, userId, storage });
    expect(queue.length).toBe(1);
    expect(queue[0]?.accessRevoked).toBe(true);
    expect(queue[0]?.status).toBe("failed");
    expect(queue[0]?.payload).toEqual({ notes: "Draft notes" }); // Data preserved safely
  });

  it("strictly enforces tenant and user boundary isolation in the sync queue", () => {
    const storage = new MemoryStorage();

    enqueueOfflineOperation({
      input: {
        orgId: "org-A",
        userId: "user-1",
        targetId: "visit-A",
        operationType: "save_checklist",
        payload: { tenant: "A" },
      },
      storage,
    });

    enqueueOfflineOperation({
      input: {
        orgId: "org-B",
        userId: "user-2",
        targetId: "visit-B",
        operationType: "save_checklist",
        payload: { tenant: "B" },
      },
      storage,
    });

    const queueA = loadOfflineQueue({ orgId: "org-A", userId: "user-1", storage });
    expect(queueA.length).toBe(1);
    expect(queueA[0]?.orgId).toBe("org-A");
    expect(queueA[0]?.payload).toEqual({ tenant: "A" });

    const queueB = loadOfflineQueue({ orgId: "org-B", userId: "user-2", storage });
    expect(queueB.length).toBe(1);
    expect(queueB[0]?.orgId).toBe("org-B");
    expect(queueB[0]?.payload).toEqual({ tenant: "B" });
  });

  it("deduplicates and coalesces identical pending operations targeting the same visit", () => {
    const storage = new MemoryStorage();
    const orgId = "org-coalesce";
    const userId = "user-rep";

    const op1 = enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: "visit-10",
        operationType: "save_checklist",
        payload: { itemA: true },
      },
      storage,
    });

    const op2 = enqueueOfflineOperation({
      input: {
        orgId,
        userId,
        targetId: "visit-10",
        operationType: "save_checklist",
        payload: { itemB: true },
      },
      storage,
    });

    const queue = loadOfflineQueue({ orgId, userId, storage });
    expect(queue.length).toBe(1);
    expect(queue[0]?.operationId).toBe(op1.operationId);
    expect(op2.operationId).toBe(op1.operationId);
    expect(queue[0]?.payload).toEqual({ itemA: true, itemB: true });
  });
});
