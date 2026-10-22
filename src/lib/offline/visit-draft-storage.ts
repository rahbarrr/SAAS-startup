/**
 * Local Offline Storage for In-Progress Store Visit Execution.
 *
 * Persists in-progress visit state, checklist items, and field notes locally on the device
 * so that mobile browser tab discards, unexpected page reloads, or temporary cellular dropouts
 * never cause the field employee to lose unsaved store audit work.
 *
 * Rules:
 * - Scoped strictly by `orgId` (multi-tenant boundary: signing out or switching orgs wipes drafts).
 * - Automatic 7-day expiration for stale unsubmitted drafts.
 * - Fails safely in SSR or when local storage quota is constrained.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export interface LocalVisitChecklistItemDraft {
  questionKey: string;
  completed: boolean;
  flagged: boolean;
  answerText: string;
}

export interface LocalVisitDraft {
  orgId: string;
  tripStopId: string;
  visitId: string;
  visitStatus: "not_started" | "in_progress" | "submitted" | "reviewed";
  checkedInAt: string | null;
  notes: string;
  checklist: LocalVisitChecklistItemDraft[];
  updatedAt: string;
}

const STORAGE_PREFIX = "ft_visit_draft_";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function buildStorageKey(orgId: string, tripStopId: string): string {
  return `${STORAGE_PREFIX}${orgId}_${tripStopId}`;
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
 * Saves or updates an in-progress visit draft locally on the device.
 */
export function saveLocalVisitDraft(
  draft: LocalVisitDraft,
  customStorage?: StorageLike
): boolean {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return false;
  }

  try {
    const key = buildStorageKey(draft.orgId, draft.tripStopId);
    const serialized = JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    storage.setItem(key, serialized);
    return true;
  } catch (err) {
    // QuotaExceededError or private browsing restrictions
    console.warn("[OfflineStorage] Failed to save local visit draft:", err);
    return false;
  }
}

/**
 * Loads an existing visit draft for the specified organization and stop, if present and non-expired.
 */
export function loadLocalVisitDraft(
  orgId: string,
  tripStopId: string,
  now = new Date(),
  customStorage?: StorageLike
): LocalVisitDraft | null {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return null;
  }

  try {
    const key = buildStorageKey(orgId, tripStopId);
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("orgId" in parsed) ||
      !("tripStopId" in parsed) ||
      !("updatedAt" in parsed)
    ) {
      return null;
    }

    const draft = parsed as LocalVisitDraft;

    // Tenant check: ensure loaded draft matches the active organization
    if (draft.orgId !== orgId || draft.tripStopId !== tripStopId) {
      return null;
    }

    // Expiry check: purge drafts older than 7 days
    const draftAge = now.getTime() - new Date(draft.updatedAt).getTime();
    if (isNaN(draftAge) || draftAge > MAX_DRAFT_AGE_MS) {
      clearLocalVisitDraft(orgId, tripStopId, storage);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn("[OfflineStorage] Failed to load local visit draft:", err);
    return null;
  }
}

/**
 * Clears the local draft for a completed visit or explicitly discarded stop.
 */
export function clearLocalVisitDraft(
  orgId: string,
  tripStopId: string,
  customStorage?: StorageLike
): void {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return;
  }

  try {
    const key = buildStorageKey(orgId, tripStopId);
    storage.removeItem(key);
  } catch (err) {
    console.warn("[OfflineStorage] Failed to clear local visit draft:", err);
  }
}

/**
 * Wipes all cached visit drafts for the specified organization.
 * Used during sign-out or organization switching to prevent cross-tenant data leakage.
 */
export function clearAllLocalDraftsForOrg(
  orgId: string,
  customStorage?: StorageLike
): void {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return;
  }

  try {
    const targetPrefix = `${STORAGE_PREFIX}${orgId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(targetPrefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch (err) {
    console.warn("[OfflineStorage] Failed to wipe organization drafts:", err);
  }
}
