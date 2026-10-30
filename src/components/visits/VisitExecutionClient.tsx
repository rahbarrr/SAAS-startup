"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { ErrorState } from "@/components/ui/States";
import {
  loadLocalVisitDraft,
  saveLocalVisitDraft,
} from "@/lib/offline/visit-draft-storage";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";
import {
  captureDeviceLocationWithConsent,
  classifyRequestFailure,
  createInFlightActionGuard,
  formatUtcTimestamp,
} from "@/lib/ux/formatting-and-resilience";
import type { ChecklistAnswerType, VisitStatus } from "@/modules/visits/domain";
import type { ChecklistAnswerItemInput } from "@/modules/visits/schemas";

export interface InteractiveChecklistItem {
  id: string;
  questionKey: string;
  label: string;
  answerType: ChecklistAnswerType;
  answerValue: unknown;
  answerText: string | null;
  flagged: boolean;
  required: boolean;
  completed: boolean;
}

export interface InteractiveEvidenceItem {
  id: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  caption: string;
  createdAt: string;
}

export interface VisitExecutionClientProps {
  activeOrgId: string;
  visitId: string;
  isOwnerOrCanWrite: boolean;
  initialVisitStatus: VisitStatus;
  initialChecklistItems: readonly {
    id: string;
    questionKey: string;
    label: string;
    answerType: ChecklistAnswerType;
    answerValue: unknown;
    answerText: string | null;
    flagged: boolean;
    required: boolean;
    completedAt: string | null;
  }[];
  initialEvidence: readonly InteractiveEvidenceItem[];
  initialNotes: string;
}

