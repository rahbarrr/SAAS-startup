import { describe, expect, it } from "vitest";
import { AppError, decodeCursor, encodeCursor } from "@/lib/http/envelope";
import type {
  AuthenticatedUser,
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  UserOrganizationSummary,
} from "@/modules/tenancy/domain";
import type {
  CreateInvitationRecordInput,
  PaginatedMembersResult,
  TenancyRepository,
} from "@/modules/tenancy/repository";
import type {
  AddOrgMemberInput,
  CreateOrganizationInput,
  ListOrgMembersQuery,
} from "@/modules/tenancy/schemas";
import type { Trip, TripStop } from "@/modules/trips/domain";
import {
  type AllowedEvidenceMimeType,
  EVIDENCE_STORAGE_BUCKET,
  generateSafeEvidenceObjectPath,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  type SignedEvidenceDownloadUrl,
  type SignedEvidenceUploadTicket,
  type UnverifiedDeviceLocation,
  type Visit,
  type VisitChecklistItem,
  type VisitDetail,
  type VisitEvidence,
  type VisitGeofenceEvent,
} from "@/modules/visits/domain";
import type {
  PaginatedVisitsResult,
  RecordGeofenceEventParams,
  TripStopExecutionContext,
  VisitsRepository,
} from "@/modules/visits/repository";
import type { ChecklistAnswerItemInput, ListVisitsQuery } from "@/modules/visits/schemas";
import {
  checkInStopForOrg,
  checkOutVisitForOrg,
  confirmEvidenceUploadForOrg,
  getSignedEvidenceDownloadUrlForOrg,
  getVisitDetailForOrg,
  listVisitsForOrg,
  requestEvidenceUploadTicketForOrg,
  updateVisitExecutionForOrg,
} from "@/modules/visits/service";

class InMemoryTenancyRepo implements TenancyRepository {
  public organizations: Organization[] = [];
  public memberships: OrganizationMembership[] = [];

  async getMembershipByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.userId === userId && m.orgId === orgId) ?? null;
  }

  async listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.memberships
      .filter((m) => m.userId === userId && m.status === "active")
      .map((membership) => {
        const organization = this.organizations.find((o) => o.id === membership.orgId);
        if (!organization) throw new Error("Missing org");
        return { organization, membership };
      });
  }

  async createOrganizationWithOwner(
    _userId: string,
    _input: CreateOrganizationInput
  ): Promise<Organization> {
    throw new Error("Not used");
  }

  async listOrgMembers(
    _orgId: string,
    _query: ListOrgMembersQuery
  ): Promise<PaginatedMembersResult> {
    throw new Error("Not used");
  }

  async addOrgMember(
    _orgId: string,
    _input: AddOrgMemberInput
  ): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }

  async createOrgInvitation(
    _input: CreateInvitationRecordInput
  ): Promise<OrganizationInvitation> {
    throw new Error("Not used");
  }

  async acceptOrgInvitationByTokenHash(): Promise<OrganizationMembership> {
    throw new Error("Not used");
  }
}

class InMemoryVisitsRepo implements VisitsRepository {
  public trips: Trip[] = [];
  public stops: TripStop[] = [];
  public visits: Visit[] = [];
  public checklistItems: VisitChecklistItem[] = [];
  public evidence: VisitEvidence[] = [];
  public uploadedStorageObjects = new Set<string>();
  private seq = 10;

