"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorState } from "@/components/ui/States";
import {
  getApprovalStatusDescriptor,
  getSyncStatusDescriptor,
  StatusBadge,
  type SyncState,
} from "@/components/ui/StatusBadge";
import {
  clearLocalVisitDraft,
  loadLocalVisitDraft,
  saveLocalVisitDraft,
} from "@/lib/offline/visit-draft-storage";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  type AllowedEvidenceMimeType,
  buildUnverifiedDeviceLocation,
  generateSafeEvidenceObjectPath,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  type UnverifiedDeviceLocation,
  type VisitLocationStatus,
  type VisitStatus,
} from "@/modules/visits/domain";

interface StopVisitChecklistState {
  questionKey: string;
  label: string;
  required: boolean;
  completed: boolean;
  flagged: boolean;
  answerText: string;
}

interface StopEvidenceItem {
  id: string;
  storagePath: string;
  fileType: AllowedEvidenceMimeType;
  fileSize: number;
  caption: string;
  idempotencyKey: string;
  createdAt: string;
  signedDownloadUrl: string;
}

interface PlannedStopExecutionItem {
  tripStopId: string;
  tripId: string;
  tripTitle: string;
  tripStatus: "approved" | "draft";
  sequenceNumber: number;
  storeName: string;
  storeAddress: string;
  visitId: string;
  visitStatus: "not_started" | VisitStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkInIdempotencyKey: string | null;
  checkOutIdempotencyKey: string | null;
  checkInLocation: UnverifiedDeviceLocation | null;
  checkOutLocation: UnverifiedDeviceLocation | null;
  notes: string;
  checklist: StopVisitChecklistState[];
  evidence: StopEvidenceItem[];
}

const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const INITIAL_STOPS: PlannedStopExecutionItem[] = [
  {
    tripStopId: "60000000-0000-4000-8000-000000000003",
    tripId: "50000000-0000-4000-8000-000000000004",
    tripTitle: "Approved North-East Store Execution",
    tripStatus: "approved",
    sequenceNumber: 1,
    storeName: "Lakeside Supercenter #204",
    storeAddress: "850 Lake Shore Dr, Chicago, IL",
    visitId: "70000000-0000-4000-8000-000000000001",
    visitStatus: "not_started",
    checkedInAt: null,
    checkedOutAt: null,
    checkInIdempotencyKey: null,
    checkOutIdempotencyKey: null,
    checkInLocation: null,
    checkOutLocation: null,
    notes: "",
    checklist: [
      {
        questionKey: "shelf_planogram_compliant",
        label: "Primary shelf display matches current Q4 planogram",
        required: true,
        completed: false,
        flagged: false,
        answerText: "",
      },
      {
        questionKey: "promo_signage_visible",
        label: "Promotional price tags and endcap signage are clearly visible",
        required: true,
        completed: false,
        flagged: false,
        answerText: "",
      },
      {
        questionKey: "out_of_stock_count",
        label: "Optional: Note any out-of-stock beverage SKUs",
        required: false,
        completed: false,
        flagged: false,
        answerText: "",
      },
    ],
    evidence: [],
  },
  {
    tripStopId: "60000000-0000-4000-8000-000000000004",
    tripId: "50000000-0000-4000-8000-000000000004",
    tripTitle: "Approved North-East Store Execution",
    tripStatus: "approved",
    sequenceNumber: 2,
    storeName: "Downtown Fresh Mart #101",
    storeAddress: "120 Main St, Chicago, IL",
    visitId: "70000000-0000-4000-8000-000000000002",
    visitStatus: "not_started",
    checkedInAt: null,
    checkedOutAt: null,
    checkInIdempotencyKey: null,
    checkOutIdempotencyKey: null,
    checkInLocation: null,
    checkOutLocation: null,
    notes: "",
    checklist: [
      {
        questionKey: "shelf_planogram_compliant",
        label: "Primary shelf display matches current Q4 planogram",
        required: true,
        completed: false,
        flagged: false,
        answerText: "",
      },
      {
        questionKey: "promo_signage_visible",
        label: "Promotional price tags and endcap signage are clearly visible",
        required: true,
        completed: false,
        flagged: false,
        answerText: "",
      },
    ],
    evidence: [],
  },
];

const DISALLOWED_EXTENSION_REGEX =
  /\.(exe|bat|cmd|sh|bash|zsh|js|mjs|cjs|ts|tsx|jsx|html|htm|svg|php|py|rb|pl|jar|dll|so|dylib|msi|apk|dmg|wasm)$/i;