export function VisitExecutionClient({
  activeOrgId,
  visitId,
  isOwnerOrCanWrite,
  initialVisitStatus,
  initialChecklistItems,
  initialEvidence,
  initialNotes,
}: VisitExecutionClientProps): ReactNode {
  const router = useRouter();
  const actionGuard = createInFlightActionGuard();

  const [visitStatus, setVisitStatus] = useState<VisitStatus>(initialVisitStatus);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [checklist, setChecklist] = useState<InteractiveChecklistItem[]>(
    initialChecklistItems.map((item) => ({
      id: item.id,
      questionKey: item.questionKey,
      label: item.label,
      answerType: item.answerType,
      answerValue: item.answerValue,
      answerText: item.answerText,
      flagged: item.flagged,
      required: item.required,
      completed: Boolean(item.completedAt),
    }))
  );
  const [evidenceList, setEvidenceList] = useState<InteractiveEvidenceItem[]>([
    ...initialEvidence,
  ]);

  // Evidence upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [evidenceCaption, setEvidenceCaption] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setSelectedFilePreview(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setSelectedFilePreview(null);
    return undefined;
  }, [selectedFile]);

  // Status & error banners
  const [isSavingChecklist, setIsSavingChecklist] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const isInProgress = visitStatus === "in_progress";

  function handleChecklistChange(
    index: number,
    field: "completed" | "answerText" | "flagged" | "answerValue",
    val: unknown
  ) {
    setChecklist((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item) {
        updated[index] = { ...item, [field]: val };
      }
      return updated;
    });
  }

  // Load existing offline draft if available on device
  useEffect(() => {
    const draft = loadLocalVisitDraft(activeOrgId, visitId);
    if (draft && draft.checklist.length > 0) {
      setNotes((prev) => (prev ? prev : draft.notes));
      setChecklist((prev) =>
        prev.map((item) => {
          const draftItem = draft.checklist.find(
            (d) => d.questionKey === item.questionKey
          );
          if (draftItem) {
            return {
              ...item,
              completed: draftItem.completed,
              flagged: draftItem.flagged,
              answerText: draftItem.answerText || item.answerText,
            };
          }
          return item;
        })
      );
    }
  }, [activeOrgId, visitId]);

  async function saveChecklistInternal(): Promise<{ offline: boolean }> {
    const payloadItems: ChecklistAnswerItemInput[] = checklist.map((item) => ({
      questionKey: item.questionKey,
      label: item.label,
      answerType: item.answerType,
      answerValue:
        typeof item.answerValue === "boolean" ||
        typeof item.answerValue === "string" ||
        typeof item.answerValue === "number"
          ? item.answerValue
          : (item.answerText ?? null),
      answerText: item.answerText,
      flagged: item.flagged,
      required: item.required,
      completed: item.completed,
    }));

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (isOffline) {
      saveLocalVisitDraft({
        orgId: activeOrgId,
        tripStopId: visitId,
        visitId,
        visitStatus,
        checkedInAt: null,
        notes,
        checklist: checklist.map((item) => ({
          questionKey: item.questionKey,
          completed: item.completed,
          flagged: item.flagged,
          answerText: item.answerText ?? "",
        })),
        updatedAt: new Date().toISOString(),
      });

      enqueueOfflineOperation({
        input: {
          orgId: activeOrgId,
          userId: "current-user",
          targetId: visitId,
          operationType: "save_checklist",
          payload: {
            notes: notes.trim() || undefined,
            checklistItems: payloadItems,
          },
        },
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ft_offline_queue_changed"));
      }
      return { offline: true };
    }

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          checklistItems: payloadItems,
        }),
      });

      const body = (await res.json()) as {
        data?: { visit: { status: VisitStatus } };
        error?: { message: string; code?: string };
      };

      if (!res.ok || body.error) {
        const classified = classifyRequestFailure({
          status: res.status,
          errorCode: body.error?.code,
          errorMessage: body.error?.message,
        });
        throw new Error(classified.userMessage);
      }

      return { offline: false };
    } catch {
      // If network fetch fails due to sudden connection dropout, save to local offline queue
      saveLocalVisitDraft({
        orgId: activeOrgId,
        tripStopId: visitId,
        visitId,
        visitStatus,
        checkedInAt: null,
        notes,
        checklist: checklist.map((item) => ({
          questionKey: item.questionKey,
          completed: item.completed,
          flagged: item.flagged,
          answerText: item.answerText ?? "",
        })),
        updatedAt: new Date().toISOString(),
      });

      enqueueOfflineOperation({
        input: {
          orgId: activeOrgId,
          userId: "current-user",
          targetId: visitId,
          operationType: "save_checklist",
          payload: {
            notes: notes.trim() || undefined,
            checklistItems: payloadItems,
          },
        },
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ft_offline_queue_changed"));
      }
      return { offline: true };
    }
  }

  async function handleSaveChecklist(e?: FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsSavingChecklist(true);

    try {
      const result = await saveChecklistInternal();
      setConfirmation(
        result.offline
          ? "Checklist answers saved locally on device (Offline). Queued for sync when online."
          : "Checklist answers and notes successfully saved to server."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving checklist.");
    } finally {
      setIsSavingChecklist(false);
      actionGuard.release();
    }
  }

  async function handleUploadEvidence(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select an image or PDF file to upload.");
      return;
    }

    if (selectedFile.size > 26_214_400) {
      setError("File exceeds maximum allowed size of 25 MiB (26,214,400 bytes).");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        "Unsupported file format. Please upload a JPEG, PNG, WebP image or PDF document."
      );
      return;
    }

    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsUploading(true);

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (isOffline) {
      const reader = new FileReader();
      reader.onload = () => {
        enqueueOfflineOperation({
          input: {
            orgId: activeOrgId,
            userId: "current-user",
            targetId: visitId,
            operationType: "record_evidence",
            payload: {
              dataUrl: reader.result as string,
              fileType: selectedFile.type,
              fileSize: selectedFile.size,
              fileName: selectedFile.name,
              caption: evidenceCaption.trim() || selectedFile.name,
            },
          },
        });
        setEvidenceList((prev) => [
          ...prev,
          {
            id: `offline-${Date.now()}`,
            storagePath: "(pending-offline-sync)",
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            caption: `${evidenceCaption.trim() || selectedFile.name} (Queued offline)`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setSelectedFile(null);
        setEvidenceCaption("");
        setConfirmation(
          "Photo evidence queued locally on your device. Upload will commence automatically upon reconnection."
        );
        setIsUploading(false);
        actionGuard.release();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ft_offline_queue_changed"));
        }
      };
      reader.readAsDataURL(selectedFile);
      return;
    }

    try {
      // 1. Request signed upload ticket
      const ticketRes = await fetch(
        `/api/orgs/${activeOrgId}/visits/${visitId}/evidence?action=request_ticket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            originalFileName: selectedFile.name,
          }),
        }
      );

      const ticketBody = (await ticketRes.json()) as {
        data?: {
          signedUploadUrl: string;
          storagePath: string;
        };
        error?: { message: string; code?: string };
      };

      if (!ticketRes.ok || ticketBody.error || !ticketBody.data) {
        const classified = classifyRequestFailure({
          status: ticketRes.status,
          errorCode: ticketBody.error?.code,
          errorMessage: ticketBody.error?.message,
        });
        throw new Error(classified.userMessage);
      }

      const { signedUploadUrl, storagePath } = ticketBody.data;

      // 2. Upload file bytes directly to Supabase storage signed URL
      const uploadRes = await fetch(signedUploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error(
          `Direct storage upload failed with HTTP status ${uploadRes.status}`
        );
      }

      // 3. Confirm evidence upload on the backend with client idempotency key
      const idempotencyKey = crypto.randomUUID();
      const confirmRes = await fetch(
        `/api/orgs/${activeOrgId}/visits/${visitId}/evidence?action=confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            caption: evidenceCaption.trim() || selectedFile.name,
            idempotencyKey,
          }),
        }
      );

      const confirmBody = (await confirmRes.json()) as {
        data?: InteractiveEvidenceItem;
        error?: { message: string; code?: string };
      };

      if (!confirmRes.ok || confirmBody.error || !confirmBody.data) {
        const classified = classifyRequestFailure({
          status: confirmRes.status,
          errorCode: confirmBody.error?.code,
          errorMessage: confirmBody.error?.message,
        });
        throw new Error(classified.userMessage);
      }

      const confirmedEvidence = confirmBody.data;
      setEvidenceList((prev) => [...prev, confirmedEvidence]);
      setSelectedFile(null);
      setEvidenceCaption("");
      setConfirmation("Photo evidence uploaded and registered successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error uploading evidence.");
    } finally {
      setIsUploading(false);
      actionGuard.release();
    }
  }

  async function handleCheckOut(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);

    // Verify required checklist items are checked locally first
    const uncompletedRequired = checklist.filter(
      (item) => item.required && !item.completed
    );
    if (uncompletedRequired.length > 0) {
      setError(
        `Cannot check out: ${uncompletedRequired.length} required checklist item(s) are incomplete: ${uncompletedRequired.map((i) => `"${i.label}"`).join(", ")}`
      );
      return;
    }

    if (!actionGuard.tryAcquire()) return;
    setIsCheckingOut(true);

    try {
      // First save latest checklist state to be certain
      await saveChecklistInternal();

      // On-demand device location capture with user consent
      const loc = await captureDeviceLocationWithConsent();
      const idempotencyKey = crypto.randomUUID();

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      if (isOffline) {
        enqueueOfflineOperation({
          input: {
            orgId: activeOrgId,
            userId: "current-user",
            targetId: visitId,
            operationType: "checkout_visit",
            payload: {
              notes: notes.trim() || undefined,
              idempotencyKey,
              location: loc,
            },
          },
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ft_offline_queue_changed"));
        }
        setConfirmation(
          "Check-out request recorded offline with GPS telemetry consent. Note: visit completion requires server confirmation and remains pending sync."
        );
        return;
      }

      const res = await fetch(`/api/orgs/${activeOrgId}/visits/${visitId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          idempotencyKey,
          location: loc,
        }),
      });

      const body = (await res.json()) as {
        data?: { status: VisitStatus };
        error?: { message: string; code?: string };
      };

      if (!res.ok || body.error) {
        const classified = classifyRequestFailure({
          status: res.status,
          errorCode: body.error?.code,
          errorMessage: body.error?.message,
        });
        throw new Error(classified.userMessage);
      }

      setVisitStatus("submitted");
      setConfirmation("Visit checkout completed successfully. Stop marked as visited.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error completing checkout.");
    } finally {
      setIsCheckingOut(false);
      actionGuard.release();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Prominent Location Telemetry & Consent Status Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          borderRadius: "var(--radius-md)",
          background:
            "linear-gradient(135deg, rgba(41, 63, 145, 0.05) 0%, rgba(56, 217, 214, 0.08) 100%)",
          border: "1px solid var(--brand-cyan-border)",
        }}
      >
        <span style={{ fontSize: "1.25rem" }} aria-hidden="true">
          🛰️
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <strong style={{ fontSize: "0.875rem", color: "var(--brand-dark)" }}>
            GPS Point-in-Time Verification Ready
          </strong>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Proximity to store is captured strictly with device consent on check-in and
            checkout. No continuous tracking.
          </span>
        </div>
      </div>
      {error ? (
        <ErrorState
          title="Visit execution issue"
          message={error}
          onRetry={() => setError(null)}
        />
      ) : null}

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          className="state-panel"
          style={{
            padding: "0.875rem 1.25rem",
            textAlign: "left",
            backgroundColor: "var(--color-success-subtle, #ecfdf5)",
            border: "1px solid var(--color-success-border, #a7f3d0)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <strong>{confirmation}</strong>
        </div>
      ) : null}

      {/* 1. Checklist Items Form */}
      <section className="card" aria-labelledby="active-checklist-heading">
        <div className="card-header">
          <div>
            <h2 id="active-checklist-heading" className="card-title">
              Audit Checklist ({checklist.filter((c) => c.completed).length}/
              {checklist.length} Completed)
            </h2>
            <p className="card-meta">
              Mark required items complete and record observations before checking out.
            </p>
          </div>
        </div>

        {checklist.length === 0 ? (
          <p className="card-meta">No checklist items configured for this visit.</p>
        ) : (
          <form
            onSubmit={handleSaveChecklist}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {checklist.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: "0.875rem 1rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: item.completed
                      ? "var(--bg-subtle, #f9fafb)"
                      : "var(--bg-surface)",
                    border:
                      item.required && !item.completed
                        ? "1px solid #f59e0b"
                        : "1px solid var(--border-default, #e5e7eb)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <label
                      htmlFor={`check-${item.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 600,
                        cursor: isInProgress ? "pointer" : "default",
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`check-${item.id}`}
                        checked={item.completed}
                        disabled={!isInProgress || !isOwnerOrCanWrite}
                        onChange={(e) =>
                          handleChecklistChange(idx, "completed", e.target.checked)
                        }
                        style={{ width: "1.25rem", height: "1.25rem", cursor: "pointer" }}
                      />
                      <span>
                        {item.label}{" "}
                        {item.required ? (
                          <strong style={{ color: "#d97706" }}>(Required)</strong>
                        ) : (
                          "(Optional)"
                        )}
                      </span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.8125rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.flagged}
                        disabled={!isInProgress || !isOwnerOrCanWrite}
                        onChange={(e) =>
                          handleChecklistChange(idx, "flagged", e.target.checked)
                        }
                      />
                      <span>Flag for Attention</span>
                    </label>
                  </div>

                  {isInProgress ? (
                    <div style={{ paddingLeft: "1.75rem" }}>
                      <input
                        type="text"
                        value={item.answerText ?? ""}
                        placeholder="Answer / notes on planogram, stock, or promotional display…"
                        disabled={!isOwnerOrCanWrite}
                        onChange={(e) => {
                          handleChecklistChange(idx, "answerText", e.target.value);
                          handleChecklistChange(idx, "answerValue", e.target.value);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-default)",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                  ) : item.answerText ? (
                    <div
                      style={{
                        paddingLeft: "1.75rem",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Observation: <em>{item.answerText}</em>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {isInProgress && isOwnerOrCanWrite ? (
              <div>
                <button
                  type="submit"
                  disabled={isSavingChecklist}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.875rem" }}
                >
                  {isSavingChecklist ? "Saving Changes…" : "Save Checklist Progress"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </section>

      {/* 2. Photo Evidence Upload & Gallery */}
      <section className="card" aria-labelledby="active-evidence-heading">
        <div className="card-header">
          <div>
            <h2 id="active-evidence-heading" className="card-title">
              Private Photo Evidence ({evidenceList.length})
            </h2>
            <p className="card-meta">
              Securely stored with private tenant access. Max 25 MiB per file (JPEG, PNG,
              WebP, PDF).
            </p>
          </div>
        </div>

        {isInProgress && isOwnerOrCanWrite ? (
          <form
            onSubmit={handleUploadEvidence}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-subtle, #f9fafb)",
              border: "1px dashed var(--border-strong)",
              marginBottom: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Upload New Photo Evidence</h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.5rem 0.875rem",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    minHeight: "44px",
                    fontWeight: 500,
                  }}
                >
                  📸 Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const f = e.target.files?.[0] ?? null;
                      setSelectedFile(f);
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.5rem 0.875rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    minHeight: "44px",
                    fontWeight: 500,
                  }}
                >
                  📁 Choose File
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const f = e.target.files?.[0] ?? null;
                      setSelectedFile(f);
                    }}
                  />
                </label>
              </div>

              {selectedFilePreview ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    width: "100%",
                    padding: "0.5rem",
                    background: "#f8fafc",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <img
                    src={selectedFilePreview}
                    alt="Selected evidence preview"
                    style={{
                      width: "60px",
                      height: "60px",
                      objectFit: "cover",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--brand-dark)",
                      }}
                      className="text-truncate"
                    >
                      {selectedFile?.name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {selectedFile ? Math.round(selectedFile.size / 1024) : 0} KiB •
                      Ready to upload
                    </span>
                  </div>
                </div>
              ) : selectedFile ? (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "#0f766e",
                    fontWeight: 600,
                    width: "100%",
                  }}
                >
                  Ready to upload: {selectedFile.name} (
                  {Math.round(selectedFile.size / 1024)} KiB)
                </div>
              ) : null}

              <input
                type="text"
                placeholder="Caption (e.g., Endcap cooler display, aisle 3)"
                value={evidenceCaption}
                onChange={(e) => setEvidenceCaption(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  fontSize: "0.875rem",
                  minHeight: "44px",
                }}
              />
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="btn btn-primary"
                style={{ fontSize: "0.875rem", minHeight: "44px", padding: "0 1.25rem" }}
              >
                {isUploading ? "Uploading…" : "Upload Evidence"}
              </button>
            </div>
          </form>
        ) : null}

        {evidenceList.length === 0 ? (
          <p className="card-meta">No photo evidence uploaded yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
              gap: "0.875rem",
            }}
          >
            {evidenceList.map((ev) => {
              const isImage = ev.fileType.startsWith("image/");
              const evidenceUrl = `/api/orgs/${activeOrgId}/visits/${visitId}/evidence?evidenceId=${ev.id}&download=true`;

              return (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-surface)",
                    boxShadow: "var(--shadow-neu-raised-sm)",
                    gap: "0.5rem",
                  }}
                >
                  {isImage ? (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "120px",
                        backgroundColor: "#f1f5f9",
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={evidenceUrl}
                        alt={ev.caption || "Evidence photo"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "80px",
                        backgroundColor: "#f8fafc",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                      }}
                    >
                      📄
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--text-primary)",
                      }}
                      className="text-truncate"
                    >
                      {ev.caption || "Evidence file"}
                    </strong>
                    <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                      {ev.fileType.split("/")[1]?.toUpperCase() ?? "FILE"} •{" "}
                      {Math.round(ev.fileSize / 1024)} KiB
                    </span>
                    <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                      {formatUtcTimestamp(ev.createdAt)}
                    </span>
                  </div>

                  <a
                    href={evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline"
                    style={{
                      marginTop: "auto",
                      textAlign: "center",
                      fontSize: "0.75rem",
                      minHeight: "36px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    View / Download →
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Check Out Form */}
      {isInProgress && isOwnerOrCanWrite ? (
        <section className="card" aria-labelledby="checkout-heading">
          <div className="card-header">
            <div>
              <h2 id="checkout-heading" className="card-title">
                Complete Store Visit &amp; Check Out
              </h2>
              <p className="card-meta">
                Completes this visit, records checkout telemetry, and marks the trip stop
                as visited.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleCheckOut}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <label htmlFor="visit-final-notes" style={{ fontWeight: 600 }}>
              Final Visit Notes &amp; Observations:
            </label>
            <textarea
              id="visit-final-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary of store visit execution, manager interactions, and product merchandising…"
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
              }}
            />

            <div>
              <button
                type="submit"
                disabled={isCheckingOut}
                className="btn btn-primary"
                style={{ padding: "0.625rem 1.25rem", fontWeight: 700 }}
              >
                {isCheckingOut
                  ? "Processing Checkout…"
                  : "Complete Check Out & Submit Visit"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
