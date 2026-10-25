/**
 * FieldTrack Phase 6 — IndexedDB Storage Engine for Binary Evidence & Offline Records.
 *
 * Provides high-capacity, asynchronous client-side storage for photo evidence,
 * visit checklists, and mutation queues. Solves the 5 MB browser localStorage limitation
 * and provides graceful handling for storage quota exhaustion and device restarts.
 */

export interface OfflineEvidenceBlobRecord {
  evidenceId: string;
  orgId: string;
  visitId: string;
  mimeType: string;
  sizeBytes: number;
  dataUrlOrBase64: string;
  caption: string;
  createdAt: string;
}

export interface StorageQuotaEstimate {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isConstrained: boolean;
}

const DB_NAME = "fieldtrack_offline_db";
const DB_VERSION = 1;
const EVIDENCE_STORE = "evidence_blobs";

// In-memory fallback for environments where IndexedDB is unavailable (SSR, Node, headless unit tests)
const memoryBlobStore = new Map<string, OfflineEvidenceBlobRecord>();

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== "undefined" && typeof window.indexedDB !== "undefined") {
    return window.indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is not available in current environment."));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(EVIDENCE_STORE)) {
        const store = db.createObjectStore(EVIDENCE_STORE, { keyPath: "evidenceId" });
        store.createIndex("by_org_visit", ["orgId", "visitId"], { unique: false });
        store.createIndex("by_org", "orgId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Checks available browser storage quota to detect low-disk-space warnings before saving large photos.
 */
export async function checkStorageQuota(): Promise<StorageQuotaEstimate> {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.storage !== "undefined" &&
    typeof navigator.storage.estimate === "function"
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 100_000_000;
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      const isConstrained = quota > 0 && quota - usage < 10_000_000; // < 10MB remaining

      return {
        usageBytes: usage,
        quotaBytes: quota,
        percentUsed,
        isConstrained,
      };
    } catch {
      // Storage estimation failure is non-fatal
    }
  }

  return {
    usageBytes: memoryBlobStore.size * 200_000,
    quotaBytes: 100_000_000,
    percentUsed: 5,
    isConstrained: false,
  };
}

/**
 * Persists binary photo evidence safely in IndexedDB, checking for quota constraints first.
 */
export async function storeOfflineEvidenceBlob(
  record: OfflineEvidenceBlobRecord
): Promise<void> {
  // Validate maximum evidence size: 25 MiB
  if (record.sizeBytes > 26_214_400) {
    throw new Error(
      `File size (${(record.sizeBytes / 1_048_576).toFixed(1)} MiB) exceeds maximum evidence limit of 25 MiB.`
    );
  }

  // Check quota constraint
  const quota = await checkStorageQuota();
  if (quota.isConstrained) {
    throw new Error(
      "Device storage is almost full (< 10 MB remaining). Please free up disk space to capture more photos."
    );
  }

  const idb = getIndexedDB();
  if (!idb) {
    memoryBlobStore.set(record.evidenceId, record);
    return;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, "readwrite");
      const store = tx.objectStore(EVIDENCE_STORE);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    // If IndexedDB transaction errors out (e.g., QuotaExceededError), fallback to memory store
    memoryBlobStore.set(record.evidenceId, record);
    if (err instanceof Error && /quota/i.test(err.message)) {
      throw new Error("Device storage quota exceeded while saving photo evidence offline.");
    }
  }
}

/**
 * Retrieves a stored binary evidence blob by evidenceId.
 */
export async function getOfflineEvidenceBlob(
  evidenceId: string
): Promise<OfflineEvidenceBlobRecord | null> {
  const idb = getIndexedDB();
  if (!idb) {
    return memoryBlobStore.get(evidenceId) ?? null;
  }

  try {
    const db = await openDatabase();
    return await new Promise<OfflineEvidenceBlobRecord | null>((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, "readonly");
      const store = tx.objectStore(EVIDENCE_STORE);
      const req = store.get(evidenceId);

      req.onsuccess = () => resolve((req.result as OfflineEvidenceBlobRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryBlobStore.get(evidenceId) ?? null;
  }
}

/**
 * Lists all queued offline evidence files for a specific visit and organization.
 */
export async function listOfflineEvidenceForVisit(
  orgId: string,
  visitId: string
): Promise<OfflineEvidenceBlobRecord[]> {
  const idb = getIndexedDB();
  if (!idb) {
    return Array.from(memoryBlobStore.values()).filter(
      (r) => r.orgId === orgId && r.visitId === visitId
    );
  }

  try {
    const db = await openDatabase();
    return await new Promise<OfflineEvidenceBlobRecord[]>((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, "readonly");
      const store = tx.objectStore(EVIDENCE_STORE);
      const index = store.index("by_org_visit");
      const req = index.getAll(IDBKeyRange.only([orgId, visitId]));

      req.onsuccess = () => resolve((req.result as OfflineEvidenceBlobRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memoryBlobStore.values()).filter(
      (r) => r.orgId === orgId && r.visitId === visitId
    );
  }
}

/**
 * Deletes an offline evidence file once it has been successfully synced with Supabase storage.
 */
export async function deleteOfflineEvidenceBlob(evidenceId: string): Promise<void> {
  memoryBlobStore.delete(evidenceId);

  const idb = getIndexedDB();
  if (!idb) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, "readwrite");
      const store = tx.objectStore(EVIDENCE_STORE);
      const req = store.delete(evidenceId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Clears all cached evidence blobs for an organization upon sign-out or workspace switch.
 */
export async function clearAllOfflineEvidenceForOrg(orgId: string): Promise<void> {
  for (const [id, record] of memoryBlobStore.entries()) {
    if (record.orgId === orgId) {
      memoryBlobStore.delete(id);
    }
  }

  const idb = getIndexedDB();
  if (!idb) return;

  try {
    const db = await openDatabase();
    const records = await new Promise<OfflineEvidenceBlobRecord[]>((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, "readonly");
      const store = tx.objectStore(EVIDENCE_STORE);
      const index = store.index("by_org");
      const req = index.getAll(IDBKeyRange.only(orgId));
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });

    if (records.length > 0) {
      const deleteTx = db.transaction(EVIDENCE_STORE, "readwrite");
      const store = deleteTx.objectStore(EVIDENCE_STORE);
      for (const rec of records) {
        store.delete(rec.evidenceId);
      }
    }
  } catch {
    // Non-fatal
  }
}
