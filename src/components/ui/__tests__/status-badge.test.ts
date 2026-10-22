import { describe, expect, it } from "vitest";
import { PRIMARY_NAV_ITEMS } from "@/components/shell/NavLinks";
import {
  type ApprovalState,
  getApprovalStatusDescriptor,
  getProvenanceStatusDescriptor,
  getSyncStatusDescriptor,
  type SyncState,
} from "@/components/ui/StatusBadge";

describe("Accessible UI status descriptors & navigation structure", () => {
  it("provides non-color symbol, label, and screen-reader ariaLabel for all sync states", () => {
    const states: SyncState[] = ["synced", "pending_sync", "offline", "sync_error"];
    for (const state of states) {
      const descriptor = getSyncStatusDescriptor(state);
      expect(descriptor.label.length).toBeGreaterThan(2);
      expect(descriptor.symbol.length).toBeGreaterThan(0);
      expect(descriptor.ariaLabel).toContain("Sync status:");
    }
  });

  it("provides non-color symbol, label, and screen-reader ariaLabel for all approval states", () => {
    const states: ApprovalState[] = [
      "draft",
      "submitted",
      "approved",
      "rejected",
      "in_progress",
      "completed",
    ];
    for (const state of states) {
      const descriptor = getApprovalStatusDescriptor(state);
      expect(descriptor.label.length).toBeGreaterThan(2);
      expect(descriptor.symbol.length).toBeGreaterThan(0);
      expect(descriptor.ariaLabel.length).toBeGreaterThan(5);
    }
  });

  it("explicitly distinguishes human-verified vs generated-draft provenance states", () => {
    const verified = getProvenanceStatusDescriptor("human_verified");
    const generated = getProvenanceStatusDescriptor("generated_draft");

    expect(verified.label).toContain("Human Verified");
    expect(generated.label).toContain("Generated Draft");
    expect(generated.ariaLabel).toContain("requires human verification");
  });

  it("defines primary navigation routes for core field operations", () => {
    const hrefs = PRIMARY_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual(["/", "/trips", "/visits", "/approvals", "/team"]);
  });
});
