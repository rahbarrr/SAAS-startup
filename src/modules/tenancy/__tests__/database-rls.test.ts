import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ALICE_ADMIN_ORG_A = "10000000-0000-4000-8000-000000000001"; // Admin in Org A, Field Employee in Org B
const MARCUS_MANAGER_ORG_A = "10000000-0000-4000-8000-000000000002"; // Manager in Org A
const FIONA_FIELD_ORG_A = "10000000-0000-4000-8000-000000000003"; // Field Employee in Org A
const IVAN_INVITED_ORG_A = "10000000-0000-4000-8000-000000000004"; // Invited (inactive) in Org A
const BRENDA_MANAGER_ORG_B = "10000000-0000-4000-8000-000000000005"; // Manager in Org B

const STORE_ORG_B = "40000000-0000-4000-8000-000000000003";
const FIONA_DRAFT_TRIP = "50000000-0000-4000-8000-000000000001";
const FIONA_SUBMITTED_TRIP = "50000000-0000-4000-8000-000000000002";
const MARCUS_OWN_SUBMITTED_TRIP = "50000000-0000-4000-8000-000000000003";
const FIONA_VISIT_ID = "70000000-0000-4000-8000-000000000001";

describe("PostgreSQL Schema, Migrations, RLS Policies, and Workflow Triggers", () => {
  let db: PGlite;

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

    // 2. Apply all versioned migrations in chronological order
    const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await db.exec(sql);
    }
    const seedSql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/seed.sql"),
      "utf8"
    );

    // Grant table-level privileges to `authenticated` so RLS policies govern row access
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
    `);

    // 3. Load local development seed data
    await db.exec(seedSql);
  });

  afterAll(async () => {
    await db.close();
  });

  async function runAsAuthenticatedUser<T>(
    userId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await db.exec("begin;");
    try {
      await db.exec(`
        set local role authenticated;
        select set_config('request.jwt.claim.sub', '${userId}', true);
      `);
      const result = await fn();
      await db.exec("commit;");
      return result;
    } catch (error) {
      await db.exec("rollback;");
      throw error;
    }
  }

  it("enforces cross-tenant isolation via RLS (Org B manager cannot see Org A stores, trips, visits, or evidence)", async () => {
    await runAsAuthenticatedUser(BRENDA_MANAGER_ORG_B, async () => {
      const orgAStores = await db.query<{ id: string }>(
        "select id from public.stores where organization_id = $1",
        [ORG_A_ID]
      );
      expect(orgAStores.rows).toHaveLength(0);

      const orgATrips = await db.query<{ id: string }>(
        "select id from public.trips where organization_id = $1",
        [ORG_A_ID]
      );
      expect(orgATrips.rows).toHaveLength(0);

      const orgAVisits = await db.query<{ id: string }>(
        "select id from public.visits where organization_id = $1",
        [ORG_A_ID]
      );
      expect(orgAVisits.rows).toHaveLength(0);

      // Brenda CAN see her own organization's store in Org B
      const orgBStores = await db.query<{ id: string }>(
        "select id from public.stores where organization_id = $1",
        [ORG_B_ID]
      );
      expect(orgBStores.rows).toHaveLength(1);
    });
  });

  it("denies invited (non-active) members from reading organization resources", async () => {
    await runAsAuthenticatedUser(IVAN_INVITED_ORG_A, async () => {
      const stores = await db.query<{ id: string }>(
        "select id from public.stores where organization_id = $1",
        [ORG_A_ID]
      );
      expect(stores.rows).toHaveLength(0);
    });
  });

  it("prevents cross-organization foreign key references at the database schema level (Org A trip cannot attach Org B store)", async () => {
    // Even if executed with elevated privileges, composite FK (store_id, organization_id) blocks cross-org store attachment
    await expect(
      db.query(
        `insert into public.trip_stops (organization_id, trip_id, store_id, sequence_number)
         values ($1, $2, $3, 99)`,
        [ORG_A_ID, FIONA_DRAFT_TRIP, STORE_ORG_B]
      )
    ).rejects.toThrow(/trip_stops_same_org_store_fk/);
  });

  it("enforces tenant-scoped storage_path prefix on visit_evidence", async () => {
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      // Attempting to insert evidence with Org B's UUID prefix into Org A's visit is rejected
      await expect(
        db.query(
          `insert into public.visit_evidence (
             organization_id, visit_id, storage_path, file_type, file_size, caption, uploaded_by
           ) values ($1, $2, $3, 'image/jpeg', 10240, 'Invalid path', $4)`,
          [
            ORG_A_ID,
            FIONA_VISIT_ID,
            `${ORG_B_ID}/${FIONA_VISIT_ID}/spoofed.jpg`,
            FIONA_FIELD_ORG_A,
          ]
        )
      ).rejects.toThrow(/visit_evidence_tenant_storage_path_chk/);
    });
  });

  it("allows field_employee to edit their own draft trip, but denies unauthorized role actions (approving trips or creating stores)", async () => {
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      // Allowed: Fiona updates her own draft trip title
      const updateDraft = await db.query<{ id: string; title: string }>(
        `update public.trips
            set title = 'Q4 Endcap Audit — Downtown (Updated)'
          where id = $1
          returning id, title`,
        [FIONA_DRAFT_TRIP]
      );
      expect(updateDraft.rows).toHaveLength(1);

      // Denied: Fiona (field_employee) attempts to approve her submitted trip
      const selfApproveAttempt = await db.query<{ id: string }>(
        `update public.trips
            set status = 'approved',
                decided_by = $1
          where id = $2
          returning id`,
        [FIONA_FIELD_ORG_A, FIONA_SUBMITTED_TRIP]
      );
      expect(selfApproveAttempt.rows).toHaveLength(0);

      // Denied: Fiona (field_employee) attempts to create a store in Org A
      await expect(
        db.query(
          `insert into public.stores (organization_id, name, region, address_line1, city)
           values ($1, 'Unauthorized Store', 'North', '1 St', 'Chicago')`,
          [ORG_A_ID]
        )
      ).rejects.toThrow(/row-level security policy/);
    });
  });

  it("prevents self-approval by a manager or admin in both RLS and database trigger", async () => {
    // 1. As authenticated manager Marcus attempting to approve his own submitted trip:
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const res = await db.query<{ id: string }>(
        `update public.trips
            set status = 'approved',
                decided_by = $1,
                decision_note = 'Self approving my own trip'
          where id = $2
          returning id`,
        [MARCUS_MANAGER_ORG_A, MARCUS_OWN_SUBMITTED_TRIP]
      );
      // Blocked by RLS (0 rows updated)
      expect(res.rows).toHaveLength(0);
    });

    // 2. Even if called via service-role/superuser bypassing RLS, the trigger blocks self-approval:
    await expect(
      db.query(
        `update public.trips
            set status = 'approved',
                decided_by = $1,
                decision_note = 'Bypassing RLS self-approval attempt'
          where id = $2`,
        [MARCUS_MANAGER_ORG_A, MARCUS_OWN_SUBMITTED_TRIP]
      )
    ).rejects.toThrow(/Self-approval is forbidden/);
  });

  it("allows a valid manager (and admin acting as manager) to approve another member's submitted trip and record append-only audit events", async () => {
    // 1. Marcus (Manager in Org A) approves Fiona's submitted trip
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const approved = await db.query<{
        id: string;
        status: string;
        decided_by: string;
        decided_at: string | null;
      }>(
        `update public.trips
            set status = 'approved',
                decided_by = $1,
                decision_note = 'Route and store selection approved for Q4 reset'
          where id = $2
          returning id, status, decided_by, decided_at`,
        [MARCUS_MANAGER_ORG_A, FIONA_SUBMITTED_TRIP]
      );

      expect(approved.rows).toHaveLength(1);
      expect(approved.rows[0]?.status).toBe("approved");
      expect(approved.rows[0]?.decided_by).toBe(MARCUS_MANAGER_ORG_A);
      expect(approved.rows[0]?.decided_at).toBeTruthy();

      // Record audit event
      const auditInsert = await db.query<{ id: string }>(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata
         ) values ($1, $2, $3, 'trip_approved', 'submitted', 'approved', 'Approved by manager', '{"source": "web"}'::jsonb)
         returning id`,
        [ORG_A_ID, FIONA_SUBMITTED_TRIP, MARCUS_MANAGER_ORG_A]
      );
      expect(auditInsert.rows).toHaveLength(1);
    });

    // 2. Alice (Admin in Org A, acting as manager) approves Marcus's submitted trip
    await runAsAuthenticatedUser(ALICE_ADMIN_ORG_A, async () => {
      const adminApproved = await db.query<{
        id: string;
        status: string;
        decided_by: string;
      }>(
        `update public.trips
            set status = 'approved',
                decided_by = $1,
                decision_note = 'Approved by org admin'
          where id = $2
          returning id, status, decided_by`,
        [ALICE_ADMIN_ORG_A, MARCUS_OWN_SUBMITTED_TRIP]
      );

      expect(adminApproved.rows).toHaveLength(1);
      expect(adminApproved.rows[0]?.status).toBe("approved");
      expect(adminApproved.rows[0]?.decided_by).toBe(ALICE_ADMIN_ORG_A);
    });
  });

  it("enforces append-only immutability and allowlisted metadata keys on trip_audit_events", async () => {
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      // Disallowed metadata key is rejected by trigger
      await expect(
        db.query(
          `insert into public.trip_audit_events (
             organization_id, trip_id, actor_user_id, event_type, old_status, new_status, metadata
           ) values ($1, $2, $3, 'trip_approved', 'submitted', 'approved', '{"secret_prompt": "leaked"}'::jsonb)`,
          [ORG_A_ID, FIONA_SUBMITTED_TRIP, MARCUS_MANAGER_ORG_A]
        )
      ).rejects.toThrow(/Disallowed metadata key/);
    });

    // Attempting to update or delete existing audit events is blocked by trigger even for superuser
    await expect(
      db.query(
        `update public.trip_audit_events set note = 'Tampered note' where trip_id = $1`,
        [FIONA_SUBMITTED_TRIP]
      )
    ).rejects.toThrow(/trip_audit_events is append-only/);

    await expect(
      db.query(`delete from public.trip_audit_events where trip_id = $1`, [
        FIONA_SUBMITTED_TRIP,
      ])
    ).rejects.toThrow(/trip_audit_events is append-only/);
  });

  it("executes transactional organization onboarding and enforces invitation expiry, one-time use, and inviter role in PostgreSQL", async () => {
    const NEW_FOUNDER_ID = "10000000-0000-4000-8000-000000000077";
    const NEW_INVITED_USER_ID = "10000000-0000-4000-8000-000000000078";

    // Insert new auth users; trigger `trg_on_auth_user_created` automatically creates their `public.profiles` rows
    await db.query(
      `insert into auth.users (id, email) values
         ($1, 'founder@neworg.local'),
         ($2, 'invitee@acme.local')`,
      [NEW_FOUNDER_ID, NEW_INVITED_USER_ID]
    );

    // 1. Transactional onboarding via `create_organization_with_owner`
    await runAsAuthenticatedUser(NEW_FOUNDER_ID, async () => {
      const createdOrg = await db.query<{ id: string; slug: string }>(
        `select id, slug from public.create_organization_with_owner('New Frontier Retail', 'new-frontier-retail')`
      );
      expect(createdOrg.rows).toHaveLength(1);
      const newOrgId = createdOrg.rows[0]?.id;
      expect(newOrgId).toBeTruthy();

      const ownerMembership = await db.query<{ role: string; status: string }>(
        `select role, status from public.organization_members where organization_id = $1 and user_id = $2`,
        [newOrgId, NEW_FOUNDER_ID]
      );
      expect(ownerMembership.rows[0]).toEqual({
        role: "admin",
        status: "active",
      });
    });

    // 2. Admin in Org A issues a valid invitation and an already-expired invitation
    const validTokenHash = "a".repeat(64);
    const expiredTokenHash = "b".repeat(64);

    await runAsAuthenticatedUser(ALICE_ADMIN_ORG_A, async () => {
      await db.query(
        `insert into public.organization_invitations (
           organization_id, invited_email, role, token_hash, invited_by, expires_at
         ) values (
           $1, 'invitee@acme.local', 'manager', $2, $3, now() + interval '48 hours'
         )`,
        [ORG_A_ID, validTokenHash, ALICE_ADMIN_ORG_A]
      );

      await db.query(
        `insert into public.organization_invitations (
           organization_id, invited_email, role, token_hash, invited_by, created_at, expires_at
         ) values (
           $1, 'invitee@acme.local', 'field_employee', $2, $3, now() - interval '72 hours', now() - interval '24 hours'
         )`,
        [ORG_A_ID, expiredTokenHash, ALICE_ADMIN_ORG_A]
      );
    });

    // 3. Mismatched user (NEW_FOUNDER_ID) cannot accept invitee@acme.local's invitation
    await expect(
      runAsAuthenticatedUser(NEW_FOUNDER_ID, async () => {
        await db.query(`select * from public.accept_organization_invitation($1)`, [
          validTokenHash,
        ]);
      })
    ).rejects.toThrow(/Invitation email does not match/);

    // 4. Invitee cannot accept the expired invitation
    await expect(
      runAsAuthenticatedUser(NEW_INVITED_USER_ID, async () => {
        await db.query(`select * from public.accept_organization_invitation($1)`, [
          expiredTokenHash,
        ]);
      })
    ).rejects.toThrow(/Invitation has expired/);

    // 5. Invitee accepts valid invitation -> receives exact 'manager' role authorized by inviter
    await runAsAuthenticatedUser(NEW_INVITED_USER_ID, async () => {
      const accepted = await db.query<{
        organization_id: string;
        user_id: string;
        role: string;
        status: string;
      }>(
        `select organization_id, user_id, role, status from public.accept_organization_invitation($1)`,
        [validTokenHash]
      );

      expect(accepted.rows[0]).toEqual({
        organization_id: ORG_A_ID,
        user_id: NEW_INVITED_USER_ID,
        role: "manager",
        status: "active",
      });
    });

    // 6. Reusing the same invitation token a second time is rejected (one-time use)
    await expect(
      runAsAuthenticatedUser(NEW_INVITED_USER_ID, async () => {
        await db.query(`select * from public.accept_organization_invitation($1)`, [
          validTokenHash,
        ]);
      })
    ).rejects.toThrow(/already been used/);

    // 7. Editing an approved trip by its owner resets status to 'draft' and clears approval fields
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const reopened = await db.query<{
        id: string;
        status: string;
        decided_by: string | null;
        submitted_at: string | null;
      }>(
        `update public.trips
            set title = 'Lakeside Beverage Merchandising Run (Revised)',
                status = 'draft'
          where id = $1
          returning id, status, decided_by, submitted_at`,
        [FIONA_SUBMITTED_TRIP]
      );

      expect(reopened.rows[0]).toEqual({
        id: FIONA_SUBMITTED_TRIP,
        status: "draft",
        decided_by: null,
        submitted_at: null,
      });

      const reopenAudit = await db.query<{ id: string }>(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata
         ) values ($1, $2, $3, 'trip_reopened_for_edit', 'approved', 'draft', 'Reset to draft after edit', '{"stop_count": 1}'::jsonb)
         returning id`,
        [ORG_A_ID, FIONA_SUBMITTED_TRIP, FIONA_FIELD_ORG_A]
      );
      expect(reopenAudit.rows).toHaveLength(1);
    });
  });

  it("enforces atomic decide_submitted_trip RPC: role check, cross-org denial, self-approval denial, required note, atomic audit insert, and stale status conflict", async () => {
    // 1. Fiona (owner) submits her draft trip (`FIONA_DRAFT_TRIP`)
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      await db.query(
        `update public.trips
            set status = 'submitted',
                submitted_at = now()
          where id = $1`,
        [FIONA_DRAFT_TRIP]
      );

      await db.query(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata
         ) values ($1, $2, $3, 'trip_submitted', 'draft', 'submitted', 'Submitted for review', '{"stop_count": 2, "source": "web"}'::jsonb)`,
        [ORG_A_ID, FIONA_DRAFT_TRIP, FIONA_FIELD_ORG_A]
      );
    });

    // 2. Denied: Field employee cannot call decide_submitted_trip
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'approved', 'Attempt by employee')`,
          [ORG_A_ID, FIONA_DRAFT_TRIP]
        );
      })
    ).rejects.toThrow(/Only an active manager or admin/);

    // 3. Denied: Manager from another organization (Brenda in Org B) cannot decide Org A's trip
    await expect(
      runAsAuthenticatedUser(BRENDA_MANAGER_ORG_B, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'approved', 'Cross-org attempt')`,
          [ORG_A_ID, FIONA_DRAFT_TRIP]
        );
      })
    ).rejects.toThrow(/Only an active manager or admin/);

    // 4. Denied: Requesting changes or rejecting without a 3+ char note fails in decide_submitted_trip
    await expect(
      runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'changes_requested', ' ')`,
          [ORG_A_ID, FIONA_DRAFT_TRIP]
        );
      })
    ).rejects.toThrow(/A decision note of at least 3 characters is required/);

    // 5. Allowed: Marcus requests changes via atomic RPC -> updates trip AND writes `trip_changes_requested` audit event
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const decided = await db.query<{
        id: string;
        status: string;
        decided_by: string;
        decision_note: string;
      }>(
        `select id, status, decided_by, decision_note
           from public.decide_submitted_trip(
             $1,
             $2,
             'changes_requested',
             'Please add store #204 before final approval',
             '{"source": "web", "stop_count": 2}'::jsonb
           )`,
        [ORG_A_ID, FIONA_DRAFT_TRIP]
      );
      expect(decided.rows[0]).toEqual({
        id: FIONA_DRAFT_TRIP,
        status: "changes_requested",
        decided_by: MARCUS_MANAGER_ORG_A,
        decision_note: "Please add store #204 before final approval",
      });
    });

    // 6. Stale status / concurrent decision protection: Alice (Admin A) attempting to approve the same trip after Marcus already decided it fails with 40001
    await expect(
      runAsAuthenticatedUser(ALICE_ADMIN_ORG_A, async () => {
        await db.query(
          `select * from public.decide_submitted_trip($1, $2, 'approved', 'Concurrent approval attempt')`,
          [ORG_A_ID, FIONA_DRAFT_TRIP]
        );
      })
    ).rejects.toThrow(/Stale trip status: only submitted trips can be decided/);

    // 7. Fiona edits and resubmits (`trip_updated` + `trip_resubmitted`), then Marcus approves
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      await db.query(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at
         ) values ($1, $2, $3, 'trip_updated', 'changes_requested', 'changes_requested', 'Updated stops', '{"stop_count": 2, "changed_fields": "stops"}'::jsonb, clock_timestamp())`,
        [ORG_A_ID, FIONA_DRAFT_TRIP, FIONA_FIELD_ORG_A]
      );

      await db.query(
        `update public.trips set status = 'submitted', submitted_at = clock_timestamp() where id = $1`,
        [FIONA_DRAFT_TRIP]
      );

      await db.query(
        `insert into public.trip_audit_events (
           organization_id, trip_id, actor_user_id, event_type, old_status, new_status, note, metadata, created_at
         ) values ($1, $2, $3, 'trip_resubmitted', 'changes_requested', 'submitted', 'Resubmitted after changes', '{"stop_count": 2, "source": "web"}'::jsonb, clock_timestamp())`,
        [ORG_A_ID, FIONA_DRAFT_TRIP, FIONA_FIELD_ORG_A]
      );
    });

    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const approved = await db.query<{ status: string }>(
        `select status from public.decide_submitted_trip($1, $2, 'approved', 'Looks great now', '{"source": "web", "stop_count": 2}'::jsonb)`,
        [ORG_A_ID, FIONA_DRAFT_TRIP]
      );
      expect(approved.rows[0]?.status).toBe("approved");

      const audits = await db.query<{ event_type: string }>(
        `select event_type from public.trip_audit_events where trip_id = $1 order by created_at asc, id asc`,
        [FIONA_DRAFT_TRIP]
      );
      expect(audits.rows.map((r) => r.event_type)).toEqual([
        "trip_submitted",
        "trip_changes_requested",
        "trip_updated",
        "trip_resubmitted",
        "trip_approved",
      ]);
    });
  });

  it("enforces database visit execution invariants: blocks check-in on non-approved trips, enforces required checklist before check-out, supports idempotent check-in/out RPCs, and blocks duplicate check-ins", async () => {
    const FIONA_DRAFT_STOP = "60000000-0000-4000-8000-000000000001"; // Stop on FIONA_DRAFT_TRIP (which was just approved in test above!)
    const UNAPPROVED_TRIP_ID = "50000000-0000-4000-8000-000000000099";
    const UNAPPROVED_STOP_ID = "60000000-0000-4000-8000-000000000099";

    // First complete the seeded active visit (`FIONA_VISIT_ID`) so Fiona has no active in_progress visit
    // Because trip `50000000-0000-4000-8000-000000000004` has only 1 stop (`60000000-0000-4000-8000-000000000003`),
    // checking out `FIONA_VISIT_ID` automatically transitions trip `50000000-0000-4000-8000-000000000004` to `completed`.
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const checkedOutSeeded = await db.query<{ status: string }>(
        `select status from public.check_out_visit($1, $2, 'Completed seeded visit', 'idem-seed-checkout', null, null, null, 'permission_denied')`,
        [ORG_A_ID, FIONA_VISIT_ID]
      );
      expect(checkedOutSeeded.rows[0]?.status).toBe("submitted");

      const parentTripRes = await db.query<{ status: string }>(
        `select status from public.trips where id = '50000000-0000-4000-8000-000000000004'`
      );
      expect(parentTripRes.rows[0]?.status).toBe("completed");
    });

    // 1. Create a new draft trip + stop for Fiona and verify check-in is blocked while trip is still 'draft'
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      await db.query(
        `insert into public.trips (id, organization_id, owner_user_id, title, start_date, end_date, status)
         values ($1, $2, $3, 'Unapproved Draft Route', '2026-11-10', '2026-11-11', 'draft')`,
        [UNAPPROVED_TRIP_ID, ORG_A_ID, FIONA_FIELD_ORG_A]
      );
      await db.query(
        `insert into public.trip_stops (id, organization_id, trip_id, store_id, sequence_number)
         values ($1, $2, $3, '40000000-0000-4000-8000-000000000001', 1)`,
        [UNAPPROVED_STOP_ID, ORG_A_ID, UNAPPROVED_TRIP_ID]
      );
    });

    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `select * from public.check_in_trip_stop($1, $2, 'idem-draft-stop', null, null, null, 'permission_denied')`,
          [ORG_A_ID, UNAPPROVED_STOP_ID]
        );
      })
    ).rejects.toThrow(/Cannot check in to a stop unless its parent trip is approved/);

    // 2. Fiona checks in to `FIONA_DRAFT_STOP` (whose parent trip `FIONA_DRAFT_TRIP` is now 'approved') with denied location permission
    let newVisitId = "";
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const checkInRes = await db.query<{
        id: string;
        status: string;
        check_in_location_status: string;
        checked_in_at: string | null;
      }>(
        `select id, status, check_in_location_status, checked_in_at
           from public.check_in_trip_stop($1, $2, 'idem-fiona-stop1', null, null, null, 'permission_denied')`,
        [ORG_A_ID, FIONA_DRAFT_STOP]
      );

      expect(checkInRes.rows[0]?.status).toBe("in_progress");
      expect(checkInRes.rows[0]?.check_in_location_status).toBe("permission_denied");
      expect(checkInRes.rows[0]?.checked_in_at).toBeTruthy();
      newVisitId = checkInRes.rows[0]?.id ?? "";

      // Parent trip `FIONA_DRAFT_TRIP` transitioned from `approved` to `in_progress` upon first stop check-in
      const fionaTripInProgress = await db.query<{ status: string }>(
        `select status from public.trips where id = $1`,
        [FIONA_DRAFT_TRIP]
      );
      expect(fionaTripInProgress.rows[0]?.status).toBe("in_progress");

      // Idempotent retry with the same key returns the exact same visit row
      const retryRes = await db.query<{ id: string }>(
        `select id from public.check_in_trip_stop($1, $2, 'idem-fiona-stop1', null, null, null, 'permission_denied')`,
        [ORG_A_ID, FIONA_DRAFT_STOP]
      );
      expect(retryRes.rows[0]?.id).toBe(newVisitId);
    });

    // Duplicate check-in with a different key is rejected with 23505
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `select id from public.check_in_trip_stop($1, $2, 'different-key', null, null, null, 'permission_denied')`,
          [ORG_A_ID, FIONA_DRAFT_STOP]
        );
      })
    ).rejects.toThrow(/Duplicate check-in/);

    // Cannot check out while seeded required checklist items remain incomplete
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `select * from public.check_out_visit($1, $2, 'Trying early checkout', 'idem-checkout-1')`,
          [ORG_A_ID, newVisitId]
        );
      })
    ).rejects.toThrow(/required checklist item\(s\) remain incomplete/);

    // Complete all required checklist items for `newVisitId`, then check out with unverified coordinates
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      await db.query(
        `update public.visit_checklist_items
            set answer_value = 'true'::jsonb,
                completed_at = clock_timestamp(),
                completed_by = $1
          where visit_id = $2
            and required = true`,
        [FIONA_FIELD_ORG_A, newVisitId]
      );

      const checkedOut = await db.query<{
        id: string;
        status: string;
        check_out_location_status: string;
        check_out_accuracy_m: number;
      }>(
        `select id, status, check_out_location_status, check_out_accuracy_m
           from public.check_out_visit($1, $2, 'All required items done', 'idem-checkout-1', 41.8837, -87.6324, 11.2, 'captured_unverified')`,
        [ORG_A_ID, newVisitId]
      );

      expect(checkedOut.rows[0]).toEqual({
        id: newVisitId,
        status: "submitted",
        check_out_location_status: "captured_unverified",
        check_out_accuracy_m: 11.2,
      });

      // Because `FIONA_DRAFT_STOP` was the only planned stop on `FIONA_DRAFT_TRIP`,
      // checking it out automatically transitions `FIONA_DRAFT_TRIP` to `completed`
      const fionaTripCompleted = await db.query<{ status: string }>(
        `select status from public.trips where id = $1`,
        [FIONA_DRAFT_TRIP]
      );
      expect(fionaTripCompleted.rows[0]?.status).toBe("completed");
    });
  });

  it("enforces visit_ai_report_drafts RLS, provenance immutability, and human review invariants in PostgreSQL", async () => {
    let draftId = "";

    // 1. Fiona (visit owner) inserts an AI report draft for FIONA_VISIT_ID
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const inserted = await db.query<{
        id: string;
        review_status: string;
        created_by: string;
      }>(
        `insert into public.visit_ai_report_drafts (
           organization_id,
           visit_id,
           model_name,
           model_version,
           prompt_template_version,
           summary,
           source_record_ids,
           created_by
         ) values (
           $1,
           $2,
           'gpt-4o-mini',
           'gpt-4o-mini-2024-07-18',
           'fieldtrack-visit-report-v1',
           'Initial AI-generated store visit draft summary.',
           jsonb_build_object('visit_id', $2::uuid::text, 'checklist_item_ids', '[]'::jsonb, 'evidence_ids', '[]'::jsonb),
           $3
         ) returning id, review_status, created_by`,
        [ORG_A_ID, FIONA_VISIT_ID, FIONA_FIELD_ORG_A]
      );

      expect(inserted.rows[0]?.review_status).toBe("pending_review");
      expect(inserted.rows[0]?.created_by).toBe(FIONA_FIELD_ORG_A);
      draftId = inserted.rows[0]?.id ?? "";
    });

    // 2. Cross-org manager (Brenda in Org B) cannot read Org A's AI report draft
    await runAsAuthenticatedUser(BRENDA_MANAGER_ORG_B, async () => {
      const crossOrgRead = await db.query(
        `select id from public.visit_ai_report_drafts where id = $1`,
        [draftId]
      );
      expect(crossOrgRead.rows).toHaveLength(0);
    });

    // 3. Provenance fields (`model_name`, `source_record_ids`, `created_by`) cannot be mutated on update
    await expect(
      runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
        await db.query(
          `update public.visit_ai_report_drafts set model_name = 'tampered-model' where id = $1`,
          [draftId]
        );
      })
    ).rejects.toThrow(/provenance fields.*are immutable/i);

    // 4. Manager Marcus edits the summary and approves the draft (`review_status = 'approved'`), automatically stamping `reviewed_by` and `reviewed_at`
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const reviewed = await db.query<{
        review_status: string;
        reviewed_by: string;
        reviewed_at: string | null;
      }>(
        `update public.visit_ai_report_drafts
            set review_status = 'approved',
                summary = 'Human-reviewed and approved summary.',
                review_note = 'Verified against checklist.'
          where id = $1
          returning review_status, reviewed_by, reviewed_at`,
        [draftId]
      );

      expect(reviewed.rows[0]?.review_status).toBe("approved");
      expect(reviewed.rows[0]?.reviewed_by).toBe(MARCUS_MANAGER_ORG_A);
      expect(reviewed.rows[0]?.reviewed_at).toBeTruthy();
    });
  });

  it("enforces idempotent mark_in_app_notification_read RPC and per-user/per-tenant RLS on in_app_notification_reads", async () => {
    const SEEDED_SUBMITTED_AUDIT_EVENT = "a0000000-0000-4000-8000-000000000001";

    // 1. Marcus marks the committed submission audit event as read twice; both calls succeed idempotently
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const firstRead = await db.query<{ read_at: string }>(
        `select read_at from public.mark_in_app_notification_read($1, $2)`,
        [ORG_A_ID, SEEDED_SUBMITTED_AUDIT_EVENT]
      );
      const secondRead = await db.query<{ read_at: string }>(
        `select read_at from public.mark_in_app_notification_read($1, $2)`,
        [ORG_A_ID, SEEDED_SUBMITTED_AUDIT_EVENT]
      );

      expect(firstRead.rows[0]?.read_at).toBeTruthy();
      expect(secondRead.rows[0]?.read_at).toEqual(firstRead.rows[0]?.read_at);
    });

    // 2. Fiona cannot see Marcus's personal notification read receipt due to `user_id = auth.uid()` RLS
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const fionaReads = await db.query(
        `select * from public.in_app_notification_reads where audit_event_id = $1`,
        [SEEDED_SUBMITTED_AUDIT_EVENT]
      );
      expect(fionaReads.rows).toHaveLength(0);
    });

    // 3. Cross-org manager (Brenda in Org B) is rejected when calling mark_in_app_notification_read for Org A
    await expect(
      runAsAuthenticatedUser(BRENDA_MANAGER_ORG_B, async () => {
        await db.query(`select * from public.mark_in_app_notification_read($1, $2)`, [
          ORG_A_ID,
          SEEDED_SUBMITTED_AUDIT_EVENT,
        ]);
      })
    ).rejects.toThrow(/Active organization membership required/i);
  });

  it("[SEC-002] prevents employees from self-reviewing visits and locks submitted visit telemetry", async () => {
    // Fiona's visit was submitted in an earlier test; she cannot mark it reviewed (RLS blocks the row)
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const res = await db.query(
        `update public.visits set status = 'reviewed' where id = $1 returning id`,
        [FIONA_VISIT_ID]
      );
      expect(res.rows).toHaveLength(0);
    });

    // Even bypassing RLS, submitted visit notes are immutable during review
    await expect(
      db.query(
        `update public.visits set notes = 'tampered', status = 'reviewed' where id = $1`,
        [FIONA_VISIT_ID]
      )
    ).rejects.toThrow(/immutable during review/);

    // A manager can review it
    await runAsAuthenticatedUser(MARCUS_MANAGER_ORG_A, async () => {
      const res = await db.query<{ status: string }>(
        `update public.visits set status = 'reviewed' where id = $1 returning status`,
        [FIONA_VISIT_ID]
      );
      expect(res.rows[0]?.status).toBe("reviewed");
    });
  });

  it("[SEC-003] blocks direct edits to planned stops on non-editable trips", async () => {
    await expect(
      db.query(`update public.trip_stops set sequence_number = 42 where trip_id = $1`, [
        FIONA_DRAFT_TRIP,
      ])
    ).rejects.toThrow(/cannot be modified while trip is in/);

    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const res = await db.query(
        `update public.trip_stops set sequence_number = 43 where trip_id = $1 returning id`,
        [FIONA_DRAFT_TRIP]
      );
      expect(res.rows).toHaveLength(0);
    });
  });

  it("[SEC-005] prevents authenticated users from changing profile email directly", async () => {
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `update public.profiles set email = 'spoof@example.com' where id = $1`,
          [FIONA_FIELD_ORG_A]
        );
      })
    ).rejects.toThrow(/cannot be modified directly/);

    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const res = await db.query(
        `update public.profiles set full_name = 'Fiona Field' where id = $1 returning id`,
        [FIONA_FIELD_ORG_A]
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  it("[SEC-007] caps organizations created per account", async () => {
    const SPAMMER = "10000000-0000-4000-8000-000000000099";
    await db.query(
      `insert into auth.users (id, email) values ($1, 'spammer@example.com')`,
      [SPAMMER]
    );
    await runAsAuthenticatedUser(SPAMMER, async () => {
      for (let i = 0; i < 10; i += 1) {
        await db.query(`select id from public.create_organization_with_owner($1, $2)`, [
          `Spam Org ${i}`,
          `spam-org-${i}`,
        ]);
      }
    });
    await expect(
      runAsAuthenticatedUser(SPAMMER, async () => {
        await db.query(
          `select id from public.create_organization_with_owner('Spam Org X', 'spam-org-x')`
        );
      })
    ).rejects.toThrow(/creation limit/);
  });

  it("[RATE] consume_rate_limit enforces limits, bounds inputs, and denies direct table access", async () => {
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 4; i += 1) {
        const r = await db.query<{ allowed: boolean }>(
          `select public.consume_rate_limit('ai_draft', 'user:test-limit', 3, 3600) as allowed`
        );
        results.push(r.rows[0]?.allowed ?? false);
      }
      expect(results).toEqual([true, true, true, false]);

      const other = await db.query<{ allowed: boolean }>(
        `select public.consume_rate_limit('ai_draft', 'user:other', 3, 3600) as allowed`
      );
      expect(other.rows[0]?.allowed).toBe(true);

      // Supabase grants table privileges to client roles by default, so RLS with NO policies is the
      // control: buckets are invisible and cannot be written directly.
      const visible = await db.query(`select * from public.rate_limit_buckets`);
      expect(visible.rows).toHaveLength(0);
      await expect(
        db.query(
          `insert into public.rate_limit_buckets (scope, subject_hash, window_start, hit_count) values ('upload', 'x', now(), 0)`
        )
      ).rejects.toThrow(/row-level security/);
    });

    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(`select public.consume_rate_limit('made_up_scope', 'x', 3, 60)`);
      })
    ).rejects.toThrow(/Unknown rate limit scope/);

    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(`select public.consume_rate_limit('upload', 'x', 100000, 60)`);
      })
    ).rejects.toThrow(/Invalid rate limit parameters/);
  });

  it("[PHASE-11] visit_geofence_events enforces RLS, append-only immutability, same-org composite FKs, and idempotency", async () => {
    const APPROVED_TRIP_A = "50000000-0000-4000-8000-000000000004";
    const STOP_A = "60000000-0000-4000-8000-000000000003";
    const STORE_A = "40000000-0000-4000-8000-000000000002";

    // 1. Fiona inserts a valid geofence event for her stop in Org A
    await runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
      const inserted = await db.query<{ id: string; status: string }>(
        `insert into public.visit_geofence_events (
          organization_id, trip_id, trip_stop_id, store_id, employee_user_id,
          event_type, client_event_id, device_recorded_at, latitude, longitude,
          accuracy_meters, geofence_radius_meters, dwell_time_seconds, status
        ) values ($1, $2, $3, $4, $5, 'geofence_entry', 'pglite-evt-001', now(), 41.8975, -87.6196, 12.0, 120, 45, 'processed')
        returning id, status`,
        [ORG_A_ID, APPROVED_TRIP_A, STOP_A, STORE_A, FIONA_FIELD_ORG_A]
      );
      expect(inserted.rows).toHaveLength(1);
      expect(inserted.rows[0]?.status).toBe("processed");
    });

    // 2. Duplicate (organization_id, client_event_id) is rejected by unique index
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `insert into public.visit_geofence_events (
            organization_id, trip_id, trip_stop_id, store_id, employee_user_id,
            event_type, client_event_id, device_recorded_at, latitude, longitude,
            geofence_radius_meters, status
          ) values ($1, $2, $3, $4, $5, 'geofence_entry', 'pglite-evt-001', now(), 41.8975, -87.6196, 120, 'processed')`,
          [ORG_A_ID, APPROVED_TRIP_A, STOP_A, STORE_A, FIONA_FIELD_ORG_A]
        );
      })
    ).rejects.toThrow(/idx_visit_geofence_events_idempotency/);

    // 3. Cross-org store reference is rejected by composite foreign key
    await expect(
      runAsAuthenticatedUser(FIONA_FIELD_ORG_A, async () => {
        await db.query(
          `insert into public.visit_geofence_events (
            organization_id, trip_id, trip_stop_id, store_id, employee_user_id,
            event_type, client_event_id, device_recorded_at, latitude, longitude,
            geofence_radius_meters, status
          ) values ($1, $2, $3, $4, $5, 'geofence_entry', 'pglite-evt-cross-org', now(), 41.8975, -87.6196, 120, 'processed')`,
          [ORG_A_ID, APPROVED_TRIP_A, STOP_A, STORE_ORG_B, FIONA_FIELD_ORG_A]
        );
      })
    ).rejects.toThrow(/visit_geofence_events_same_org_store_fk/);

    // 4. Append-only immutability trigger rejects UPDATE and DELETE
    await expect(
      db.query(
        `update public.visit_geofence_events set status = 'rejected' where client_event_id = 'pglite-evt-001'`
      )
    ).rejects.toThrow(/visit_geofence_events is append-only/);

    await expect(
      db.query(
        `delete from public.visit_geofence_events where client_event_id = 'pglite-evt-001'`
      )
    ).rejects.toThrow(/visit_geofence_events is append-only/);

    // 5. Cross-tenant RLS isolation: Org B manager sees 0 geofence events from Org A
    await runAsAuthenticatedUser(BRENDA_MANAGER_ORG_B, async () => {
      const rows = await db.query(
        `select id from public.visit_geofence_events where organization_id = $1`,
        [ORG_A_ID]
      );
      expect(rows.rows).toHaveLength(0);
    });

    // 6. Visit lifecycle trigger protects check_in_source immutability on UPDATE
    await expect(
      db.query(
        `update public.visits set check_in_source = 'automatic_geofence' where id = $1`,
        [FIONA_VISIT_ID]
      )
    ).rejects.toThrow(
      /Visit check-in telemetry, source, and idempotency key are immutable/
    );
  });

  it("[RELEASE] post-release verification SQL passes on the fully migrated schema and detects an RLS gap", async () => {
    const verification = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/verification/post-release.sql"),
      "utf8"
    );
    const ok = await db.exec(verification);
    expect(ok).toBeTruthy();

    await db.exec(`create table public.__verify_probe (id int);`);
    await expect(db.exec(verification)).rejects.toThrow(
      /Tables without enabled\+forced RLS: __verify_probe/
    );
    await db.exec(`drop table public.__verify_probe;`);
  });
});
