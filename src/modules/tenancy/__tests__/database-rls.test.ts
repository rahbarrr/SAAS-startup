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

    // 2. Apply versioned migrations in exact chronological order
    const migration1 = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20261022000001_init_orgs_and_memberships.sql"
      ),
      "utf8"
    );
    const migration2 = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20261022000002_field_operations_schema.sql"
      ),
      "utf8"
    );
    const seedSql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/seed.sql"),
      "utf8"
    );

    await db.exec(migration1);
    await db.exec(migration2);

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
});
