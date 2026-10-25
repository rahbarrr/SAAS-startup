/**
 * FieldTrack Phase 7 — Enterprise Audit CSV Serializer with Formula Injection Protection.
 *
 * Implements strict RFC 4180 CSV serialization while mitigating CSV Formula Injection (DDE).
 * Characters that trigger formula execution in spreadsheet software (=, +, -, @, \t, \r)
 * are neutralized by prefixing them with an apostrophe (').
 */

import type { OrganizationAuditEvent } from "./domain";

const INJECTION_CHARACTERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutralizes potentially malicious spreadsheet formula injection payloads.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = typeof value === "object" ? JSON.stringify(value) : String(value);

  // If the field starts with a formula trigger character, prepend an apostrophe (')
  if (INJECTION_CHARACTERS.some((char) => str.startsWith(char))) {
    str = `'${str}`;
  }

  // Escape any existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');

  // Wrap in double quotes if it contains commas, quotes, or newlines
  if (/[",\n\r]/.test(escaped) || str.startsWith("'")) {
    return `"${escaped}"`;
  }

  return escaped;
}

export const AUDIT_CSV_COLUMNS = [
  "Event ID",
  "Timestamp (UTC)",
  "Organization ID",
  "Actor User ID",
  "Actor Role",
  "Action Type",
  "Entity Type",
  "Entity ID",
  "Correlation ID",
  "Reason",
  "Changes",
  "Metadata",
] as const;

/**
 * Converts a list of organization audit events into safe, sanitized RFC 4180 CSV text.
 */
export function serializeAuditEventsToCsv(
  events: readonly OrganizationAuditEvent[]
): string {
  const headerRow = AUDIT_CSV_COLUMNS.map((col) => `"${col}"`).join(",");

  const dataRows = events.map((event) => {
    return [
      sanitizeCsvCell(event.id),
      sanitizeCsvCell(event.createdAt),
      sanitizeCsvCell(event.orgId),
      sanitizeCsvCell(event.actorUserId ?? "SYSTEM"),
      sanitizeCsvCell(event.actorRole ?? "none"),
      sanitizeCsvCell(event.actionType),
      sanitizeCsvCell(event.entityType),
      sanitizeCsvCell(event.entityId),
      sanitizeCsvCell(event.correlationId ?? ""),
      sanitizeCsvCell(event.reason ?? ""),
      sanitizeCsvCell(event.changes),
      sanitizeCsvCell(event.metadata),
    ].join(",");
  });

  return [headerRow, ...dataRows].join("\r\n");
}