  async listVisits(
    orgId: string,
    query: ListVisitsQuery
  ): Promise<PaginatedVisitsResult> {
    let filtered = this.visits
      .filter((v) => v.orgId === orgId)
      .filter((v) => (query.status ? v.status === query.status : true))
      .filter((v) => (query.tripStopId ? v.tripStopId === query.tripStopId : true))
      .filter((v) =>
        query.employeeUserId ? v.employeeUserId === query.employeeUserId : true
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      filtered = filtered.filter(
        (v) => v.createdAt < c.createdAt || (v.createdAt === c.createdAt && v.id < c.id)
      );
    }

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;
    const last = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: query.limit,
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  async getVisitDetail(orgId: string, visitId: string): Promise<VisitDetail | null> {
    const visit = this.visits.find((v) => v.orgId === orgId && v.id === visitId);
    if (!visit) return null;

    return {
      visit,
      checklistItems: this.checklistItems.filter(
        (c) => c.orgId === orgId && c.visitId === visitId
      ),
      evidence: this.evidence.filter((e) => e.orgId === orgId && e.visitId === visitId),
    };
  }

  async getVisitByTripStopId(orgId: string, tripStopId: string): Promise<Visit | null> {
    return (
      this.visits.find((v) => v.orgId === orgId && v.tripStopId === tripStopId) ?? null
    );
  }

  async getActiveVisitForEmployee(
    orgId: string,
    employeeUserId: string
  ): Promise<Visit | null> {
    return (
      this.visits.find(
        (v) =>
          v.orgId === orgId &&
          v.employeeUserId === employeeUserId &&
          v.status === "in_progress"
      ) ?? null
    );
  }

  async getTripStopExecutionContext(
    orgId: string,
    tripStopId: string
  ): Promise<TripStopExecutionContext | null> {
    const stop = this.stops.find((s) => s.orgId === orgId && s.id === tripStopId);
    if (!stop) return null;
    const trip = this.trips.find((t) => t.orgId === orgId && t.id === stop.tripId);
    if (!trip) return null;
    return { stop, trip };
  }

  async checkInStopAtomic(params: {
    orgId: string;
    tripStopId: string;
    employeeUserId: string;
    checkedInAt: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail> {
    const existing = await this.getVisitByTripStopId(params.orgId, params.tripStopId);
    if (existing) {
      if (
        params.idempotencyKey &&
        existing.checkInIdempotencyKey === params.idempotencyKey &&
        existing.employeeUserId === params.employeeUserId
      ) {
        const detail = await this.getVisitDetail(params.orgId, existing.id);
        if (!detail) throw new Error("Missing detail");
        return detail;
      }
      throw new AppError("CONFLICT", "Duplicate check-in for stop", 409);
    }

    this.seq += 1;
    const visitId = `70000000-0000-4000-8000-0000000000${this.seq}`;
    const visit: Visit = {
      id: visitId,
      orgId: params.orgId,
      tripStopId: params.tripStopId,
      employeeUserId: params.employeeUserId,
      checkedInAt: params.checkedInAt,
      checkedOutAt: null,
      checkInLocation: params.location,
      checkOutLocation: {
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        status: "unavailable",
        verificationNotice: "unverified_device_reported",
        limitationExplanation: null,
      },
      checkInIdempotencyKey: params.idempotencyKey,
      checkOutIdempotencyKey: null,
      notes: "",
      status: "in_progress",
      createdAt: params.checkedInAt,
      updatedAt: params.checkedInAt,
    };
    this.visits.push(visit);

    const defaultChecklist: VisitChecklistItem[] = [
      {
        id: `80000000-0000-4000-8000-000000000${this.seq}1`,
        orgId: params.orgId,
        visitId,
        questionKey: "shelf_planogram_compliant",
        label: "Primary shelf display matches current planogram",
        answerType: "boolean",
        answerValue: null,
        answerText: null,
        flagged: false,
        required: true,
        completedAt: null,
        completedBy: null,
        createdAt: params.checkedInAt,
        updatedAt: params.checkedInAt,
      },
      {
        id: `80000000-0000-4000-8000-000000000${this.seq}2`,
        orgId: params.orgId,
        visitId,
        questionKey: "promo_signage_visible",
        label: "Promotional signage is visible",
        answerType: "boolean",
        answerValue: null,
        answerText: null,
        flagged: false,
        required: true,
        completedAt: null,
        completedBy: null,
        createdAt: params.checkedInAt,
        updatedAt: params.checkedInAt,
      },
    ];
    this.checklistItems.push(...defaultChecklist);

    return { visit, checklistItems: defaultChecklist, evidence: [] };
  }

  async updateVisitExecution(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    notes?: string;
    checklistItems: readonly ChecklistAnswerItemInput[];
    nowIso: string;
  }): Promise<VisitDetail> {
    const visit = this.visits.find(
      (v) =>
        v.orgId === params.orgId &&
        v.id === params.visitId &&
        v.employeeUserId === params.employeeUserId &&
        v.status === "in_progress"
    );
    if (!visit) {
      throw new AppError("CONFLICT", "Visit is not editable", 409);
    }

    if (params.notes !== undefined) {
      visit.notes = params.notes;
    }
    visit.updatedAt = params.nowIso;

    for (const item of params.checklistItems) {
      const existingItem = this.checklistItems.find(
        (c) =>
          c.orgId === params.orgId &&
          c.visitId === params.visitId &&
          c.questionKey === item.questionKey
      );
      if (existingItem) {
        existingItem.answerValue = item.answerValue;
        existingItem.answerText = item.answerText ?? null;
        if (item.flagged !== undefined) existingItem.flagged = item.flagged;
        existingItem.completedAt = item.completed ? params.nowIso : null;
        existingItem.completedBy = item.completed ? params.employeeUserId : null;
        existingItem.updatedAt = params.nowIso;
      } else {
        this.seq += 1;
        this.checklistItems.push({
          id: `80000000-0000-4000-8000-0000000000${this.seq}`,
          orgId: params.orgId,
          visitId: params.visitId,
          questionKey: item.questionKey,
          label: item.label ?? item.questionKey,
          answerType: item.answerType ?? "boolean",
          answerValue: item.answerValue,
          answerText: item.answerText ?? null,
          flagged: item.flagged ?? false,
          required: item.required ?? true,
          completedAt: item.completed ? params.nowIso : null,
          completedBy: item.completed ? params.employeeUserId : null,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        });
      }
    }

    const detail = await this.getVisitDetail(params.orgId, params.visitId);
    if (!detail) throw new Error("Missing visit detail");
    return detail;
  }

  async createSignedEvidenceUploadTicket(params: {
    orgId: string;
    visitId: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
  }): Promise<SignedEvidenceUploadTicket> {
    this.seq += 1;
    const randomUuid = `99999999-0000-4000-8000-0000000000${this.seq}`;
    const storagePath = generateSafeEvidenceObjectPath({
      orgId: params.orgId,
      visitId: params.visitId,
      mimeType: params.fileType,
      randomId: randomUuid,
    });

    return {
      bucket: EVIDENCE_STORAGE_BUCKET,
      storagePath,
      signedUploadUrl: `https://storage.local/upload/${storagePath}?token=tok-${this.seq}`,
      token: `tok-${this.seq}`,
      expiresInSeconds: 300,
      maxBytes: MAX_EVIDENCE_FILE_SIZE_BYTES,
      allowedMimeType: params.fileType,
    };
  }

  async verifyStorageObjectUploaded(params: {
    orgId: string;
    visitId: string;
    storagePath: string;
  }): Promise<boolean> {
    return (
      params.storagePath.startsWith(`${params.orgId}/${params.visitId}/`) &&
      this.uploadedStorageObjects.has(params.storagePath)
    );
  }

  async recordConfirmedEvidence(params: {
    orgId: string;
    visitId: string;
    uploadedBy: string;
    storagePath: string;
    fileType: AllowedEvidenceMimeType;
    fileSize: number;
    caption: string;
    idempotencyKey: string | null;
  }): Promise<VisitEvidence> {
    if (params.idempotencyKey) {
      const existing = this.evidence.find(
        (e) =>
          e.orgId === params.orgId &&
          e.visitId === params.visitId &&
          e.idempotencyKey === params.idempotencyKey
      );
      if (existing) {
        return existing;
      }
    }

    this.seq += 1;
    const created: VisitEvidence = {
      id: `90000000-0000-4000-8000-0000000000${this.seq}`,
      orgId: params.orgId,
      visitId: params.visitId,
      storagePath: params.storagePath,
      fileType: params.fileType,
      fileSize: params.fileSize,
      caption: params.caption,
      uploadedBy: params.uploadedBy,
      idempotencyKey: params.idempotencyKey,
      createdAt: "2026-10-22T14:00:00.000Z",
    };
    this.evidence.push(created);
    return created;
  }

  async createSignedEvidenceDownloadUrl(params: {
    orgId: string;
    visitId: string;
    evidenceId: string;
    expiresInSeconds?: number;
  }): Promise<SignedEvidenceDownloadUrl> {
    const ev = this.evidence.find(
      (e) =>
        e.orgId === params.orgId &&
        e.visitId === params.visitId &&
        e.id === params.evidenceId
    );
    if (!ev) {
      throw new AppError("NOT_FOUND", "Evidence not found", 404);
    }

    return {
      evidenceId: ev.id,
      storagePath: ev.storagePath,
      signedDownloadUrl: `https://storage.local/download/${ev.storagePath}?sig=signed-${ev.id}`,
      expiresInSeconds: params.expiresInSeconds ?? 120,
    };
  }

  async checkOutVisitAtomic(params: {
    orgId: string;
    visitId: string;
    employeeUserId: string;
    checkedOutAt: string;
    notes?: string;
    idempotencyKey: string | null;
    location: UnverifiedDeviceLocation;
  }): Promise<VisitDetail> {
    const visit = this.visits.find(
      (v) => v.orgId === params.orgId && v.id === params.visitId
    );
    if (!visit) {
      throw new AppError("NOT_FOUND", "Visit not found", 404);
    }

    if (
      visit.status === "submitted" &&
      params.idempotencyKey &&
      visit.checkOutIdempotencyKey === params.idempotencyKey
    ) {
      const detail = await this.getVisitDetail(params.orgId, params.visitId);
      if (!detail) throw new Error("Missing detail");
      return detail;
    }

    if (visit.status !== "in_progress") {
      throw new AppError("CONFLICT", "Visit already checked out", 409);
    }

    visit.status = "submitted";
    visit.checkedOutAt = params.checkedOutAt;
    if (params.notes !== undefined) {
      visit.notes = params.notes;
    }
    visit.checkOutLocation = params.location;
    visit.checkOutIdempotencyKey = params.idempotencyKey;
    visit.updatedAt = params.checkedOutAt;

    const stop = this.stops.find(
      (s) => s.orgId === params.orgId && s.id === visit.tripStopId
    );
    if (stop) {
      stop.status = "visited";
    }

    const detail = await this.getVisitDetail(params.orgId, params.visitId);
    if (!detail) throw new Error("Missing detail");
    return detail;
  }

  async recordGeofenceEvent(
    params: RecordGeofenceEventParams
  ): Promise<VisitGeofenceEvent> {
    return {
      id: "mock-ge",
      orgId: params.orgId,
      tripId: params.tripId,
      tripStopId: params.tripStopId,
      storeId: params.storeId,
      employeeUserId: params.employeeUserId,
      visitId: params.visitId,
      eventType: params.eventType,
      clientEventId: params.clientEventId,
      deviceRecordedAt: params.deviceRecordedAt,
      serverReceivedAt: params.serverReceivedAt,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters,
      geofenceRadiusMeters: params.geofenceRadiusMeters,
      dwellTimeSeconds: params.dwellTimeSeconds,
      status: params.status,
      rejectionReason: params.rejectionReason,
      createdAt: new Date().toISOString(),
    };
  }

  async getGeofenceEventByClientId(
    _orgId: string,
    _clientEventId: string
  ): Promise<VisitGeofenceEvent | null> {
    return null;
  }
}

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const MANAGER_A: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "marcus.manager@acme.local",
};
const EMPLOYEE_A1: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "fiona.field@acme.local",
};
const EMPLOYEE_A2: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000004",
  email: "evan.field@acme.local",
};
const MANAGER_B: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000005",
  email: "brenda.manager@beta.local",
};

