/**
 * FieldTrack Phase 5 — Cached Trips & Visits Storage for Offline Viewing.
 *
 * Caches assigned trips, store details, and visit checklists locally so that
 * field representatives can view their schedule, store addresses, and required
 * audit instructions when network connectivity is completely unavailable.
 *
 * Rules:
 * - Scoped strictly by `orgId` (tenant isolation: switching orgs purges cache).
 * - Automatic 7-day expiration for stale records.
 * - Fails safely in SSR or storage-restricted environments.
 */

import type { StorageLike } from "./visit-draft-storage";

export interface CachedStoreInfo {
  id: string;
  name: string;
  region: string;
  city: string;
  addressLine1: string;
  latitude: number | null;
  longitude: number | null;
}

export interface CachedTripStop {
  id: string;
  tripId: string;
  storeId: string;
  sequenceNumber: number;
  plannedAt: string | null;
  status: "planned" | "visited" | "skipped";
  store: CachedStoreInfo;
}

export interface CachedTrip {
  id: string;
  orgId: string;
  title: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: string;
  stops: CachedTripStop[];
  cachedAt: string;
}

export interface CachedChecklistTemplateItem {
  id: string;
  questionKey: string;
  label: string;
  answerType: "boolean" | "text" | "number" | "select";
  required: boolean;
  flagged: boolean;
  completed: boolean;
  answerText: string | null;
  answerValue: unknown;
}

export interface CachedVisit {
  visitId: string;
  tripStopId: string;
  orgId: string;
  status: string;
  notes: string;
  store: CachedStoreInfo;
  checklistItems: CachedChecklistTemplateItem[];
  cachedAt: string;
}

const TRIP_CACHE_PREFIX = "ft_cached_trip_";
const VISIT_CACHE_PREFIX = "ft_cached_visit_";
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function resolveStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return null;
}

export function saveCachedTrip(
  trip: CachedTrip,
  customStorage?: StorageLike
): boolean {
  const store = resolveStorage(customStorage);
  if (!store) return false;

  try {
    const key = `${TRIP_CACHE_PREFIX}${trip.orgId}_${trip.id}`;
    store.setItem(
      key,
      JSON.stringify({
        ...trip,
        cachedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch (err) {
    console.warn("[CachedStorage] Failed to cache trip:", err);
    return false;
  }
}

export function loadCachedTrip(params: {
  orgId: string;
  tripId: string;
  now?: Date;
  storage?: StorageLike;
}): CachedTrip | null {
  const store = resolveStorage(params.storage);
  if (!store) return null;

  try {
    const key = `${TRIP_CACHE_PREFIX}${params.orgId}_${params.tripId}`;
    const raw = store.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedTrip;
    if (parsed.orgId !== params.orgId || parsed.id !== params.tripId) {
      return null;
    }

    const age = (params.now ?? new Date()).getTime() - new Date(parsed.cachedAt).getTime();
    if (isNaN(age) || age > MAX_CACHE_AGE_MS) {
      store.removeItem(key);
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[CachedStorage] Failed to load cached trip:", err);
    return null;
  }
}

export function saveCachedVisit(
  visit: CachedVisit,
  customStorage?: StorageLike
): boolean {
  const store = resolveStorage(customStorage);
  if (!store) return false;

  try {
    const key = `${VISIT_CACHE_PREFIX}${visit.orgId}_${visit.visitId}`;
    store.setItem(
      key,
      JSON.stringify({
        ...visit,
        cachedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch (err) {
    console.warn("[CachedStorage] Failed to cache visit:", err);
    return false;
  }
}

export function loadCachedVisit(params: {
  orgId: string;
  visitId: string;
  now?: Date;
  storage?: StorageLike;
}): CachedVisit | null {
  const store = resolveStorage(params.storage);
  if (!store) return null;

  try {
    const key = `${VISIT_CACHE_PREFIX}${params.orgId}_${params.visitId}`;
    const raw = store.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedVisit;
    if (parsed.orgId !== params.orgId || parsed.visitId !== params.visitId) {
      return null;
    }

    const age = (params.now ?? new Date()).getTime() - new Date(parsed.cachedAt).getTime();
    if (isNaN(age) || age > MAX_CACHE_AGE_MS) {
      store.removeItem(key);
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[CachedStorage] Failed to load cached visit:", err);
    return null;
  }
}

export function clearCachedDataForOrg(
  orgId: string,
  customStorage?: StorageLike
): void {
  const store = resolveStorage(customStorage);
  if (!store) return;

  try {
    const tripPrefix = `${TRIP_CACHE_PREFIX}${orgId}_`;
    const visitPrefix = `${VISIT_CACHE_PREFIX}${orgId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && (key.startsWith(tripPrefix) || key.startsWith(visitPrefix))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      store.removeItem(key);
    }
  } catch (err) {
    console.warn("[CachedStorage] Failed to wipe cached data for org:", err);
  }
}
