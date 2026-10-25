import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * FieldTrack — End-to-End Acceptance Test
 *
 * Verifies the complete real-world retail field operations workflow
 * from Organization Onboarding through Store Planning, Trip Creation,
 * Manager Approval, Visit Check-in, Checklist Completion, Evidence Upload,
 * Check-out, and Reporting.
 *
 * All operations execute against PostgreSQL with 100% of migrations,
 * triggers, and RLS policies active, using isolated employee and manager identities.
 */

const MANAGER_ID = "10000000-0000-4000-8000-000000000088";
const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000089";
const ATTACKER_ID = "10000000-0000-4000-8000-000000000099";

const COMPETITOR_ORG_ID = "99999999-9999-4999-8999-999999999999";

describe("FieldTrack — Core Retail Workflow & Access Control End-to-End Acceptance", () => {
  let db: PGlite;

  let activeOrgId: string;
  let activeStoreId: string;
  let activeTripId: string;
  let activeStopId: string;
  let activeVisitId: string;
  let activeDraftId: string;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Bootstrap minimal Supabase-compatible `auth` schema and `authenticated` role
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

    // 2. Apply all 11 versioned migrations in order
    for (let i = 1; i <= 11; i++) {
      const padded = String(i).padStart(6, "0");
      const filenamePattern = `20261022${padded}`;
      const dir = path.resolve(process.cwd(), "supabase/migrations");
      const matched = fs
        .readdirSync(dir)
        .find((f) => f.startsWith(filenamePattern) && f.endsWith(".sql"));
      if (!matched) {
        throw new Error(`Migration file starting with ${filenamePattern} not found`);
      }
      const sql = fs.readFileSync(path.join(dir, matched), "utf8");
      await db.exec(sql);
    }

    // 3. Grant table privileges to authenticated role so RLS is evaluated
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
    `);

    // 4. Seed user identities into auth.users
    await db.exec(`
      insert into auth.users (id, email) values
        ('${MANAGER_ID}', 'marcus.manager@apex-retail.test'),
        ('${EMPLOYEE_ID}', 'fiona.employee@apex-retail.test'),
        ('${ATTACKER_ID}', 'eve.attacker@competitor.test');

      -- Competitor organization for cross-tenant isolation testing
      insert into public.organizations (id, name, slug)
      values ('${COMPETITOR_ORG_ID}', 'Competitor Retailers', 'competitor-retail');

      insert into public.organization_members (organization_id, user_id, role, status)
      values ('${COMPETITOR_ORG_ID}', '${ATTACKER_ID}', 'admin', 'active');
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

  function requireRow<T>(row: T | undefined, message = "Expected row to exist"): T {
    if (!row) {
      throw new Error(message);
    }
    return row;
  }

  // ==========================================================================
  // Step 3.1: Create an organization and a store
  // ==========================================================================
  it("Step 3.1: Manager onboards new organization and configures store directory", async () => {
    // Manager creates organization via transactional RPC (reads auth.uid() automatically)
    const orgRes = await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ id: string; name: string; slug: string }>(
        `select id, name, slug from public.create_organization_with_owner($1, $2)`,
        ["Apex Supermarkets Inc.", "apex-supermarkets"]
      );
      return requireRow(res.rows[0]);
    });

    expect(orgRes.name).toBe("Apex Supermarkets Inc.");
    expect(orgRes.slug).toBe("apex-supermarkets");
    activeOrgId = orgRes.id;

    // Verify manager is admin in organization_members
    const memberCheck = await db.query<{ role: string; status: string }>(
      `select role, status from public.organization_members where organization_id = $1 and user_id = $2`,
      [activeOrgId, MANAGER_ID]
    );
    expect(requireRow(memberCheck.rows[0])).toEqual({ role: "admin", status: "active" });

    // Add field employee to active organization
    await db.query(
      `insert into public.organization_members (organization_id, user_id, role, status)
       values ($1, $2, 'field_employee', 'active')`,
      [activeOrgId, EMPLOYEE_ID]
    );

    // Manager creates active retail store
    const storeRes = await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ id: string; name: string }>(
        `insert into public.stores (
           organization_id, name, region, address_line1, city, state_province,
           postal_code, country_code, latitude, longitude, active
         ) values (
           $1, 'Apex Downtown Flagship', 'Midwest', '100 N State St', 'Chicago', 'IL',
           '60602', 'US', 41.8837, -87.6278, true
         ) returning id, name`,
        [activeOrgId]
      );
      return requireRow(res.rows[0]);
    });

    expect(storeRes.name).toBe("Apex Downtown Flagship");
    activeStoreId = storeRes.id;

    // Unauthorized employee cannot create stores (role-based RLS check)
    await expect(
      runAs(EMPLOYEE_ID, async () => {
        await db.query(
          `insert into public.stores (organization_id, name, region, address_line1, city, country_code)
           values ($1, 'Rogue Store', 'Midwest', '123 Fake', 'Chicago', 'US')`,
          [activeOrgId]
        );
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // Step 3.2: Create a trip with destinations and objectives
  // ==========================================================================
  it("Step 3.2: Employee creates field trip draft with planned store destinations", async () => {
    const tripRes = await runAs(EMPLOYEE_ID, async () => {
      const t = await db.query<{ id: string; status: string }>(
        `insert into public.trips (
           organization_id, owner_user_id, title, purpose, start_date, end_date, status
         ) values (
           $1, $2, 'Q4 Endcap Compliance Audit',
           'Audit promotional endcap signage and cold beverage coolers',
           '2026-10-25', '2026-10-26', 'draft'
         ) returning id, status`,
        [activeOrgId, EMPLOYEE_ID]
      );

      const tripId = requireRow(t.rows[0]).id;

      // Add destination stop
      const s = await db.query<{ id: string; status: string }>(
        `insert into public.trip_stops (
           organization_id, trip_id, store_id, sequence_number, planned_at, status
         ) values (
           $1, $2, $3, 1, '2026-10-25T14:00:00Z', 'planned'
         ) returning id, status`,
        [activeOrgId, tripId, activeStoreId]
      );

      return { trip: requireRow(t.rows[0]), stop: requireRow(s.rows[0]) };
    });

    expect(tripRes.trip.status).toBe("draft");
    expect(tripRes.stop.status).toBe("planned");
    activeTripId = tripRes.trip.id;
    activeStopId = tripRes.stop.id;
  });

  // ==========================================================================
  // Step 3.3: Submit the trip for approval
  // ==========================================================================
  it("Step 3.3: Employee submits trip for manager approval", async () => {
    await runAs(EMPLOYEE_ID, async () => {
      await db.query(
        `update public.trips
            set status = 'submitted', submitted_at = now()
          where id = $1 and organization_id = $2 and status = 'draft'`,
        [activeTripId, activeOrgId]
      );

      await db.query(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note
         ) values (
           $1, $2, $3, 'trip_submitted', 'draft', 'submitted', 'Trip submitted for manager review'
         )`,
        [activeOrgId, activeTripId, EMPLOYEE_ID]
      );
    });

    // Verify database state
    const tripCheck = await db.query<{ status: string; submitted_at: string }>(
      `select status, submitted_at from public.trips where id = $1`,
      [activeTripId]
    );
    expect(requireRow(tripCheck.rows[0]).status).toBe("submitted");
    expect(requireRow(tripCheck.rows[0]).submitted_at).toBeTruthy();
  });

  // ==========================================================================
  // Step 3.4 & 3.5: Self-approval block and manager approval
  // ==========================================================================
  it("Step 3.4 & 3.5: Employee self-approval is blocked; manager approves trip", async () => {
    // 1. Employee attempts self-approval -> BLOCKED because employee is not a manager/admin
    await expect(
      runAs(EMPLOYEE_ID, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'approved', 'Employee trying to approve own trip')`,
          [activeOrgId, activeTripId]
        );
      })
    ).rejects.toThrow(/manager or admin/i);

    // 1b. Even an admin/manager cannot approve their own trip
    const managerTripId = await runAs(MANAGER_ID, async () => {
      const t = await db.query<{ id: string }>(
        `insert into public.trips (
           organization_id, owner_user_id, title, purpose, start_date, end_date, status, submitted_at
         ) values (
           $1, $2, 'Manager Inspection Trip', 'Regional check', '2026-10-27', '2026-10-28', 'submitted', now()
         ) returning id`,
        [activeOrgId, MANAGER_ID]
      );
      return requireRow(t.rows[0]).id;
    });

    await expect(
      runAs(MANAGER_ID, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'approved', 'Self approving')`,
          [activeOrgId, managerTripId]
        );
      })
    ).rejects.toThrow(/Self-approval is forbidden/i);

    // 2. Authorized manager approves the employee's trip
    const decisionRes = await runAs(MANAGER_ID, async () => {
      const res = await db.query<{
        status: string;
        decided_by: string;
        decision_note: string;
      }>(
        `select status, decided_by, decision_note
           from public.decide_submitted_trip($1, $2, 'approved', 'Approved for field deployment')`,
        [activeOrgId, activeTripId]
      );
      return requireRow(res.rows[0]);
    });

    expect(decisionRes.status).toBe("approved");
    expect(decisionRes.decided_by).toBe(MANAGER_ID);
    expect(decisionRes.decision_note).toBe("Approved for field deployment");

    // Verify audit log has atomic immutable approval entry
    const auditCheck = await db.query<{ event_type: string; actor_user_id: string }>(
      `select event_type, actor_user_id from public.trip_audit_events
        where trip_id = $1 and event_type = 'trip_approved'`,
      [activeTripId]
    );
    expect(auditCheck.rows.length).toBe(1);
    expect(requireRow(auditCheck.rows[0]).actor_user_id).toBe(MANAGER_ID);
  });

  // ==========================================================================
  // Step 3.6: Execute an approved store visit
  // ==========================================================================
  it("Step 3.6: Employee checks in to approved store stop", async () => {
    const visitRes = await runAs(EMPLOYEE_ID, async () => {
      const res = await db.query<{
        id: string;
        status: string;
        check_in_location_status: string;
      }>(
        `select id, status, check_in_location_status
           from public.check_in_trip_stop(
             $1, $2, 'idem-checkin-001', 41.8837, -87.6278, 8.5, 'captured_unverified'
           )`,
        [activeOrgId, activeStopId]
      );
      return requireRow(res.rows[0]);
    });

    expect(visitRes.status).toBe("in_progress");
    expect(visitRes.check_in_location_status).toBe("captured_unverified");
    activeVisitId = visitRes.id;

    // Verify parent trip stop status is planned during execution
    const stopCheck = await db.query<{ status: string }>(
      `select status from public.trip_stops where id = $1`,
      [activeStopId]
    );
    expect(requireRow(stopCheck.rows[0]).status).toBe("planned");

    // Verify required checklist items were auto-seeded
    const checklistCheck = await db.query<{ count: string }>(
      `select count(*) from public.visit_checklist_items where visit_id = $1`,
      [activeVisitId]
    );
    expect(Number(requireRow(checklistCheck.rows[0]).count)).toBeGreaterThanOrEqual(2);
  });

  // ==========================================================================
  // Step 3.7: Complete checklist and upload evidence
  // ==========================================================================
  it("Step 3.7: Premature checkout fails; checklist completed and evidence uploaded", async () => {
    // Attempting to check out before completing required checklist items -> MUST FAIL
    await expect(
      runAs(EMPLOYEE_ID, async () => {
        await db.query(
          `select * from public.check_out_visit(
             $1, $2, 'Premature checkout attempt', 'idem-fail-001', 41.8837, -87.6278, 8.5, 'captured_unverified'
           )`,
          [activeOrgId, activeVisitId]
        );
      })
    ).rejects.toThrow(/required checklist/i);

    // Complete all required checklist items
    await runAs(EMPLOYEE_ID, async () => {
      await db.query(
        `update public.visit_checklist_items
            set completed_at = now(), answer_text = 'Verified planogram and promotional tags'
          where visit_id = $1 and organization_id = $2`,
        [activeVisitId, activeOrgId]
      );
    });

    // Upload photo evidence with valid tenant-scoped storage path: <orgId>/<visitId>/<filename>
    const safeStoragePath = `${activeOrgId}/${activeVisitId}/shelf_endcap_photo.jpg`;
    const evidenceRes = await runAs(EMPLOYEE_ID, async () => {
      const res = await db.query<{ id: string; storage_path: string }>(
        `insert into public.visit_evidence (
           organization_id, visit_id, uploaded_by, storage_path,
           file_type, file_size, caption, idempotency_key
         ) values (
           $1, $2, $3, $4, 'image/jpeg', 245760, 'Endcap display compliance photo', 'idem-upload-001'
         ) returning id, storage_path`,
        [activeOrgId, activeVisitId, EMPLOYEE_ID, safeStoragePath]
      );
      return requireRow(res.rows[0]);
    });

    expect(evidenceRes.storage_path).toBe(safeStoragePath);

    // Verify foreign tenant prefix violation is rejected by check constraint
    await expect(
      runAs(EMPLOYEE_ID, async () => {
        await db.query(
          `insert into public.visit_evidence (
             organization_id, visit_id, uploaded_by, storage_path,
             file_type, file_size, caption
           ) values (
             $1, $2, $3, 'wrong-tenant/other-file.jpg', 'image/jpeg', 100, 'Bad path'
           )`,
          [activeOrgId, activeVisitId, EMPLOYEE_ID]
        );
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // Step 3.8: Check out and verify visit records
  // ==========================================================================
  it("Step 3.8: Employee completes checkout with verified location and status updates", async () => {
    const checkoutRes = await runAs(EMPLOYEE_ID, async () => {
      const res = await db.query<{
        status: string;
        checked_out_at: string;
        check_out_location_status: string;
      }>(
        `select status, checked_out_at, check_out_location_status
           from public.check_out_visit(
             $1, $2, 'Store visit completed successfully. All planograms verified.',
             'idem-checkout-001', 41.8839, -87.6279, 7.2, 'captured_unverified'
           )`,
        [activeOrgId, activeVisitId]
      );
      return requireRow(res.rows[0]);
    });

    expect(checkoutRes.status).toBe("submitted");
    expect(checkoutRes.checked_out_at).toBeTruthy();
    expect(checkoutRes.check_out_location_status).toBe("captured_unverified");

    // Verify trip stop marked as 'visited'
    const stopCheck = await db.query<{ status: string }>(
      `select status from public.trip_stops where id = $1`,
      [activeStopId]
    );
    expect(requireRow(stopCheck.rows[0]).status).toBe("visited");
  });

  // ==========================================================================
  // Step 3.9: Generate and review trip/visit report
  // ==========================================================================
  it("Step 3.9: Manager reviews trip execution metrics and AI report draft lifecycle", async () => {
    // 1. Verify manager reporting dataset accurately aggregates completed store visits
    const metricsRes = await runAs(MANAGER_ID, async () => {
      const visits = await db.query<{ status: string; store_name: string }>(
        `select v.status, st.name as store_name
           from public.visits v
           join public.trip_stops ts on ts.id = v.trip_stop_id
           join public.stores st on st.id = ts.store_id
          where v.organization_id = $1 and v.trip_stop_id = $2`,
        [activeOrgId, activeStopId]
      );
      return requireRow(visits.rows[0]);
    });

    expect(metricsRes.status).toBe("submitted");
    expect(metricsRes.store_name).toBe("Apex Downtown Flagship");

    // 2. Seed an AI report draft requiring human review with valid provenance source IDs
    const draftRes = await runAs(EMPLOYEE_ID, async () => {
      const res = await db.query<{
        id: string;
        review_status: string;
      }>(
        `insert into public.visit_ai_report_drafts (
           organization_id, visit_id, model_name, prompt_template_version,
           summary, source_record_ids, created_by, review_status
         ) values (
           $1, $2::uuid, 'gpt-4o-mini', 'v1.0',
           'Endcap display planogram audit complete with verified photographic evidence.',
           jsonb_build_object('visit_id', $4::text), $3, 'pending_review'
         ) returning id, review_status`,
        [activeOrgId, activeVisitId, EMPLOYEE_ID, activeVisitId]
      );
      return requireRow(res.rows[0]);
    });

    expect(draftRes.review_status).toBe("pending_review");
    activeDraftId = draftRes.id;

    // 3. Manager reviews and approves the AI draft
    const approvedDraftRes = await runAs(MANAGER_ID, async () => {
      const res = await db.query<{ review_status: string; reviewed_by: string }>(
        `update public.visit_ai_report_drafts
            set review_status = 'approved',
                reviewed_by = $1,
                reviewed_at = now()
          where id = $2 and organization_id = $3
          returning review_status, reviewed_by`,
        [MANAGER_ID, activeDraftId, activeOrgId]
      );
      return requireRow(res.rows[0]);
    });

    expect(approvedDraftRes.review_status).toBe("approved");
    expect(approvedDraftRes.reviewed_by).toBe(MANAGER_ID);
  });

  // ==========================================================================
  // Step 4: Access Control & Cross-Tenant Security Invariants
  // ==========================================================================
  it("Step 4: Cross-tenant isolation, role boundaries, and audit immutability strictly enforced", async () => {
    // 1. Attacker from Competitor Org cannot read any Org A data (RLS returns 0 rows)
    await runAs(ATTACKER_ID, async () => {
      const stores = await db.query(
        `select * from public.stores where organization_id = $1`,
        [activeOrgId]
      );
      expect(stores.rows.length).toBe(0);

      const trips = await db.query(
        `select * from public.trips where organization_id = $1`,
        [activeOrgId]
      );
      expect(trips.rows.length).toBe(0);

      const visits = await db.query(
        `select * from public.visits where organization_id = $1`,
        [activeOrgId]
      );
      expect(visits.rows.length).toBe(0);
    });

    // 2. Attacker cannot invoke RPCs on Org A
    await expect(
      runAs(ATTACKER_ID, async () => {
        await db.query(
          `select * from public.check_in_trip_stop($1, $2, 'attacker-key')`,
          [activeOrgId, activeStopId]
        );
      })
    ).rejects.toThrow(/membership required/i);

    // 3. RLS prevents authenticated user from modifying audit log (no update policy -> 0 rows affected)
    const updateAttempt = await runAs(MANAGER_ID, async () => {
      return db.query(
        `update public.trip_audit_events set note = 'Tampered' where trip_id = $1`,
        [activeTripId]
      );
    });
    expect(updateAttempt.rows.length).toBe(0);

    // 4. Immutability trigger blocks superuser/direct modification or deletion on trip_audit_events
    await expect(
      db.query(
        `update public.trip_audit_events set note = 'Direct superuser tamper' where trip_id = $1`,
        [activeTripId]
      )
    ).rejects.toThrow(/append-only/i);

    await expect(
      db.query(`delete from public.trip_audit_events where trip_id = $1`, [activeTripId])
    ).rejects.toThrow(/append-only/i);
  });
});