export default function VisitsPage(): ReactNode {
  const [stops, setStops] = useState<PlannedStopExecutionItem[]>(INITIAL_STOPS);
  const [selectedStopId, setSelectedStopId] = useState<string>(
    INITIAL_STOPS[0]?.tripStopId ?? ""
  );
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [locationMode, setLocationMode] =
    useState<VisitLocationStatus>("captured_unverified");

  const [uploadCaption, setUploadCaption] = useState("");
  const [selectedFileMeta, setSelectedFileMeta] = useState<{
    name: string;
    type: string;
    size: number;
  } | null>({
    name: "cooler-endcap-photo.jpg",
    type: "image/jpeg",
    size: 420_000,
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [simulateStorageUploadFailure, setSimulateStorageUploadFailure] = useState(false);
  const [lastFailedUploadIdempotencyKey, setLastFailedUploadIdempotencyKey] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const selectedStop = useMemo(
    () => stops.find((s) => s.tripStopId === selectedStopId) ?? stops[0] ?? null,
    [stops, selectedStopId]
  );

  const activeInProgressStop = useMemo(
    () => stops.find((s) => s.visitStatus === "in_progress") ?? null,
    [stops]
  );

  // Restore local offline drafts if present on device (e.g. after tab discard or reload)
  useEffect(() => {
    let restoredCount = 0;
    setStops((prev) =>
      prev.map((item) => {
        const draft = loadLocalVisitDraft(ORG_ID, item.tripStopId);
        if (draft && draft.visitStatus === "in_progress") {
          restoredCount++;
          return {
            ...item,
            visitStatus: draft.visitStatus,
            checkedInAt: draft.checkedInAt ?? item.checkedInAt,
            notes: draft.notes,
            checklist: item.checklist.map((q) => {
              const matchingDraftItem = draft.checklist.find(
                (dq) => dq.questionKey === q.questionKey
              );
              if (matchingDraftItem) {
                return {
                  ...q,
                  completed: matchingDraftItem.completed,
                  flagged: matchingDraftItem.flagged,
                  answerText: matchingDraftItem.answerText,
                };
              }
              return q;
            }),
          };
        }
        return item;
      })
    );

    if (restoredCount > 0) {
      setStatusBanner(
        `Restored unsaved offline draft (${restoredCount} in-progress store audit) from device storage.`
      );
    }
  }, []);

  function persistStopDraft(updated: PlannedStopExecutionItem) {
    if (updated.visitStatus === "in_progress") {
      saveLocalVisitDraft({
        orgId: ORG_ID,
        tripStopId: updated.tripStopId,
        visitId: updated.visitId,
        visitStatus: updated.visitStatus,
        checkedInAt: updated.checkedInAt,
        notes: updated.notes,
        checklist: updated.checklist.map((c) => ({
          questionKey: c.questionKey,
          completed: c.completed,
          flagged: c.flagged,
          answerText: c.answerText,
        })),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function capturePointInTimeDeviceLocation(
    mode: VisitLocationStatus
  ): UnverifiedDeviceLocation {
    if (mode === "captured_unverified") {
      return buildUnverifiedDeviceLocation({
        lat: 41.8975,
        lng: -87.6196,
        accuracyMeters: 14.5,
        status: "captured_unverified",
      });
    }
    return buildUnverifiedDeviceLocation({
      lat: null,
      lng: null,
      accuracyMeters: null,
      status: mode,
    });
  }

  function handleCheckIn() {
    setErrorMessage(null);
    setStatusBanner(null);

    if (!selectedStop) return;

    if (selectedStop.tripStatus !== "approved") {
      setErrorMessage(
        "Check-in blocked: you can only check in to stops belonging to an approved trip."
      );
      return;
    }

    if (selectedStop.visitStatus !== "not_started") {
      setErrorMessage(
        "Duplicate check-in prevented: a visit has already been started for this stop."
      );
      return;
    }

    if (
      activeInProgressStop &&
      activeInProgressStop.tripStopId !== selectedStop.tripStopId
    ) {
      setErrorMessage(
        `Duplicate active visit prevented: you are currently checked in at "${activeInProgressStop.storeName}". Please check out of your active stop first.`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const idempotencyKey = `checkin-${selectedStop.tripStopId}-v1`;
    const capturedLoc = capturePointInTimeDeviceLocation(locationMode);

    setSyncState("synced");
    const updatedStop: PlannedStopExecutionItem = {
      ...selectedStop,
      visitStatus: "in_progress",
      checkedInAt: nowIso,
      checkInIdempotencyKey: idempotencyKey,
      checkInLocation: capturedLoc,
    };
    persistStopDraft(updatedStop);

    setStops((prev) =>
      prev.map((item) =>
        item.tripStopId === selectedStop.tripStopId ? updatedStop : item
      )
    );

    setStatusBanner(
      capturedLoc.status === "captured_unverified"
        ? `Checked in at ${selectedStop.storeName} (server timestamp ${nowIso}). Device coordinates captured as unverified telemetry.`
        : `Checked in at ${selectedStop.storeName} (server timestamp ${nowIso}) without coordinates (${capturedLoc.status}). ${capturedLoc.limitationExplanation}`
    );
  }

  function handleToggleChecklistItem(questionKey: string) {
    setErrorMessage(null);
    if (!selectedStop) return;

    if (selectedStop.visitStatus !== "in_progress") {
      setErrorMessage(
        "You must check in to this stop before completing checklist items."
      );
      return;
    }

    setStops((prev) =>
      prev.map((item) => {
        if (item.tripStopId !== selectedStop.tripStopId) return item;
        const updated = {
          ...item,
          checklist: item.checklist.map((q) =>
            q.questionKey === questionKey ? { ...q, completed: !q.completed } : q
          ),
        };
        persistStopDraft(updated);
        return updated;
      })
    );
  }

  function handleToggleChecklistFlag(questionKey: string) {
    setErrorMessage(null);
    if (!selectedStop || selectedStop.visitStatus !== "in_progress") return;

    setStops((prev) =>
      prev.map((item) => {
        if (item.tripStopId !== selectedStop.tripStopId) return item;
        const updated = {
          ...item,
          checklist: item.checklist.map((q) =>
            q.questionKey === questionKey ? { ...q, flagged: !q.flagged } : q
          ),
        };
        persistStopDraft(updated);
        return updated;
      })
    );
  }

  function handleNotesChange(nextNotes: string) {
    if (!selectedStop || selectedStop.visitStatus !== "in_progress") return;
    setStops((prev) =>
      prev.map((item) => {
        if (item.tripStopId !== selectedStop.tripStopId) return item;
        const updated = { ...item, notes: nextNotes };
        persistStopDraft(updated);
        return updated;
      })
    );
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileMeta({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  function handleEvidenceUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);

    if (!selectedStop) return;

    if (selectedStop.visitStatus !== "in_progress") {
      setErrorMessage(
        "Evidence can only be uploaded while a visit is checked in and in progress."
      );
      return;
    }

    if (!selectedFileMeta) {
      setErrorMessage("Please select an image or PDF evidence file to upload.");
      return;
    }

    if (DISALLOWED_EXTENSION_REGEX.test(selectedFileMeta.name)) {
      setErrorMessage(
        `Security block: "${selectedFileMeta.name}" has a forbidden executable, script, HTML, or SVG file extension.`
      );
      return;
    }

    if (
      !ALLOWED_EVIDENCE_MIME_TYPES.includes(
        selectedFileMeta.type as AllowedEvidenceMimeType
      )
    ) {
      setErrorMessage(
        `Unsupported MIME type "${selectedFileMeta.type}". Allowed types: JPEG, PNG, WebP, and PDF.`
      );
      return;
    }

    if (
      selectedFileMeta.size <= 0 ||
      selectedFileMeta.size > MAX_EVIDENCE_FILE_SIZE_BYTES
    ) {
      setErrorMessage("File size must be between 1 byte and 25 MiB (26,214,400 bytes).");
      return;
    }

    const idempotencyKey =
      lastFailedUploadIdempotencyKey ??
      `evidence-${selectedStop.visitId}-${selectedStop.evidence.length + 1}`;

    setSyncState("pending_sync");
    setUploadProgress(45);

    if (simulateStorageUploadFailure) {
      setUploadProgress(null);
      setSyncState("sync_error");
      setLastFailedUploadIdempotencyKey(idempotencyKey);
      setErrorMessage(
        `Upload failed before storage confirmation (idempotency key: ${idempotencyKey}). The file was NOT marked as uploaded. Uncheck "Simulate network failure" and tap "Retry Evidence Upload" to safely retry.`
      );
      return;
    }

    const mimeType = selectedFileMeta.type as AllowedEvidenceMimeType;
    const serverGeneratedPath = generateSafeEvidenceObjectPath({
      orgId: ORG_ID,
      visitId: selectedStop.visitId,
      mimeType,
    });
    const nowIso = new Date().toISOString();
    const newEvidenceId = `90000000-0000-4000-8000-00000000001${selectedStop.evidence.length + 1}`;

    setUploadProgress(100);
    setSyncState("synced");
    setLastFailedUploadIdempotencyKey(null);

    setStops((prev) =>
      prev.map((item) => {
        if (item.tripStopId !== selectedStop.tripStopId) return item;
        // Idempotency guard: if same idempotencyKey already confirmed, do not duplicate
        if (item.evidence.some((e) => e.idempotencyKey === idempotencyKey)) {
          return item;
        }
        return {
          ...item,
          evidence: [
            {
              id: newEvidenceId,
              storagePath: serverGeneratedPath,
              fileType: mimeType,
              fileSize: selectedFileMeta.size,
              caption: uploadCaption.trim() || "Store shelf verification photo",
              idempotencyKey,
              createdAt: nowIso,
              signedDownloadUrl: `/api/orgs/${ORG_ID}/visits/${selectedStop.visitId}/evidence?evidenceId=${newEvidenceId}`,
            },
            ...item.evidence,
          ],
        };
      })
    );

    setUploadCaption("");
    setStatusBanner(
      `Evidence uploaded privately and confirmed at server-generated path "${serverGeneratedPath}".`
    );
  }

  function handleCheckOut() {
    setErrorMessage(null);
    setStatusBanner(null);

    if (!selectedStop) return;

    if (selectedStop.visitStatus === "not_started" || !selectedStop.checkedInAt) {
      setErrorMessage(
        "Invalid transition: you cannot check out of a stop before checking in."
      );
      return;
    }

    if (selectedStop.visitStatus !== "in_progress") {
      setErrorMessage(
        `Visit is already '${selectedStop.visitStatus}' and cannot be checked out again.`
      );
      return;
    }

    const incompleteRequired = selectedStop.checklist.filter(
      (item) => item.required && !item.completed
    );
    if (incompleteRequired.length > 0) {
      setErrorMessage(
        `Complete all required checklist items before checking out (${incompleteRequired.length} remaining: ${incompleteRequired.map((i) => i.label).join("; ")}).`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const idempotencyKey = `checkout-${selectedStop.visitId}-v1`;
    const capturedLoc = capturePointInTimeDeviceLocation(locationMode);

    clearLocalVisitDraft(ORG_ID, selectedStop.tripStopId);
    setSyncState("synced");
    setStops((prev) =>
      prev.map((item) =>
        item.tripStopId === selectedStop.tripStopId
          ? {
              ...item,
              visitStatus: "submitted",
              checkedOutAt: nowIso,
              checkOutIdempotencyKey: idempotencyKey,
              checkOutLocation: capturedLoc,
            }
          : item
      )
    );

    setStatusBanner(
      `Checked out of ${selectedStop.storeName} at server timestamp ${nowIso}. Visit submitted for review.`
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-labelledby="visits-heading">
        <div className="card-header">
          <div>
            <h1 id="visits-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
              Mobile Store Visit Execution
            </h1>
            <p className="card-meta" style={{ margin: 0 }}>
              Execute planned stops on your approved trip: check in, complete required
              store audit items, upload private evidence, and check out.
            </p>
          </div>
          <StatusBadge descriptor={getSyncStatusDescriptor(syncState)} />
        </div>
      </section>

      <div
        role="note"
        aria-label="Sync and location privacy disclosure"
        className="card"
        style={{
          padding: "0.875rem 1rem",
          backgroundColor: "var(--bg-surface-muted, #f8fafc)",
          fontSize: "0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div>
          <strong>Sync &amp; Retry Disclosure:</strong> Actions sync directly to the
          server using idempotency keys so failed requests can be safely retried without
          creating duplicate visits or evidence rows. Durable offline background queuing
          is reserved for the later native mobile app phase.
        </div>
        <div>
          <strong>Point-in-Time Location Rationale (No Continuous Tracking):</strong> If
          granted, device coordinates and accuracy are requested only at the moment you
          tap Check In or Check Out and stored as{" "}
          <em>unverified device-reported telemetry</em> (not proof of identity or
          guaranteed location truth). If permission is denied or unavailable, you may
          still complete your visit under organization policy.
        </div>
      </div>

      {errorMessage ? (
        <ErrorState
          title="Visit action blocked or failed"
          message={errorMessage}
          onRetry={() => setErrorMessage(null)}
        />
      ) : null}

      {statusBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{ padding: "0.875rem 1.25rem", textAlign: "left" }}
        >
          <strong>{statusBanner}</strong>
        </div>
      ) : null}

      <section className="card" aria-labelledby="planned-stops-heading">
        <div className="card-header">
          <h2 id="planned-stops-heading" className="card-title">
            Approved Trip Stops ({stops.length})
          </h2>
          <StatusBadge descriptor={getApprovalStatusDescriptor("approved")} />
        </div>

        <div className="card-grid" style={{ marginTop: "0.5rem" }}>
          {stops.map((stop) => {
            const isSelected = selectedStop?.tripStopId === stop.tripStopId;
            return (
              <div
                key={stop.tripStopId}
                style={{
                  padding: "0.875rem",
                  borderRadius: "var(--radius-md)",
                  border: isSelected
                    ? "2px solid var(--brand-primary, #2563eb)"
                    : "1px solid var(--border-subtle, #cbd5e1)",
                }}
              >
                <div className="card-header">
                  <strong>
                    Stop #{stop.sequenceNumber}: {stop.storeName}
                  </strong>
                  <span className="card-meta" style={{ fontWeight: 600 }}>
                    {stop.visitStatus === "not_started"
                      ? "Planned"
                      : stop.visitStatus === "in_progress"
                        ? "In Progress"
                        : "Completed"}
                  </span>
                </div>
                <p className="card-meta" style={{ margin: "0.25rem 0 0.75rem" }}>
                  {stop.storeAddress}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedStopId(stop.tripStopId);
                    setErrorMessage(null);
                  }}
                >
                  {isSelected ? "Active Stop Selected" : "Open Stop Execution"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {selectedStop ? (
        <div className="card-grid">
          <section className="card" aria-labelledby="checkin-checkout-heading">
            <h2 id="checkin-checkout-heading" className="card-title">
              1. Check-In, Checklist &amp; Check-Out — {selectedStop.storeName}
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="device-location-mode"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Browser/Device Location Permission State at Capture
              </label>
              <select
                id="device-location-mode"
                value={locationMode}
                onChange={(e) => setLocationMode(e.target.value as VisitLocationStatus)}
                style={{
                  width: "100%",
                  minHeight: "var(--touch-target-min)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <option value="captured_unverified">
                  Permission Granted — Capture Unverified Device Coordinates (±14.5m)
                </option>
                <option value="permission_denied">
                  Permission Denied — Proceed Under Policy (Recorded as permission_denied)
                </option>
                <option value="unavailable">
                  Location Unavailable — Proceed Under Policy (Recorded as unavailable)
                </option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={selectedStop.visitStatus !== "not_started"}
                className="btn btn-primary"
              >
                {selectedStop.visitStatus === "not_started"
                  ? "Check In to Stop"
                  : "Checked In"}
              </button>

              <button
                type="button"
                onClick={handleCheckOut}
                disabled={selectedStop.visitStatus !== "in_progress"}
                className="btn btn-primary"
              >
                Check Out &amp; Submit Visit
              </button>
            </div>

            {selectedStop.checkedInAt ? (
              <p className="card-meta" style={{ margin: "0 0 0.5rem" }}>
                <strong>Server Check-In:</strong> {selectedStop.checkedInAt} • Location:{" "}
                {selectedStop.checkInLocation?.status} (
                {selectedStop.checkInLocation?.latitude !== null
                  ? `${selectedStop.checkInLocation?.latitude}, ${selectedStop.checkInLocation?.longitude} ±${selectedStop.checkInLocation?.accuracyMeters}m [unverified]`
                  : "no coordinates"}
                )
              </p>
            ) : null}

            {selectedStop.checkedOutAt ? (
              <p className="card-meta" style={{ margin: "0 0 0.75rem" }}>
                <strong>Server Check-Out:</strong> {selectedStop.checkedOutAt} • Location:{" "}
                {selectedStop.checkOutLocation?.status}
              </p>
            ) : null}

            <h3 style={{ fontSize: "1rem", margin: "0.75rem 0 0.5rem" }}>
              Store Audit Checklist
            </h3>
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 1rem",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
              }}
            >
              {selectedStop.checklist.map((item) => (
                <li
                  key={item.questionKey}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle, #cbd5e1)",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor:
                        selectedStop.visitStatus === "in_progress"
                          ? "pointer"
                          : "not-allowed",
                      minHeight: "var(--touch-target-min)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={selectedStop.visitStatus !== "in_progress"}
                      onChange={() => handleToggleChecklistItem(item.questionKey)}
                    />
                    <span>
                      {item.label}{" "}
                      {item.required ? (
                        <strong>(Required)</strong>
                      ) : (
                        <span className="card-meta">(Optional)</span>
                      )}
                    </span>
                  </label>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={selectedStop.visitStatus !== "in_progress"}
                    onClick={() => handleToggleChecklistFlag(item.questionKey)}
                  >
                    {item.flagged ? "Flagged Issue" : "Flag Issue"}
                  </button>
                </li>
              ))}
            </ul>

            <div>
              <label
                htmlFor="visit-notes"
                style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Visit Notes &amp; Observations
              </label>
              <textarea
                id="visit-notes"
                rows={3}
                disabled={selectedStop.visitStatus !== "in_progress"}
                value={selectedStop.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Record shelf observations, restock counts, or store manager feedback..."
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            </div>
          </section>

          <section className="card" aria-labelledby="evidence-upload-heading">
            <h2 id="evidence-upload-heading" className="card-title">
              2. Private Evidence Upload &amp; Signed URL Access
            </h2>
            <p className="card-meta">
              Files are validated for type (JPEG, PNG, WebP, PDF) and size (&le; 25 MiB)
              and stored privately at a server-generated randomized object path.
            </p>

            <form
              onSubmit={handleEvidenceUpload}
              style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
            >
              <div>
                <label
                  htmlFor="evidence-file-input"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Select Evidence File (JPEG, PNG, WebP, PDF — max 25 MiB)
                </label>
                <input
                  id="evidence-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={selectedStop.visitStatus !== "in_progress"}
                  onChange={handleFileInputChange}
                  style={{
                    width: "100%",
                    minHeight: "var(--touch-target-min)",
                  }}
                />
                {selectedFileMeta ? (
                  <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
                    Ready: {selectedFileMeta.name} ({selectedFileMeta.type},{" "}
                    {Math.round(selectedFileMeta.size / 1024)} KiB)
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="evidence-caption"
                  style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
                >
                  Evidence Caption
                </label>
                <input
                  id="evidence-caption"
                  type="text"
                  disabled={selectedStop.visitStatus !== "in_progress"}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="e.g., Beverage cooler endcap after restock"
                  style={{
                    width: "100%",
                    minHeight: "var(--touch-target-min)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  minHeight: "var(--touch-target-min)",
                }}
              >
                <input
                  type="checkbox"
                  checked={simulateStorageUploadFailure}
                  onChange={(e) => setSimulateStorageUploadFailure(e.target.checked)}
                />
                <span>
                  Simulate network/storage upload failure (test safe retry without marking
                  evidence as uploaded)
                </span>
              </label>

              {uploadProgress !== null ? (
                <div aria-live="polite" className="card-meta">
                  Upload progress: {uploadProgress}%
                </div>
              ) : null}

              <div>
                <button
                  type="submit"
                  disabled={selectedStop.visitStatus !== "in_progress"}
                  className="btn btn-primary"
                >
                  {lastFailedUploadIdempotencyKey
                    ? "Retry Evidence Upload (Idempotent)"
                    : "Upload Evidence Privately"}
                </button>
              </div>
            </form>

            <div
              style={{
                borderTop: "1px solid var(--border-subtle, #e2e8f0)",
                marginTop: "1rem",
                paddingTop: "0.75rem",
              }}
            >
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
                Confirmed Private Evidence ({selectedStop.evidence.length})
              </h3>
              {selectedStop.evidence.length === 0 ? (
                <p className="card-meta" style={{ margin: 0 }}>
                  No confirmed evidence files uploaded for this stop yet.
                </p>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {selectedStop.evidence.map((ev) => (
                    <li key={ev.id}>
                      <strong>{ev.caption}</strong> ({ev.fileType},{" "}
                      {Math.round(ev.fileSize / 1024)} KiB) — Object Path:{" "}
                      <code>{ev.storagePath}</code>{" "}
                      <a
                        href={ev.signedDownloadUrl}
                        style={{ fontWeight: 600, marginLeft: "0.35rem" }}
                      >
                        Request Signed URL
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
