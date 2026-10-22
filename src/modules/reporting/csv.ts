import type { PlannedVsActualStopRow } from "./domain";

const FORMULA_INJECTION_PREFIX_REGEX = /^(?:[\t\r]|[ \t\r\n]*[=+\-@])/;

/**
 * Escapes a string value to prevent CSV/spreadsheet formula injection (OWASP CSV Injection)
 * and formats it according to RFC 4180.
 */
export function sanitizeAndQuoteCsvText(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }

  const normalized = String(raw);
  const formulaSafe = FORMULA_INJECTION_PREFIX_REGEX.test(normalized)
    ? `'${normalized}`
    : normalized;

  if (/[",\r\n]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }

  return formulaSafe;
}

export function formatCsvNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  return String(value);
}

export const MANAGER_REPORT_CSV_HEADERS = [
  "trip_id",
  "trip_title",
  "trip_status",
  "trip_start_date_utc",
  "trip_end_date_utc",
  "employee_user_id",
  "stop_sequence",
  "store_id",
  "store_name",
  "store_region",
  "planned_at_utc",
  "planned_stop_status",
  "actual_visit_id",
  "actual_visit_status",
  "checked_in_at_utc",
  "checked_out_at_utc",
  "check_in_location_status",
  "check_in_unverified_lat",
  "check_in_unverified_lng",
  "check_in_unverified_accuracy_m",
  "check_out_location_status",
  "check_out_unverified_lat",
  "check_out_unverified_lng",
  "check_out_unverified_accuracy_m",
  "required_checklist_completed",
  "required_checklist_total",
  "flagged_checklist_count",
  "evidence_count",
  "visit_notes",
  "requires_attention",
  "attention_reasons",
] as const;

/**
 * Serializes authorized `PlannedVsActualStopRow` records to a safe CSV document.
 * - Escapes spreadsheet formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in user-controlled strings.
 * - Never exports secrets, tokens, or internal idempotency keys.
 * - Explicitly labels coordinates as unverified device-reported records.
 */
export function buildManagerReportCsv(rows: readonly PlannedVsActualStopRow[]): string {
  const headerLine = MANAGER_REPORT_CSV_HEADERS.join(",");
  if (rows.length === 0) {
    return `${headerLine}\r\n`;
  }

  const dataLines = rows.map((row) => {
    const columns: string[] = [
      sanitizeAndQuoteCsvText(row.tripId),
      sanitizeAndQuoteCsvText(row.tripTitle),
      sanitizeAndQuoteCsvText(row.tripStatus),
      sanitizeAndQuoteCsvText(row.tripStartDate),
      sanitizeAndQuoteCsvText(row.tripEndDate),
      sanitizeAndQuoteCsvText(row.ownerUserId),
      formatCsvNumber(row.sequenceNumber),
      sanitizeAndQuoteCsvText(row.storeId),
      sanitizeAndQuoteCsvText(row.storeName),
      sanitizeAndQuoteCsvText(row.storeRegion),
      sanitizeAndQuoteCsvText(row.plannedAt),
      sanitizeAndQuoteCsvText(row.plannedStopStatus),
      sanitizeAndQuoteCsvText(row.actualVisitId),
      sanitizeAndQuoteCsvText(row.actualVisitStatus),
      sanitizeAndQuoteCsvText(row.checkedInAt),
      sanitizeAndQuoteCsvText(row.checkedOutAt),
      sanitizeAndQuoteCsvText(row.checkInLocation?.status ?? null),
      formatCsvNumber(row.checkInLocation?.latitude ?? null),
      formatCsvNumber(row.checkInLocation?.longitude ?? null),
      formatCsvNumber(row.checkInLocation?.accuracyMeters ?? null),
      sanitizeAndQuoteCsvText(row.checkOutLocation?.status ?? null),
      formatCsvNumber(row.checkOutLocation?.latitude ?? null),
      formatCsvNumber(row.checkOutLocation?.longitude ?? null),
      formatCsvNumber(row.checkOutLocation?.accuracyMeters ?? null),
      formatCsvNumber(row.requiredChecklistCompletedCount),
      formatCsvNumber(row.requiredChecklistTotalCount),
      formatCsvNumber(row.flaggedChecklistCount),
      formatCsvNumber(row.evidenceCount),
      sanitizeAndQuoteCsvText(row.visitNotes),
      row.requiresAttention ? "true" : "false",
      sanitizeAndQuoteCsvText(row.attentionReasons.join("; ")),
    ];

    return columns.join(",");
  });

  return `${headerLine}\r\n${dataLines.join("\r\n")}\r\n`;
}
