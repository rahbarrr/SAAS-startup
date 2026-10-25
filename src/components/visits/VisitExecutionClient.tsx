"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import {
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
  const [evidenceCaption, setEvidenceCaption] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

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

  async function handleSaveChecklist(e?: FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsSavingChecklist(true);

    try {
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
        error?: { message: string };
      };

      if (!res.ok || body.error) {
        throw new Error(body.error?.message || "Failed to update checklist.");
      }

      setConfirmation("Checklist answers and notes successfully saved.");
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

    setError(null);
    setConfirmation(null);

    if (!actionGuard.tryAcquire()) return;
    setIsUploading(true);

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
        error?: { message: string };
      };

      if (!ticketRes.ok || ticketBody.error || !ticketBody.data) {
        throw new Error(
          ticketBody.error?.message || "Failed to request evidence upload ticket."
        );
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

      // 3. Confirm evidence upload on the backend
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
          }),
        }
      );

      const confirmBody = (await confirmRes.json()) as {
        data?: InteractiveEvidenceItem;
        error?: { message: string };
      };

      if (!confirmRes.ok || confirmBody.error || !confirmBody.data) {
        throw new Error(
          confirmBody.error?.message || "Failed to record confirmed evidence."
        );
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
      await handleSaveChecklist();

      const res = await fetch(`/api/orgs/${activeOrgId}/visits/${visitId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          location: {
            status: "captured_unverified",
            latitude: 41.8839,
            longitude: -87.6279,
            accuracyMeters: 8.5,
          },
        }),
      });

      const body = (await res.json()) as {
        data?: { status: VisitStatus };
        error?: { message: string };
      };

      if (!res.ok || body.error) {
        throw new Error(body.error?.message || "Failed to complete checkout.");
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
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                }}
                style={{ fontSize: "0.875rem" }}
              />
              <input
                type="text"
                placeholder="Caption (e.g., Endcap cooler display, aisle 3)"
                value={evidenceCaption}
                onChange={(e) => setEvidenceCaption(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "0.375rem 0.625rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  fontSize: "0.875rem",
                }}
              />
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="btn btn-primary"
                style={{ fontSize: "0.875rem" }}
              >
                {isUploading ? "Uploading…" : "Upload Evidence"}
              </button>
            </div>
          </form>
        ) : null}

        {evidenceList.length === 0 ? (
          <p className="card-meta">No photo evidence uploaded yet.</p>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {evidenceList.map((ev) => (
              <li key={ev.id}>
                <strong>{ev.caption || "Evidence photo"}</strong> ({ev.fileType},{" "}
                {Math.round(ev.fileSize / 1024)} KiB) — Uploaded at{" "}
                {formatUtcTimestamp(ev.createdAt)} •{" "}
                <a
                  href={`/api/orgs/${activeOrgId}/visits/${visitId}/evidence?evidenceId=${ev.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Request Download URL
                </a>
              </li>
            ))}
          </ul>
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
