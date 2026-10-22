import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllLocalDraftsForOrg,
  clearLocalVisitDraft,
  loadLocalVisitDraft,
  saveLocalVisitDraft,
  type LocalVisitDraft,
  type StorageLike,
} from "../visit-draft-storage";

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

describe("Local Offline Visit Draft Storage", () => {
  const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const STOP_1 = "60000000-0000-4000-8000-000000000001";
  const STOP_2 = "60000000-0000-4000-8000-000000000002";

  let memoryStorage: StorageLike;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
  });

  it("saves and loads an in-progress visit draft locally", () => {
    const draft: LocalVisitDraft = {
      orgId: ORG_A,
      tripStopId: STOP_1,
      visitId: "70000000-0000-4000-8000-000000000001",
      visitStatus: "in_progress",
      checkedInAt: "2026-10-22T10:00:00.000Z",
      notes: "Checked endcap display; stock is low on SKU 44.",
      checklist: [
        {
          questionKey: "shelf_planogram_compliant",
          completed: true,
          flagged: false,
          answerText: "",
        },
      ],
      updatedAt: "2026-10-22T10:05:00.000Z",
    };

    const saved = saveLocalVisitDraft(draft, memoryStorage);
    expect(saved).toBe(true);

    const loaded = loadLocalVisitDraft(ORG_A, STOP_1, new Date(), memoryStorage);
    expect(loaded).not.toBeNull();
    expect(loaded?.notes).toBe("Checked endcap display; stock is low on SKU 44.");
    expect(loaded?.checklist[0]?.completed).toBe(true);
    expect(loaded?.visitStatus).toBe("in_progress");
  });

  it("enforces tenant boundary isolation (Org B cannot load Org A's drafts)", () => {
    saveLocalVisitDraft(
      {
        orgId: ORG_A,
        tripStopId: STOP_1,
        visitId: "70000000-0000-4000-8000-000000000001",
        visitStatus: "in_progress",
        checkedInAt: "2026-10-22T10:00:00.000Z",
        notes: "Org A confidential store notes",
        checklist: [],
        updatedAt: "2026-10-22T10:05:00.000Z",
      },
      memoryStorage
    );

    // Org B requesting Org A's stop returns null
    const crossOrgLoad = loadLocalVisitDraft(ORG_B, STOP_1, new Date(), memoryStorage);
    expect(crossOrgLoad).toBeNull();
  });

  it("clears a specific local draft upon checkout", () => {
    saveLocalVisitDraft(
      {
        orgId: ORG_A,
        tripStopId: STOP_1,
        visitId: "70000000-0000-4000-8000-000000000001",
        visitStatus: "in_progress",
        checkedInAt: "2026-10-22T10:00:00.000Z",
        notes: "Pending checkout",
        checklist: [],
        updatedAt: "2026-10-22T10:05:00.000Z",
      },
      memoryStorage
    );

    clearLocalVisitDraft(ORG_A, STOP_1, memoryStorage);
    expect(loadLocalVisitDraft(ORG_A, STOP_1, new Date(), memoryStorage)).toBeNull();
  });

  it("purges stale drafts older than 7 days automatically", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    // Save with an old timestamp
    const key = `ft_visit_draft_${ORG_A}_${STOP_1}`;
    memoryStorage.setItem(
      key,
      JSON.stringify({
        orgId: ORG_A,
        tripStopId: STOP_1,
        visitId: "70000000-0000-4000-8000-000000000001",
        visitStatus: "in_progress",
        checkedInAt: eightDaysAgo.toISOString(),
        notes: "Old stale draft",
        checklist: [],
        updatedAt: eightDaysAgo.toISOString(),
      })
    );

    const loaded = loadLocalVisitDraft(ORG_A, STOP_1, new Date(), memoryStorage);
    expect(loaded).toBeNull();
    // Verify it was purged from storage
    expect(memoryStorage.getItem(key)).toBeNull();
  });

  it("wipes all local drafts for a specific tenant on logout/org switch without touching other tenants", () => {
    saveLocalVisitDraft(
      {
        orgId: ORG_A,
        tripStopId: STOP_1,
        visitId: "70000000-0000-4000-8000-000000000001",
        visitStatus: "in_progress",
        checkedInAt: "2026-10-22T10:00:00.000Z",
        notes: "Org A draft 1",
        checklist: [],
        updatedAt: "2026-10-22T10:05:00.000Z",
      },
      memoryStorage
    );

    saveLocalVisitDraft(
      {
        orgId: ORG_A,
        tripStopId: STOP_2,
        visitId: "70000000-0000-4000-8000-000000000002",
        visitStatus: "in_progress",
        checkedInAt: "2026-10-22T10:00:00.000Z",
        notes: "Org A draft 2",
        checklist: [],
        updatedAt: "2026-10-22T10:05:00.000Z",
      },
      memoryStorage
    );

    saveLocalVisitDraft(
      {
        orgId: ORG_B,
        tripStopId: STOP_1,
        visitId: "70000000-0000-4000-8000-000000000003",
        visitStatus: "in_progress",
        checkedInAt: "2026-10-22T10:00:00.000Z",
        notes: "Org B draft",
        checklist: [],
        updatedAt: "2026-10-22T10:05:00.000Z",
      },
      memoryStorage
    );

    // Wipe Org A only
    clearAllLocalDraftsForOrg(ORG_A, memoryStorage);

    expect(loadLocalVisitDraft(ORG_A, STOP_1, new Date(), memoryStorage)).toBeNull();
    expect(loadLocalVisitDraft(ORG_A, STOP_2, new Date(), memoryStorage)).toBeNull();
    // Org B draft is preserved
    expect(loadLocalVisitDraft(ORG_B, STOP_1, new Date(), memoryStorage)).not.toBeNull();
  });
});