const APPROVED_TRIP_A_ID = "50000000-0000-4000-8000-000000000004";
const DRAFT_TRIP_A_ID = "50000000-0000-4000-8000-000000000001";

const STOP_APPROVED_1_ID = "60000000-0000-4000-8000-000000000003";
const STOP_APPROVED_2_ID = "60000000-0000-4000-8000-000000000004";
const STOP_DRAFT_ID = "60000000-0000-4000-8000-000000000001";

function setupVisitFixtures() {
  const tenancyRepository = new InMemoryTenancyRepo();
  const visitsRepository = new InMemoryVisitsRepo();

  tenancyRepository.organizations.push(
    {
      id: ORG_A_ID,
      name: "Acme Retail North",
      slug: "acme-retail-north",
      status: "active",
      createdBy: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: ORG_B_ID,
      name: "Beta FMCG South",
      slug: "beta-fmcg-south",
      status: "active",
      createdBy: MANAGER_B.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    }
  );

  tenancyRepository.memberships.push(
    {
      id: "30000000-0000-4000-8000-000000000002",
      orgId: ORG_A_ID,
      userId: MANAGER_A.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_A1.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      orgId: ORG_A_ID,
      userId: EMPLOYEE_A2.id,
      role: "field_employee",
      status: "active",
      managerUserId: MANAGER_A.id,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      orgId: ORG_B_ID,
      userId: MANAGER_B.id,
      role: "manager",
      status: "active",
      managerUserId: null,
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    }
  );

  visitsRepository.trips.push(
    {
      id: APPROVED_TRIP_A_ID,
      orgId: ORG_A_ID,
      ownerUserId: EMPLOYEE_A1.id,
      title: "Approved North-East Store Execution",
      startDate: "2026-10-22",
      endDate: "2026-10-23",
      purpose: "Shelf compliance check",
      status: "approved",
      submittedAt: "2026-10-21T15:00:00.000Z",
      decidedBy: MANAGER_A.id,
      decidedAt: "2026-10-21T16:00:00.000Z",
      decisionNote: "Approved",
      createdAt: "2026-10-21T14:00:00.000Z",
      updatedAt: "2026-10-21T16:00:00.000Z",
    },
    {
      id: DRAFT_TRIP_A_ID,
      orgId: ORG_A_ID,
      ownerUserId: EMPLOYEE_A1.id,
      title: "Draft Trip Not Yet Approved",
      startDate: "2026-10-25",
      endDate: "2026-10-26",
      purpose: "Draft trip",
      status: "draft",
      submittedAt: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: "2026-10-21T14:00:00.000Z",
      updatedAt: "2026-10-21T14:00:00.000Z",
    }
  );

  visitsRepository.stops.push(
    {
      id: STOP_APPROVED_1_ID,
      orgId: ORG_A_ID,
      tripId: APPROVED_TRIP_A_ID,
      storeId: "40000000-0000-4000-8000-000000000002",
      sequenceNumber: 1,
      plannedAt: "2026-10-22T09:00:00.000Z",
      status: "planned",
      createdAt: "2026-10-21T14:00:00.000Z",
      updatedAt: "2026-10-21T14:00:00.000Z",
    },
    {
      id: STOP_APPROVED_2_ID,
      orgId: ORG_A_ID,
      tripId: APPROVED_TRIP_A_ID,
      storeId: "40000000-0000-4000-8000-000000000001",
      sequenceNumber: 2,
      plannedAt: "2026-10-22T11:00:00.000Z",
      status: "planned",
      createdAt: "2026-10-21T14:00:00.000Z",
      updatedAt: "2026-10-21T14:00:00.000Z",
    },
    {
      id: STOP_DRAFT_ID,
      orgId: ORG_A_ID,
      tripId: DRAFT_TRIP_A_ID,
      storeId: "40000000-0000-4000-8000-000000000001",
      sequenceNumber: 1,
      plannedAt: "2026-10-25T09:30:00.000Z",
      status: "planned",
      createdAt: "2026-10-21T14:00:00.000Z",
      updatedAt: "2026-10-21T14:00:00.000Z",
    }
  );

  return { tenancyRepository, visitsRepository };
}

