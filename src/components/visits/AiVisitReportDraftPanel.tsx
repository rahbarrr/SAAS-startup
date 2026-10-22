"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { getProvenanceStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import type {
  AiFeatureAvailabilityStatus,
  VisitAiReportDraft,
} from "@/modules/ai-reports/domain";

export interface SelectableChecklistSource {
  id: string;
  label: string;
}

export interface SelectableEvidenceSource {
  id: string;
  caption: string;
  fileType: string;
}

export interface AiVisitReportDraftPanelProps {
  orgId: string;
  visitId: string;
  availability: AiFeatureAvailabilityStatus;
  initialDrafts: readonly VisitAiReportDraft[];
  completedChecklistItems: readonly SelectableChecklistSource[];
  uploadedEvidenceItems: readonly SelectableEvidenceSource[];
}

export function AiVisitReportDraftPanel({
  orgId,
  visitId,
  availability,
  initialDrafts,
  completedChecklistItems,
  uploadedEvidenceItems,
}: AiVisitReportDraftPanelProps): ReactNode {
  const [drafts, setDrafts] = useState<readonly VisitAiReportDraft[]>(initialDrafts);
  const [includeVisitNotes, setIncludeVisitNotes] = useState<boolean>(true);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>(
    completedChecklistItems.map((c) => c.id)
  );
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const activeDraft = drafts[0] ?? null;
  const [editedSummary, setEditedSummary] = useState<string>(activeDraft?.summary ?? "");
  const [reviewNote, setReviewNote] = useState<string>(activeDraft?.reviewNote ?? "");

  function toggleChecklistSelection(id: string): void {
    setSelectedChecklistIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleEvidenceSelection(id: string): void {
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleGenerateDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!availability.enabled) {
      return;
    }

    setErrorMessage(null);
    setStatusBanner(null);
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/visits/${encodeURIComponent(visitId)}/ai-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            includeVisitNotes,
            selectedChecklistItemIds: selectedChecklistIds,
            selectedEvidenceIds,
          }),
        }
      );

      const envelope = (await response.json()) as {
        data: VisitAiReportDraft | null;
        error: { message?: string } | null;
      };

      if (!response.ok || !envelope.data) {
        setErrorMessage(
          envelope.error?.message ??
            "Failed to generate AI visit report draft. Please try again."
        );
        return;
      }

      const created = envelope.data;
      setDrafts((prev) => [created, ...prev]);
      setEditedSummary(created.summary);
      setReviewNote(created.reviewNote ?? "");
      setStatusBanner(
        "AI report draft generated. Please review, edit if needed, and approve before treating as final."
      );
    } catch {
      setErrorMessage(
        "Network error while contacting the server-side AI report endpoint."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleReviewDecision(
    nextStatus: "pending_review" | "approved" | "rejected"
  ): Promise<void> {
    if (!activeDraft) {
      return;
    }

    setErrorMessage(null);
    setStatusBanner(null);
    setIsSavingReview(true);

    try {
      const response = await fetch(
        `/api/orgs/${encodeURIComponent(orgId)}/visits/${encodeURIComponent(visitId)}/ai-report`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: activeDraft.id,
            reviewStatus: nextStatus,
            summary: editedSummary,
            completedActions: activeDraft.completedActions,
            issues: activeDraft.issues,
            followUps: activeDraft.followUps,
            uncertaintyNotes: activeDraft.uncertaintyNotes,
            reviewNote: reviewNote.trim() || null,
          }),
        }
      );

      const envelope = (await response.json()) as {
        data: VisitAiReportDraft | null;
        error: { message?: string } | null;
      };

      if (!response.ok || !envelope.data) {
        setErrorMessage(
          envelope.error?.message ?? "Failed to save human review decision."
        );
        return;
      }

      const updated = envelope.data;
      setDrafts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditedSummary(updated.summary);
      setReviewNote(updated.reviewNote ?? "");
      setStatusBanner(
        nextStatus === "approved"
          ? "Report approved by human reviewer and marked as final."
          : nextStatus === "rejected"
            ? "AI draft rejected."
            : "Draft edits saved (still awaiting final human approval)."
      );
    } catch {
      setErrorMessage("Network error while saving human review decision.");
    } finally {
      setIsSavingReview(false);
    }
  }

  return (
    <section aria-labelledby="ai-report-draft-heading" className="card">
      <div className="card-header">
        <div>
          <h2 id="ai-report-draft-heading" className="card-title" style={{ margin: 0 }}>
            Optional AI Visit Report Draft
          </h2>
          <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
            Summarizes only authorized visit notes, completed checklist items, and
            explicitly selected evidence captions. Images and personal identifiers are
            never sent.
          </p>
        </div>
        {activeDraft ? (
          <StatusBadge
            descriptor={getProvenanceStatusDescriptor(
              activeDraft.isFinalApproved ? "human_verified" : "generated_draft"
            )}
          />
        ) : null}
      </div>

      {!availability.enabled ? (
        <div
          role="region"
          aria-label="AI report drafting disabled state"
          style={{
            marginTop: "0.75rem",
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-subtle, #cbd5e1)",
            backgroundColor: "var(--bg-surface-muted, #f8fafc)",
          }}
        >
          <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>
            AI Report Drafting Unavailable (Disabled State)
          </p>
          <p className="card-meta" style={{ margin: 0 }}>
            {availability.disabledReason ??
              "AI report drafting is not configured on this server."}
          </p>
          <p className="card-meta" style={{ margin: "0.35rem 0 0" }}>
            FieldTrack never displays simulated or fake AI summaries when the server-side
            OpenAI integration or organization quota is disabled.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            void handleGenerateDraft(e);
          }}
          style={{
            marginTop: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            className="card-meta"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-surface-muted, #f8fafc)",
            }}
          >
            <span>
              <strong>Configured Model:</strong>{" "}
              <code>{availability.configuredModel}</code>
            </span>
            <span>
              <strong>Organization Daily Quota (UTC):</strong>{" "}
              {availability.dailyOrgRemaining} remaining of {availability.dailyOrgQuota}
            </span>
          </div>

          <fieldset
            style={{
              border: "1px solid var(--border-subtle, #e2e8f0)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <legend style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Select Authorized Records to Summarize
            </legend>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                minHeight: "44px",
                fontSize: "0.875rem",
              }}
            >
              <input
                type="checkbox"
                checked={includeVisitNotes}
                onChange={(e) => setIncludeVisitNotes(e.target.checked)}
              />
              <span>Include visit notes (treated strictly as untrusted data)</span>
            </label>

            {completedChecklistItems.length > 0 ? (
              <div style={{ marginTop: "0.5rem" }}>
                <p
                  style={{
                    margin: "0 0 0.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                  }}
                >
                  Completed Checklist Items ({selectedChecklistIds.length}/
                  {completedChecklistItems.length})
                </p>
                {completedChecklistItems.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      minHeight: "44px",
                      fontSize: "0.875rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChecklistIds.includes(item.id)}
                      onChange={() => toggleChecklistSelection(item.id)}
                    />
                    <span>
                      {item.label} (<code>{item.id.slice(0, 8)}</code>)
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {uploadedEvidenceItems.length > 0 ? (
              <div style={{ marginTop: "0.5rem" }}>
                <p
                  style={{
                    margin: "0 0 0.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                  }}
                >
                  Evidence Captions/Metadata Explicitly Selected (
                  {selectedEvidenceIds.length}/{uploadedEvidenceItems.length}) — images
                  never sent
                </p>
                {uploadedEvidenceItems.map((ev) => (
                  <label
                    key={ev.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      minHeight: "44px",
                      fontSize: "0.875rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvidenceIds.includes(ev.id)}
                      onChange={() => toggleEvidenceSelection(ev.id)}
                    />
                    <span>
                      {ev.caption || "(No caption)"} [{ev.fileType}] (
                      <code>{ev.id.slice(0, 8)}</code>)
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <div>
            <button type="submit" className="btn btn-primary" disabled={isGenerating}>
              {isGenerating ? "Generating Structured Draft…" : "Generate AI Report Draft"}
            </button>
          </div>
        </form>
      )}

      {errorMessage ? (
        <div style={{ marginTop: "0.75rem" }}>
          <ErrorState title="AI Report Action Failed" message={errorMessage} />
        </div>
      ) : null}

      {statusBanner ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "var(--bg-surface-muted, #f8fafc)",
            fontSize: "0.875rem",
          }}
        >
          {statusBanner}
        </div>
      ) : null}

      {activeDraft ? (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border-subtle, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <strong>{activeDraft.aiGeneratedLabel}</strong>
            <span className="card-meta">
              Model: <code>{activeDraft.modelName}</code>
              {activeDraft.modelVersion ? ` (${activeDraft.modelVersion})` : ""} ·
              Template: <code>{activeDraft.promptTemplateVersion}</code>
            </span>
          </div>

          <div className="card-meta">
            Created by <code>{activeDraft.createdBy}</code> at{" "}
            <code>{activeDraft.createdAt}</code> · Human Review Status:{" "}
            <strong>{activeDraft.reviewStatus}</strong>
            {activeDraft.reviewedBy
              ? ` (Reviewed by ${activeDraft.reviewedBy} at ${activeDraft.reviewedAt ?? "—"})`
              : ""}
          </div>

          {activeDraft.uncertaintyNotes.length > 0 ? (
            <div
              role="note"
              aria-label="AI uncertainty and verification notes"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #f59e0b",
                backgroundColor: "#fffbeb",
                fontSize: "0.875rem",
              }}
            >
              <strong>Uncertainty & Verification Disclosures:</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                {activeDraft.uncertaintyNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="ai-draft-summary-input"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Summary (Editable before final approval)
            </label>
            <textarea
              id="ai-draft-summary-input"
              rows={4}
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border-subtle, #cbd5e1)",
              }}
            />
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
              Completed Actions ({activeDraft.completedActions.length})
            </h3>
            {activeDraft.completedActions.length === 0 ? (
              <p className="card-meta" style={{ margin: 0 }}>
                None recorded.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {activeDraft.completedActions.map((item, idx) => (
                  <li key={idx}>
                    {item.action}{" "}
                    <span className="card-meta">
                      [Sources: <code>{item.sourceRecordIds.join(", ")}</code>]
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
              Issues Identified ({activeDraft.issues.length})
            </h3>
            {activeDraft.issues.length === 0 ? (
              <p className="card-meta" style={{ margin: 0 }}>
                None recorded.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {activeDraft.issues.map((item, idx) => (
                  <li key={idx}>
                    <strong>[{item.severity.toUpperCase()}]</strong> {item.issue}{" "}
                    <span className="card-meta">
                      [Sources: <code>{item.sourceRecordIds.join(", ")}</code>]
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
              Recommended Follow-Ups ({activeDraft.followUps.length})
            </h3>
            {activeDraft.followUps.length === 0 ? (
              <p className="card-meta" style={{ margin: 0 }}>
                None recorded.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {activeDraft.followUps.map((item, idx) => (
                  <li key={idx}>
                    <strong>[{item.priority.toUpperCase()}]</strong> {item.recommendation}{" "}
                    <span className="card-meta">
                      [Sources: <code>{item.sourceRecordIds.join(", ")}</code>]
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card-meta">
            <strong>Source Record References:</strong> Visit{" "}
            <code>{activeDraft.sourceRecordIds.visitId}</code> · Checklist IDs:{" "}
            <code>
              {activeDraft.sourceRecordIds.checklistItemIds.join(", ") || "none"}
            </code>{" "}
            · Evidence IDs:{" "}
            <code>{activeDraft.sourceRecordIds.evidenceIds.join(", ") || "none"}</code>
          </div>

          <div>
            <label
              htmlFor="ai-draft-review-note"
              style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
            >
              Human Reviewer Note (Optional)
            </label>
            <input
              id="ai-draft-review-note"
              type="text"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Document edits or verification notes…"
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border-subtle, #cbd5e1)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSavingReview}
              onClick={() => {
                void handleReviewDecision("approved");
              }}
            >
              Approve as Final Report
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSavingReview}
              onClick={() => {
                void handleReviewDecision("pending_review");
              }}
            >
              Save Draft Edits
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSavingReview}
              onClick={() => {
                void handleReviewDecision("rejected");
              }}
            >
              Reject Draft
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
