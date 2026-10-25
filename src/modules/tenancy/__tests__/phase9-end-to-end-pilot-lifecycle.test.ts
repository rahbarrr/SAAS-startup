import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  enqueueOfflineOperation,
  processOfflineSyncQueue,
} from "@/lib/offline/sync-queue";
import type { StorageLike } from "@/lib/offline/visit-draft-storage";
import { HeuristicIntelligenceProvider } from "@/modules/ai-intelligence/provider";

/**
 * FieldTrack — Phase 9: End-to-End Pilot Lifecycle Verification
 *
 * Validates the complete 13-step lifecycle against real PostgreSQL (PGlite)
 * with 100% of migrations, triggers, RLS policies, and service layers active.
 */

const ADMIN_ID = "11111111-1111-4111-8111-111111111101";
const MANAGER_ID = "11111111-1111-4111-8111-111111111102";
const REP_ID = "11111111-1111-4111-8111-111111111103";

describe("Phase 9: End-to-End Full User-Journey Pilot Validation (13 Steps)", () => {
  let db: PGlite;

  let orgId: string;
  let storeAId: string;
  let storeBId: string;
  let tripId: string;
  let stopAId: string;
  let stopBId: string;
  let visitAId: string;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Bootstrap minimal Supabase-compatible auth schema & roles
    await db.exec(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
      end
      $$;

      create schema if not exists auth;
      grant usage on schema auth to public, authenticated;
      grant usage on schema public to public, authenticated;

      create table if not exists auth.users (
        id uuid primary key,
        email text not null
      );

      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      grant execute on function auth.uid() to public, authenticated;
    `);

    // 2. Apply all versioned migrations in chronological order
    const dir = path.resolve(process.cwd(), "supabase/migrations");
    const migrationFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      await db.exec(sql);
    }

    // 3. Grant privileges to authenticated role
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
    `);

    // 4. Seed user identities into auth.users (this triggers automatic profile creation)
    await db.exec(`
      insert into auth.users (id, email) values
        ('${ADMIN_ID}', 'admin@summit-retail.test'),
        ('${MANAGER_ID}', 'monica.manager@summit-retail.test'),
        ('${REP_ID}', 'felix.rep@summit-retail.test');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  async function runAs<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await db.exec("begin;");
    try {
      await db.exec(`
        set local role authenticated;
        select set_config('request.jwt.claim.sub', '${userId}', true);
      `);
      const res = await fn();
      await db.exec("commit;");
      return res;
    } catch (err) {
      await db.exec("rollback;");
      throw err;
    }
  }

  function requireRow<T>(row: T | undefined, msg = "Expected row"): T {
    if (!row) throw new Error(msg);
    return row;
  }

  // --------------------------------------------------------------------------
  // Step 1: Organization administrator signs up and configures the workspace
  // --------------------------------------------------------------------------
  it("Step 1: Admin creates organization workspace and adds retail stores", async () => {
    const orgRes = await runAs(ADMIN_ID, async () => {
      const res = await db.query<{ id: string; name: string; slug: string }>(
        `select id, name, slug from public.create_organization_with_owner($1, $2)`,
        ["Summit Retail Group", "summit-retail"]
      );
      return requireRow(res.rows[0]);
    });

    expect(orgRes.name).toBe("Summit Retail Group");
    expect(orgRes.slug).toBe("summit-retail");
    orgId = orgRes.id;

    // Verify admin membership in organization_members
    const adminMember = await db.query<{ role: string; status: string }>(
      `select role, status from public.organization_members where organization_id = $1 and user_id = $2`,
      [orgId, ADMIN_ID]
    );
    expect(requireRow(adminMember.rows[0])).toEqual({ role: "admin", status: "active" });

    // Admin adds two stores to directory
    const storeARes = await runAs(ADMIN_ID, async () => {
      const res = await db.query<{ id: string; name: string }>(
        `insert into public.stores (
           organization_id, name, region, address_line1, city, state_province,
           postal_code, country_code, latitude, longitude, active
         ) values (
           $1, 'Summit North Supercenter', 'North', '101 Summit Blvd', 'Minneapolis', 'MN',
           '55401', 'US', 44.9778, -93.2650, true
         ) returning id, name`,
        [orgId]
      );
      return requireRow(res.rows[0]);
    });
    storeAId = storeARes.id;

    const storeBRes = await runAs(ADMIN_ID, async () => {
      const res = await db.query<{ id: string; name: string }>(
        `insert into public.stores (
           organization_id, name, region, address_line1, city, state_province,
           postal_code, country_code, latitude, longitude, active
         ) values (
           $1, 'Summit South Plaza', 'South', '202 Valley Way', 'Bloomington', 'MN',
           '55420', 'US', 44.8408, -93.2983, true
         ) returning id, name`,
        [orgId]
      );
      return requireRow(res.rows[0]);
    });
    storeBId = storeBRes.id;

    expect(storeAId).toBeDefined();
    expect(storeBId).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Step 2: Administrator invites a manager and field representative
  // --------------------------------------------------------------------------
  it("Step 2: Admin invites manager and field representative, who accept invitations", async () => {
    const mgrTokenHash = "1".repeat(64);
    const repTokenHash = "2".repeat(64);

    // Admin creates invitations
    await runAs(ADMIN_ID, async () => {
      await db.query(
        `insert into public.organization_invitations (
           organization_id, invited_email, role, token_hash, invited_by, expires_at
         ) values (
           $1, 'monica.manager@summit-retail.test', 'manager', $2, $3, now() + interval '48 hours'
         )`,
        [orgId, mgrTokenHash, ADMIN_ID]
      );

      await db.query(
        `insert into public.organization_invitations (
           organization_id, invited_email, role, token_hash, invited_by, expires_at
         ) values (
           $1, 'felix.rep@summit-retail.test', 'field_employee', $2, $3, now() + interval '48 hours'
         )`,
        [orgId, repTokenHash, ADMIN_ID]
      );
    });

    // Manager accepts invitation
    await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ organization_id: string; user_id: string; role: string; status: string }>(
        `select organization_id, user_id, role, status from public.accept_organization_invitation($1)`,
        [mgrTokenHash]
      );
      expect(requireRow(res.rows[0])).toEqual({
        organization_id: orgId,
        user_id: MANAGER_ID,
        role: "manager",
        status: "active",
      });
    });

    // Representative accepts invitation
    await runAs(REP_ID, async () => {
      const res = await db.query<{ organization_id: string; user_id: string; role: string; status: string }>(
        `select organization_id, user_id, role, status from public.accept_organization_invitation($1)`,
        [repTokenHash]
      );
      expect(requireRow(res.rows[0])).toEqual({
        organization_id: orgId,
        user_id: REP_ID,
        role: "field_employee",
        status: "active",
      });
    });

    // Verify memberships are both active in DB
    const members = await db.query<{ user_id: string; role: string; status: string }>(
      `select user_id, role, status from public.organization_members where organization_id = $1 order by user_id`,
      [orgId]
    );
    expect(members.rows).toHaveLength(3); // Admin, Manager, Rep
  });

  // --------------------------------------------------------------------------
  // Step 3: Trip creation with multiple store visits
  // --------------------------------------------------------------------------
  it("Step 3: Representative creates a multi-stop field trip and submits for manager review", async () => {
    const tripRes = await runAs(REP_ID, async () => {
      // Create trip draft
      const t = await db.query<{ id: string; status: string }>(
        `insert into public.trips (
           organization_id, owner_user_id, title, purpose, start_date, end_date, status
         ) values (
           $1, $2, 'Q4 Retail Display Audit',
           'Inspect endcap promotional compliance and verify cooler temps',
           '2026-11-01', '2026-11-02', 'draft'
         ) returning id, status`,
        [orgId, REP_ID]
      );
      const createdTrip = requireRow(t.rows[0]);

      // Add Stop 1 (Store A)
      const s1 = await db.query<{ id: string }>(
        `insert into public.trip_stops (
           organization_id, trip_id, store_id, sequence_number, planned_at, status
         ) values (
           $1, $2, $3, 1, '2026-11-01T09:00:00Z', 'planned'
         ) returning id`,
        [orgId, createdTrip.id, storeAId]
      );

      // Add Stop 2 (Store B)
      const s2 = await db.query<{ id: string }>(
        `insert into public.trip_stops (
           organization_id, trip_id, store_id, sequence_number, planned_at, status
         ) values (
           $1, $2, $3, 2, '2026-11-01T13:00:00Z', 'planned'
         ) returning id`,
        [orgId, createdTrip.id, storeBId]
      );

      // Submit trip for manager review
      await db.query(
        `update public.trips
            set status = 'submitted', submitted_at = clock_timestamp()
          where id = $1 and organization_id = $2`,
        [createdTrip.id, orgId]
      );

      // Record immutable audit event
      await db.query(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at
         ) values (
           $1, $2, $3, 'trip_submitted', 'draft', 'submitted', 'Submitted for manager review',
           '{"source": "web", "stop_count": 2}'::jsonb, clock_timestamp()
         )`,
        [orgId, createdTrip.id, REP_ID]
      );

      return {
        tripId: createdTrip.id,
        stopAId: requireRow(s1.rows[0]).id,
        stopBId: requireRow(s2.rows[0]).id,
      };
    });

    tripId = tripRes.tripId;
    stopAId = tripRes.stopAId;
    stopBId = tripRes.stopBId;

    const check = await db.query<{ status: string }>(
      `select status from public.trips where id = $1`,
      [tripId]
    );
    expect(requireRow(check.rows[0]).status).toBe("submitted");
  });

  // --------------------------------------------------------------------------
  // Step 4: Representative views assigned work
  // --------------------------------------------------------------------------
  it("Step 4: Representative views assigned work in their roster", async () => {
    const repTrips = await runAs(REP_ID, async () => {
      const res = await db.query<{ id: string; title: string; status: string }>(
        `select id, title, status from public.trips where organization_id = $1 and owner_user_id = $2`,
        [orgId, REP_ID]
      );
      return res.rows;
    });

    expect(repTrips).toHaveLength(1);
    expect(repTrips[0]?.title).toBe("Q4 Retail Display Audit");

    const stops = await runAs(REP_ID, async () => {
      const res = await db.query<{ id: string; store_id: string; sequence_number: number }>(
        `select id, store_id, sequence_number from public.trip_stops where trip_id = $1 order by sequence_number`,
        [tripId]
      );
      return res.rows;
    });
    expect(stops).toHaveLength(2);
    expect(stops[0]?.store_id).toBe(storeAId);
    expect(stops[1]?.store_id).toBe(storeBId);
  });

  // --------------------------------------------------------------------------
  // Step 5: Manager reviews and approves the trip
  // --------------------------------------------------------------------------
  it("Step 5: Manager reviews and approves the trip (blocking self-approval)", async () => {
    // Representative cannot approve their own trip
    await expect(
      runAs(REP_ID, async () => {
        await db.query(
          `select public.decide_submitted_trip($1, $2, 'approved', 'Self-approving')`,
          [orgId, tripId]
        );
      })
    ).rejects.toThrow();

    // Manager approves via atomic decision RPC
    await runAs(MANAGER_ID, async () => {
      await db.query(
        `select public.decide_submitted_trip(
           $1, $2, 'approved', 'Route approved for field execution',
           '{"source": "web", "stop_count": 2}'::jsonb
         )`,
        [orgId, tripId]
      );
    });

    const approvedTrip = await db.query<{ status: string; decided_by: string; decision_note: string }>(
      `select status, decided_by, decision_note from public.trips where id = $1`,
      [tripId]
    );
    const row = requireRow(approvedTrip.rows[0]);
    expect(row.status).toBe("approved");
    expect(row.decided_by).toBe(MANAGER_ID);
    expect(row.decision_note).toBe("Route approved for field execution");
  });

  // --------------------------------------------------------------------------
  // Step 6: Representative checks in to Store A, completes checklist & uploads evidence
  // --------------------------------------------------------------------------
  it("Step 6: Representative checks in to Store A, completes checklist, and records evidence", async () => {
    // Check-in via check_in_trip_stop RPC
    // Signature: (p_org_id, p_trip_stop_id, p_idempotency_key, p_lat, p_lng, p_accuracy_m, p_location_status)
    const checkinRes = await runAs(REP_ID, async () => {
      const res = await db.query<{
        id: string;
        status: string;
        check_in_location_status: string;
      }>(
        `select id, status, check_in_location_status
           from public.check_in_trip_stop(
             $1, $2, 'checkin-pilot-key-001',
             44.9778::double precision, -93.2650::double precision, 15.0::double precision,
             'captured_unverified'
           )`,
        [orgId, stopAId]
      );
      return requireRow(res.rows[0]);
    });

    expect(checkinRes.status).toBe("in_progress");
    expect(checkinRes.check_in_location_status).toBe("captured_unverified");
    visitAId = checkinRes.id;

    // Verify trip transitioned to in_progress
    const tripCheck = await db.query<{ status: string }>(
      `select status from public.trips where id = $1`,
      [tripId]
    );
    expect(requireRow(tripCheck.rows[0]).status).toBe("in_progress");

    // Complete all seeded required checklist items
    await runAs(REP_ID, async () => {
      await db.query(
        `update public.visit_checklist_items
            set answer_value = 'true'::jsonb,
                completed_at = clock_timestamp(),
                completed_by = $1
          where visit_id = $2`,
        [REP_ID, visitAId]
      );
    });

    // Representative uploads photo evidence with tenant-scoped storage path
    const evidencePath = `${orgId}/${visitAId}/endcap_front.jpg`;
    await runAs(REP_ID, async () => {
      await db.query(
        `insert into public.visit_evidence (
           organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by, idempotency_key
         ) values (
           $1, $2, $3, 'image/jpeg', 2048576, 'Front promotional endcap', $4, 'ev-pilot-001'
         )`,
        [orgId, visitAId, evidencePath, REP_ID]
      );
    });

    // Verify evidence record
    const evCheck = await db.query<{ storage_path: string }>(
      `select storage_path from public.visit_evidence where visit_id = $1`,
      [visitAId]
    );
    expect(requireRow(evCheck.rows[0]).storage_path).toBe(evidencePath);
  });

  // --------------------------------------------------------------------------
  // Step 7: Representative checks out and completes the visit
  // --------------------------------------------------------------------------
  it("Step 7: Representative checks out of Store A and submits visit record", async () => {
    // Signature: (p_org_id, p_visit_id, p_notes, p_idempotency_key, p_lat, p_lng, p_accuracy_m, p_location_status)
    const checkoutRes = await runAs(REP_ID, async () => {
      const res = await db.query<{
        id: string;
        status: string;
      }>(
        `select id, status
           from public.check_out_visit(
             $1, $2, 'All promotional signs aligned and cooler restocked',
             'checkout-pilot-key-001',
             44.9779::double precision, -93.2651::double precision, 12.5::double precision,
             'captured_unverified'
           )`,
        [orgId, visitAId]
      );
      return requireRow(res.rows[0]);
    });

    expect(checkoutRes.status).toBe("submitted");

    // Verify stop status transitioned to visited
    const stopCheck = await db.query<{ status: string }>(
      `select status from public.trip_stops where id = $1`,
      [stopAId]
    );
    expect(requireRow(stopCheck.rows[0]).status).toBe("visited");

    // Verify visit timestamps and notes
    const visitCheck = await db.query<{ checked_in_at: string; checked_out_at: string; notes: string }>(
      `select checked_in_at, checked_out_at, notes from public.visits where id = $1`,
      [visitAId]
    );
    const v = requireRow(visitCheck.rows[0]);
    expect(v.checked_in_at).not.toBeNull();
    expect(v.checked_out_at).not.toBeNull();
    expect(v.notes).toContain("All promotional signs aligned");
  });

  // --------------------------------------------------------------------------
  // Step 8: Manager reviews visit results and outstanding work
  // --------------------------------------------------------------------------
  it("Step 8: Manager reviews visit results and marks visit reviewed", async () => {
    // Representative cannot self-review submitted visit [SEC-002] (RLS yields 0 updated rows)
    const repUpdate = await runAs(REP_ID, async () => {
      return db.query(
        `update public.visits set status = 'reviewed' where id = $1 and organization_id = $2 returning id`,
        [visitAId, orgId]
      );
    });
    expect(repUpdate.rows).toHaveLength(0);

    // Manager reviews and signs off on visit
    await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ status: string }>(
        `update public.visits
            set status = 'reviewed'
          where id = $1 and organization_id = $2
          returning status`,
        [visitAId, orgId]
      );
      expect(res.rows[0]?.status).toBe("reviewed");
    });

    const reviewed = await db.query<{ status: string }>(
      `select status from public.visits where id = $1`,
      [visitAId]
    );
    const r = requireRow(reviewed.rows[0]);
    expect(r.status).toBe("reviewed");
  });

  // --------------------------------------------------------------------------
  // Step 9: Reports and territory analytics reflect the resulting data
  // --------------------------------------------------------------------------
  it("Step 9: Reports and territory analytics reflect the completed visit metrics", async () => {
    const reportData = await runAs(MANAGER_ID, async () => {
      const visits = await db.query<{ id: string; status: string; store_name: string }>(
        `select v.id, v.status, s.name as store_name
           from public.visits v
           join public.trip_stops ts on ts.id = v.trip_stop_id
           join public.stores s on s.id = ts.store_id
          where v.organization_id = $1`,
        [orgId]
      );
      const stops = await db.query<{ status: string }>(
        `select status from public.trip_stops where organization_id = $1`,
        [orgId]
      );
      return { visits: visits.rows, stops: stops.rows };
    });

    expect(reportData.visits).toHaveLength(1);
    expect(reportData.visits[0]?.status).toBe("reviewed");
    expect(reportData.visits[0]?.store_name).toBe("Summit North Supercenter");

    // 1 completed/visited stop (Store A) and 1 planned stop (Store B)
    const visitedStops = reportData.stops.filter((s) => s.status === "visited");
    const plannedStops = reportData.stops.filter((s) => s.status === "planned");
    expect(visitedStops).toHaveLength(1);
    expect(plannedStops).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // Step 10: Audit history records relevant actions immutably
  // --------------------------------------------------------------------------
  it("Step 10: Audit history records all lifecycle actions immutably", async () => {
    const auditLogs = await db.query<{
      event_type: string;
      old_status: string | null;
      new_status: string | null;
    }>(
      `select event_type, old_status, new_status
         from public.trip_audit_events
        where organization_id = $1 and trip_id = $2
        order by created_at asc`,
      [orgId, tripId]
    );

    const eventTypes = auditLogs.rows.map((r) => r.event_type);
    expect(eventTypes).toContain("trip_submitted");
    expect(eventTypes).toContain("trip_approved");

    // Verify immutability: UPDATE on trip_audit_events is rejected
    await expect(
      db.query(
        `update public.trip_audit_events set note = 'Tampered' where organization_id = $1`,
        [orgId]
      )
    ).rejects.toThrow(/append-only/);
  });

  // --------------------------------------------------------------------------
  // Step 11: AI trip planning and daily briefing use appropriate organization data
  // --------------------------------------------------------------------------
  it("Step 11: AI trip planning and manager briefing analyze active organization records", async () => {
    const provider = new HeuristicIntelligenceProvider();

    // AI Planning Assistant analyzing the trip
    const planInsights = await provider.generateTripPlanningInsights({
      tripId,
      title: "Q4 Retail Display Audit",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      assignedRepUserId: REP_ID,
      assignedRepName: "Felix Rep",
      stops: [
        {
          stopId: stopAId,
          storeId: storeAId,
          storeName: "Summit North Supercenter",
          city: "Minneapolis",
          plannedAt: "2026-11-01T09:00:00Z",
          hasCoordinates: true,
          sequenceNumber: 1,
        },
        {
          stopId: stopBId,
          storeId: storeBId,
          storeName: "Summit South Plaza",
          city: "Bloomington",
          plannedAt: "2026-11-01T13:00:00Z",
          hasCoordinates: true,
          sequenceNumber: 2,
        },
      ],
      otherRepTripsOnSameDates: [],
      routeOptimization: {
        distanceSavingsMeters: 4200,
        durationSavingsMinutes: 12,
        isReordered: true,
        proposedOrder: [],
      },
    });

    expect(planInsights.workloadStatus).toBeDefined();
    expect(planInsights.workloadNote).toContain("2 store stop(s)");
    expect(planInsights.recommendations.length).toBeGreaterThanOrEqual(1);

    // Manager Daily Briefing
    const briefing = await provider.generateManagerDailyBriefing({
      briefingDate: "2026-11-01",
      metrics: {
        tripsScheduledToday: 1,
        visitsScheduledToday: 2,
        completedVisitsCount: 1,
        overdueVisitsCount: 0,
        pendingApprovalsCount: 1,
        missingEvidenceCount: 0,
        unfinishedChecklistsCount: 0,
      },
      tripsToday: [
        {
          id: tripId,
          title: "Q4 Retail Display Audit",
          ownerName: "Felix Rep",
          status: "in_progress",
          stopsCount: 2,
        },
      ],
      pendingApprovals: [
        {
          id: "trip-pilot-pending-02",
          title: "Twin Cities Cooler Compliance Route",
          ownerName: "Felix Rep",
          submittedAt: "2026-11-01T08:00:00Z",
        },
      ],
      overdueVisits: [],
      missingEvidenceVisits: [],
      repWorkloads: [],
      hasSufficientData: true,
    });

    expect(briefing.summaryHeadline).toBeDefined();
    expect(briefing.recommendedActions.length).toBeGreaterThan(0);
    expect(briefing.criticalExceptions.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Step 12: Manager reviews and acts on AI recommendations
  // --------------------------------------------------------------------------
  it("Step 12: Manager acts on AI recommendations and logs decision", async () => {
    // Record action decision in organization audit trail
    const auditRes = await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ id: string; action_type: string }>(
        `insert into public.organization_audit_events (
           organization_id, actor_user_id, actor_role, action_type,
           entity_type, entity_id, reason, metadata
         ) values (
           $1, $2, 'manager', 'ai.briefing_action_updated',
           'ai_action', 'act-pilot-001', 'Manager accepted route adjustment',
           '{"status": "accepted", "actionId": "act-pilot-001"}'::jsonb
         ) returning id, action_type`,
        [orgId, MANAGER_ID]
      );
      return requireRow(res.rows[0]);
    });

    expect(auditRes.action_type).toBe("ai.briefing_action_updated");
  });

  // --------------------------------------------------------------------------
  // Step 13: Offline changes synchronize correctly after connectivity returns
  // --------------------------------------------------------------------------
  it("Step 13: Offline changes queue and synchronize idempotently without duplicate inserts", async () => {
    const memoryStore: Record<string, string> = {};
    const mockStorage: StorageLike = {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value;
      },
      removeItem: (key: string) => {
        Reflect.deleteProperty(memoryStore, key);
      },
      get length() {
        return Object.keys(memoryStore).length;
      },
      key: (index: number) => Object.keys(memoryStore)[index] ?? null,
    };

    // 1. Enqueue offline checklist completion while offline
    const op = enqueueOfflineOperation({
      input: {
        orgId,
        userId: REP_ID,
        targetId: visitAId,
        operationType: "save_checklist",
        idempotencyKey: "offline-checklist-sync-001",
        payload: {
          visitId: visitAId,
          completedAt: new Date().toISOString(),
          notes: "Synchronized offline inspection data",
        },
      },
      storage: mockStorage,
    });

    expect(op.status).toBe("pending");
    expect(op.idempotencyKey).toBe("offline-checklist-sync-001");

    // 2. Process sync queue with simulated executor
    let executionCount = 0;
    const syncResult = await processOfflineSyncQueue({
      orgId,
      userId: REP_ID,
      storage: mockStorage,
      executor: async (queuedOp) => {
        executionCount++;
        // Simulate successful server update
        return { success: true, serverResponse: { updated: true, id: queuedOp.targetId } };
      },
    });

    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.failedCount).toBe(0);
    expect(executionCount).toBe(1);

    // 3. Retry sync to verify duplicate sync prevention & idempotency
    const retrySyncResult = await processOfflineSyncQueue({
      orgId,
      userId: REP_ID,
      storage: mockStorage,
      executor: async () => {
        executionCount++;
        return { success: true };
      },
    });

    // No pending operations left to process!
    expect(retrySyncResult.syncedCount).toBe(0);
    expect(executionCount).toBe(1); // Not called again
  });
});