describe("Visit Execution: location permission policies, duplicate check-in, state transitions, and authorization", () => {
  it("handles granted unverified coordinates, denied location permission (with explanation under default policy), and strict require_location policy", async () => {
    const { tenancyRepository, visitsRepository } = setupVisitFixtures();

    // 1. When policy is 'require_location', denied location permission is blocked with a clear 400 error
    await expect(
      checkInStopForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          tripStopId: STOP_APPROVED_1_ID,
          location: { status: "permission_denied" },
        },
        locationPolicy: "require_location",
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    // 2. Under default policy ('allow_without_location_with_explanation'), denied location permission is allowed and explicitly recorded as 'permission_denied' with limitation explanation
    const checkedInDeniedLocation = await checkInStopForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        tripStopId: STOP_APPROVED_1_ID,
        idempotencyKey: "checkin-stop1-key01",
        location: { status: "permission_denied" },
      },
      tenancyRepository,
      visitsRepository,
      now: new Date("2026-10-22T09:05:00.000Z"),
    });

    expect(checkedInDeniedLocation.visit.status).toBe("in_progress");
    expect(checkedInDeniedLocation.visit.checkedInAt).toBe("2026-10-22T09:05:00.000Z");
    expect(checkedInDeniedLocation.visit.checkInLocation).toMatchObject({
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      status: "permission_denied",
      verificationNotice: "unverified_device_reported",
    });
    expect(checkedInDeniedLocation.visit.checkInLocation.limitationExplanation).toContain(
      "permission was denied"
    );

    // 3. Complete required checklist items and check out with unverified device-reported coordinates & accuracy
    await updateVisitExecutionForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: checkedInDeniedLocation.visit.id,
      rawInput: {
        notes: "Completed shelf audit and restocked cooler",
        checklistItems: [
          {
            questionKey: "shelf_planogram_compliant",
            answerValue: true,
            completed: true,
          },
          {
            questionKey: "promo_signage_visible",
            answerValue: true,
            completed: true,
          },
        ],
      },
      tenancyRepository,
      visitsRepository,
    });

    const checkedOut = await checkOutVisitForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: checkedInDeniedLocation.visit.id,
      rawInput: {
        idempotencyKey: "checkout-stop1-key01",
        location: {
          latitude: 41.8975,
          longitude: -87.6196,
          accuracyMeters: 12.4,
          status: "captured_unverified",
        },
      },
      tenancyRepository,
      visitsRepository,
      now: new Date("2026-10-22T09:45:00.000Z"),
    });

    expect(checkedOut.visit.status).toBe("submitted");
    expect(checkedOut.visit.checkedOutAt).toBe("2026-10-22T09:45:00.000Z");
    expect(checkedOut.visit.checkOutLocation).toMatchObject({
      latitude: 41.8975,
      longitude: -87.6196,
      accuracyMeters: 12.4,
      status: "captured_unverified",
      verificationNotice: "unverified_device_reported",
    });
  });

  it("prevents impossible transitions: check-in on non-approved trip, duplicate check-in, concurrent active visits, checkout with incomplete required checklist, and edits by another employee", async () => {
    const { tenancyRepository, visitsRepository } = setupVisitFixtures();

    // 1. Cannot check in to a stop belonging to a non-approved ('draft') trip
    await expect(
      checkInStopForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: { tripStopId: STOP_DRAFT_ID },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 2. Another employee (EMPLOYEE_A2) cannot check in to EMPLOYEE_A1's planned stop
    await expect(
      checkInStopForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        rawInput: { tripStopId: STOP_APPROVED_1_ID },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 3. Employee A1 checks in to Stop #1 with idempotency key
    const visit1 = await checkInStopForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        tripStopId: STOP_APPROVED_1_ID,
        idempotencyKey: "idem-checkin-stop1",
      },
      tenancyRepository,
      visitsRepository,
    });

    // 4. Retrying check-in with the SAME idempotencyKey returns the existing visit safely
    const retriedVisit1 = await checkInStopForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: {
        tripStopId: STOP_APPROVED_1_ID,
        idempotencyKey: "idem-checkin-stop1",
      },
      tenancyRepository,
      visitsRepository,
    });
    expect(retriedVisit1.visit.id).toBe(visit1.visit.id);

    // 5. Duplicate check-in without matching idempotencyKey is rejected with 409 CONFLICT
    await expect(
      checkInStopForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: {
          tripStopId: STOP_APPROVED_1_ID,
          idempotencyKey: "different-checkin-key",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 6. Concurrent active visit on Stop #2 while Stop #1 is still 'in_progress' is rejected with 409 CONFLICT
    await expect(
      checkInStopForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        rawInput: { tripStopId: STOP_APPROVED_2_ID },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // 7. Another employee (EMPLOYEE_A2) or manager (MANAGER_A) cannot edit or check out EMPLOYEE_A1's visit
    await expect(
      updateVisitExecutionForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visit1.visit.id,
        rawInput: { notes: "Tampering attempt by peer" },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      checkOutVisitForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visit1.visit.id,
        rawInput: {},
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    // 8. Cannot check out while required checklist items are still incomplete
    await expect(
      checkOutVisitForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visit1.visit.id,
        rawInput: {},
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    // 9. Complete required items and check out; retrying check-out with same idempotencyKey succeeds idempotently, while a second check-out with a different key is rejected with 409 CONFLICT
    await updateVisitExecutionForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visit1.visit.id,
      rawInput: {
        checklistItems: [
          {
            questionKey: "shelf_planogram_compliant",
            answerValue: true,
            completed: true,
          },
          {
            questionKey: "promo_signage_visible",
            answerValue: true,
            completed: true,
          },
        ],
      },
      tenancyRepository,
      visitsRepository,
    });

    const checkedOut = await checkOutVisitForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visit1.visit.id,
      rawInput: { idempotencyKey: "idem-checkout-stop1" },
      tenancyRepository,
      visitsRepository,
    });
    expect(checkedOut.visit.status).toBe("submitted");

    const idempotentCheckout = await checkOutVisitForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visit1.visit.id,
      rawInput: { idempotencyKey: "idem-checkout-stop1" },
      tenancyRepository,
      visitsRepository,
    });
    expect(idempotentCheckout.visit.id).toBe(visit1.visit.id);

    await expect(
      checkOutVisitForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visit1.visit.id,
        rawInput: { idempotencyKey: "second-checkout-attempt" },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    // Editing a submitted visit is rejected with 409 CONFLICT
    await expect(
      updateVisitExecutionForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visit1.visit.id,
        rawInput: { notes: "Post-checkout edit attempt" },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("enforces private evidence security: blocks malicious file types, oversized files, client-spoofed storage paths, cross-tenant file access, and upload failures without marking evidence as uploaded", async () => {
    const { tenancyRepository, visitsRepository } = setupVisitFixtures();

    const visitDetail = await checkInStopForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawInput: { tripStopId: STOP_APPROVED_1_ID },
      tenancyRepository,
      visitsRepository,
    });
    const visitId = visitDetail.visit.id;

    // 1. Rejects malicious MIME types (e.g. text/html, image/svg+xml, application/javascript)
    await expect(
      requestEvidenceUploadTicketForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          fileType: "image/svg+xml",
          fileSize: 1024,
          originalFileName: "xss.svg",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 2. Rejects disguised executable/script filename extension even when MIME type claims to be image/jpeg
    await expect(
      requestEvidenceUploadTicketForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          fileType: "image/jpeg",
          fileSize: 2048,
          originalFileName: "payload.exe",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 3. Rejects oversized file (> 25 MiB)
    await expect(
      requestEvidenceUploadTicketForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          fileType: "image/png",
          fileSize: MAX_EVIDENCE_FILE_SIZE_BYTES + 1,
          originalFileName: "huge.png",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toHaveProperty("name", "ZodError");

    // 4. Valid upload ticket generates a server-controlled randomized object path `<orgId>/<visitId>/<uuid>.jpg`
    const ticket = await requestEvidenceUploadTicketForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visitId,
      rawInput: {
        fileType: "image/jpeg",
        fileSize: 350_000,
        originalFileName: "endcap-display.jpg",
      },
      tenancyRepository,
      visitsRepository,
    });
    expect(ticket.storagePath).toMatch(
      new RegExp(`^${ORG_A_ID}/${visitId}/[0-9a-f-]{36}\\.jpg$`)
    );

    // 5. Rejects client-supplied storage path spoofing (e.g. another org prefix, path traversal, or custom filename)
    await expect(
      confirmEvidenceUploadForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          storagePath: `${ORG_B_ID}/${visitId}/99999999-0000-4000-8000-000000000099.jpg`,
          fileType: "image/jpeg",
          fileSize: 350_000,
          caption: "Cross-tenant path spoof attempt",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    await expect(
      confirmEvidenceUploadForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          storagePath: `${ORG_A_ID}/${visitId}/custom-unrandomized-name.jpg`,
          fileType: "image/jpeg",
          fileSize: 350_000,
          caption: "Client-chosen filename attempt",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });

    // 6. Upload failure handling: if the object upload to storage failed (object does not exist in bucket),
    //    `confirmEvidenceUploadForOrg` fails with 409 CONFLICT and does NOT mark the evidence as uploaded!
    await expect(
      confirmEvidenceUploadForOrg({
        user: EMPLOYEE_A1,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        rawInput: {
          storagePath: ticket.storagePath,
          fileType: "image/jpeg",
          fileSize: 350_000,
          caption: "Photo when storage upload failed",
          idempotencyKey: "idem-evidence-upload-01",
        },
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    const afterFailedUpload = await getVisitDetailForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visitId,
      tenancyRepository,
      visitsRepository,
    });
    expect(afterFailedUpload.evidence).toHaveLength(0);

    // 7. After retrying the storage upload so the object exists in storage, confirmation succeeds idempotently
    visitsRepository.uploadedStorageObjects.add(ticket.storagePath);

    const confirmedEvidence = await confirmEvidenceUploadForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visitId,
      rawInput: {
        storagePath: ticket.storagePath,
        fileType: "image/jpeg",
        fileSize: 350_000,
        caption: "Front view of cooler endcap",
        idempotencyKey: "idem-evidence-upload-01",
      },
      tenancyRepository,
      visitsRepository,
    });
    expect(confirmedEvidence.storagePath).toBe(ticket.storagePath);

    // Retrying confirmation with the same idempotencyKey does not create a duplicate evidence row
    const duplicateConfirmAttempt = await confirmEvidenceUploadForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visitId,
      rawInput: {
        storagePath: ticket.storagePath,
        fileType: "image/jpeg",
        fileSize: 350_000,
        caption: "Front view of cooler endcap",
        idempotencyKey: "idem-evidence-upload-01",
      },
      tenancyRepository,
      visitsRepository,
    });
    expect(duplicateConfirmAttempt.id).toBe(confirmedEvidence.id);

    // 8. Signed download URL authorization:
    //    - Visit owner (EMPLOYEE_A1) and Org A Manager (MANAGER_A) can obtain a short-lived signed download URL
    //    - Another field employee (EMPLOYEE_A2) is denied with 403 FORBIDDEN_INSUFFICIENT_ROLE
    //    - Cross-tenant user (MANAGER_B in Org B) receives 404 NOT_FOUND
    const managerSignedUrl = await getSignedEvidenceDownloadUrlForOrg({
      user: MANAGER_A,
      candidateOrgId: ORG_A_ID,
      candidateVisitId: visitId,
      candidateEvidenceId: confirmedEvidence.id,
      tenancyRepository,
      visitsRepository,
    });
    expect(managerSignedUrl.signedDownloadUrl).toContain(ticket.storagePath);

    await expect(
      getSignedEvidenceDownloadUrlForOrg({
        user: EMPLOYEE_A2,
        candidateOrgId: ORG_A_ID,
        candidateVisitId: visitId,
        candidateEvidenceId: confirmedEvidence.id,
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      status: 403,
    });

    await expect(
      getSignedEvidenceDownloadUrlForOrg({
        user: MANAGER_B,
        candidateOrgId: ORG_B_ID,
        candidateVisitId: visitId,
        candidateEvidenceId: confirmedEvidence.id,
        tenancyRepository,
        visitsRepository,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    const employeeList = await listVisitsForOrg({
      user: EMPLOYEE_A1,
      candidateOrgId: ORG_A_ID,
      rawQuery: {},
      tenancyRepository,
      visitsRepository,
    });
    expect(employeeList.items).toHaveLength(1);
  });
});
