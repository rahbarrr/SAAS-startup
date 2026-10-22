import crypto from "node:crypto";

export const VISIT_STATUSES = ["in_progress", "submitted", "reviewed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_LOCATION_STATUSES = [
  "captured_unverified",
  "permission_denied",
  "unavailable",
] as const;
export type VisitLocationStatus = (typeof VISIT_LOCATION_STATUSES)[number];

export const CHECKLIST_ANSWER_TYPES = ["boolean", "text", "number", "select"] as const;
export type ChecklistAnswerType = (typeof CHECKLIST_ANSWER_TYPES)[number];

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type AllowedEvidenceMimeType = (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number];

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 26_214_400; // 25 MiB
export const EVIDENCE_STORAGE_BUCKET = "visit-evidence";

export type LocationCapturePolicy =
  "allow_without_location_with_explanation" | "require_location";

export interface UnverifiedDeviceLocation {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  status: VisitLocationStatus;
  verificationNotice: "unverified_device_reported";
  limitationExplanation: string | null;
}

export interface Visit {
  id: string;
  orgId: string;
  tripStopId: string;
  employeeUserId: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkInLocation: UnverifiedDeviceLocation;
  checkOutLocation: UnverifiedDeviceLocation;
  checkInIdempotencyKey: string | null;
  checkOutIdempotencyKey: string | null;
  notes: string;
  status: VisitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VisitChecklistItem {
  id: string;
  orgId: string;
  visitId: string;
  questionKey: string;
  label: string;
  answerType: ChecklistAnswerType;
  answerValue: unknown;
  answerText: string | null;
  flagged: boolean;
  required: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitEvidence {
  id: string;
  orgId: string;
  visitId: string;
  storagePath: string;
  fileType: AllowedEvidenceMimeType;
  fileSize: number;
  caption: string;
  uploadedBy: string;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface VisitDetail {
  visit: Visit;
  checklistItems: VisitChecklistItem[];
  evidence: VisitEvidence[];
}

export interface SignedEvidenceUploadTicket {
  bucket: string;
  storagePath: string;
  signedUploadUrl: string;
  token: string;
  expiresInSeconds: number;
  maxBytes: number;
  allowedMimeType: AllowedEvidenceMimeType;
}

export interface SignedEvidenceDownloadUrl {
  evidenceId: string;
  storagePath: string;
  signedDownloadUrl: string;
  expiresInSeconds: number;
}

const MIME_TO_EXTENSION: Readonly<Record<AllowedEvidenceMimeType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Generates a server-controlled, tenant-scoped, randomized object path:
 * `<orgId>/<visitId>/<randomUUID>.<ext>`
 * Never trusts client-supplied paths or filenames.
 */
export function generateSafeEvidenceObjectPath(params: {
  orgId: string;
  visitId: string;
  mimeType: AllowedEvidenceMimeType;
  randomId?: string;
}): string {
  const ext = MIME_TO_EXTENSION[params.mimeType];
  const objectUuid = params.randomId ?? crypto.randomUUID();
  return `${params.orgId}/${params.visitId}/${objectUuid}.${ext}`;
}

export function buildUnverifiedDeviceLocation(params: {
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  status: VisitLocationStatus;
}): UnverifiedDeviceLocation {
  if (
    params.status === "captured_unverified" &&
    params.lat !== null &&
    params.lng !== null
  ) {
    return {
      latitude: params.lat,
      longitude: params.lng,
      accuracyMeters: params.accuracyMeters,
      status: "captured_unverified",
      verificationNotice: "unverified_device_reported",
      limitationExplanation:
        "Coordinates and accuracy were reported by the employee's browser/device at the time of action and are stored as unverified telemetry, not proof of identity or guaranteed location truth.",
    };
  }

  if (params.status === "permission_denied") {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      status: "permission_denied",
      verificationNotice: "unverified_device_reported",
      limitationExplanation:
        "Browser/device location permission was denied. Visit execution proceeded under organization policy with location recorded as permission_denied.",
    };
  }

  return {
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    status: "unavailable",
    verificationNotice: "unverified_device_reported",
    limitationExplanation:
      "Device location was unavailable at the time of capture. Visit execution proceeded under organization policy without coordinates.",
  };
}
