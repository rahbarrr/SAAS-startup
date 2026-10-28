import * as SecureStore from "expo-secure-store";
import type { GeofenceEventSyncResponse, QueuedGeofenceEvent } from "../types";

const QUEUE_STORAGE_KEY = "fieldtrack_geofence_queue_v1";
const QUEUE_INDEX_KEY = "fieldtrack_geofence_index_v1";
const QUEUE_ITEM_PREFIX = "fieldtrack_geofence_item_";
const MAX_SECURE_STORE_SINGLE_VALUE_BYTES = 1800;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

function toSafeStorageKey(clientEventId: string): string {
  return `${QUEUE_ITEM_PREFIX}${clientEventId.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export function calculateBackoffDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempts - 1));
}

export class EventQueueManager {
  private static inMemoryQueue: QueuedGeofenceEvent[] = [];
  private static isLoaded = false;
  private static isSyncing = false;

  /**
   * Simulates an app restart by clearing the in-memory cache without deleting
   * persisted storage in SecureStore.
   */
  static resetMemoryCache(): void {
    this.inMemoryQueue = [];
    this.isLoaded = false;
    this.isSyncing = false;
  }

  /**
   * Loads the durable queue from expo-secure-store if not yet loaded in memory.
   * Recovers any events stranded in "syncing" status due to prior app termination.
   */
  static async getQueue(): Promise<QueuedGeofenceEvent[]> {
    if (this.isLoaded) {
      return this.inMemoryQueue;
    }

    const loadedEvents: QueuedGeofenceEvent[] = [];

    try {
      const rawIndex = await SecureStore.getItemAsync(QUEUE_INDEX_KEY);
      if (rawIndex) {
        const ids = JSON.parse(rawIndex) as string[];
        if (Array.isArray(ids)) {
          for (const id of ids) {
            const rawItem = await SecureStore.getItemAsync(toSafeStorageKey(id));
            if (rawItem) {
              const parsed = JSON.parse(rawItem) as QueuedGeofenceEvent;
              if (parsed.status === "syncing") {
                parsed.status = "queued";
              }
              loadedEvents.push(parsed);
            }
          }
        }
      } else {
        const legacyStored = await SecureStore.getItemAsync(QUEUE_STORAGE_KEY);
        if (legacyStored) {
          const parsedList = JSON.parse(legacyStored) as QueuedGeofenceEvent[];
          if (Array.isArray(parsedList)) {
            for (const item of parsedList) {
              if (item.status === "syncing") {
                item.status = "queued";
              }
              loadedEvents.push(item);
            }
          }
        }
      }
    } catch {
      // Fallback to in-memory queue if SecureStore read fails
    }

    this.inMemoryQueue = loadedEvents;
    this.isLoaded = true;
    return this.inMemoryQueue;
  }

  /**
   * Enqueues an arrival or departure geofence event with client-side idempotency.
   */
  static async enqueueEvent(params: {
    eventType: "geofence_entry" | "geofence_exit";
    tripId: string;
    tripStopId: string;
    storeId: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    geofenceRadiusMeters: number;
    dwellTimeSeconds?: number | null;
    clientEventId?: string;
    deviceRecordedAt?: string;
  }): Promise<QueuedGeofenceEvent> {
    const queue = await this.getQueue();

    const clientEventId =
      params.clientEventId ??
      `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const existing = queue.find((e) => e.clientEventId === clientEventId);
    if (existing) {
      return existing;
    }

    const event: QueuedGeofenceEvent = {
      clientEventId,
      eventType: params.eventType,
      tripId: params.tripId,
      tripStopId: params.tripStopId,
      storeId: params.storeId,
      deviceRecordedAt: params.deviceRecordedAt ?? new Date().toISOString(),
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters,
      geofenceRadiusMeters: params.geofenceRadiusMeters,
      dwellTimeSeconds: params.dwellTimeSeconds ?? null,
      attempts: 0,
      status: "queued",
      lastAttemptAt: null,
      nextRetryAt: null,
    };

    queue.push(event);
    await this.persist();
    return event;
  }

  /**
   * Syncs pending events to the backend in chronological order with exponential backoff.
   */
  static async syncPendingEvents(
    sendFn: (event: QueuedGeofenceEvent) => Promise<GeofenceEventSyncResponse>,
    options?: { now?: Date; ignoreBackoff?: boolean }
  ): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    const nowMs = (options?.now ?? new Date()).getTime();
    const ignoreBackoff = options?.ignoreBackoff ?? false;

    try {
      const queue = await this.getQueue();

      // Sort by deviceRecordedAt ascending to preserve strict chronological ordering
      queue.sort(
        (a, b) =>
          new Date(a.deviceRecordedAt).getTime() - new Date(b.deviceRecordedAt).getTime()
      );

      for (const event of queue) {
        if (event.status === "synced") continue;
        if (event.status === "failed" && event.attempts >= 5) continue;

        if (
          event.status === "failed" &&
          !ignoreBackoff &&
          event.nextRetryAt &&
          nowMs < new Date(event.nextRetryAt).getTime()
        ) {
          // Halt sequential processing while the head-of-line event is in its backoff window
          // so a later exit event never overtakes an earlier unsynced entry event.
          break;
        }

        event.status = "syncing";
        event.attempts += 1;
        const attemptIso = new Date(nowMs).toISOString();
        event.lastAttemptAt = attemptIso;

        try {
          const response = await sendFn(event);
          if (
            response.success ||
            response.status === "duplicate" ||
            response.status === "processed" ||
            response.status === "pending_review"
          ) {
            event.status = "synced";
            event.nextRetryAt = null;
            synced += 1;
          } else {
            event.status = "failed";
            event.lastError = response.message ?? "Server rejected event";
            event.nextRetryAt = new Date(
              nowMs + calculateBackoffDelayMs(event.attempts)
            ).toISOString();
            failed += 1;
          }
        } catch (error) {
          event.status = "failed";
          event.lastError = error instanceof Error ? error.message : "Network failure";
          event.nextRetryAt = new Date(
            nowMs + calculateBackoffDelayMs(event.attempts)
          ).toISOString();
          failed += 1;
          // Stop sequential sync on network error to preserve arrival -> departure ordering
          break;
        }
      }

      const syncedEvents = queue.filter((e) => e.status === "synced");
      for (const syncedEvt of syncedEvents) {
        try {
          await SecureStore.deleteItemAsync(toSafeStorageKey(syncedEvt.clientEventId));
        } catch {
          // Non-blocking cleanup
        }
      }

      this.inMemoryQueue = queue.filter((e) => e.status !== "synced");
      await this.persist();
    } finally {
      this.isSyncing = false;
    }

    return { synced, failed };
  }

  static async clearQueue(): Promise<void> {
    const existing = [...this.inMemoryQueue];
    this.inMemoryQueue = [];
    this.isLoaded = true;
    try {
      for (const evt of existing) {
        await SecureStore.deleteItemAsync(toSafeStorageKey(evt.clientEventId));
      }
      await SecureStore.deleteItemAsync(QUEUE_INDEX_KEY);
      await SecureStore.deleteItemAsync(QUEUE_STORAGE_KEY);
    } catch {
      // Non-blocking
    }
  }

  private static async persist(): Promise<void> {
    try {
      const ids: string[] = [];
      for (const evt of this.inMemoryQueue) {
        ids.push(evt.clientEventId);
        await SecureStore.setItemAsync(
          toSafeStorageKey(evt.clientEventId),
          JSON.stringify(evt)
        );
      }
      await SecureStore.setItemAsync(QUEUE_INDEX_KEY, JSON.stringify(ids));

      const fullPayload = JSON.stringify(this.inMemoryQueue);
      if (fullPayload.length <= MAX_SECURE_STORE_SINGLE_VALUE_BYTES) {
        await SecureStore.setItemAsync(QUEUE_STORAGE_KEY, fullPayload);
      }
    } catch {
      // Non-blocking
    }
  }
}
