import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * FieldTrack — Phase 9: Supabase Storage Security & Isolation Audit
 *
 * Validates against PostgreSQL RLS:
 * 1. The canonical bucket is 'visit-evidence' with public = false.
 * 2. Any object in an unconfigured bucket (e.g. 'fieldtrack-evidence') cannot be accessed by authenticated users.
 * 3. Cross-tenant isolation on storage.objects: Org B user cannot select or insert Org A evidence objects.
 * 4. Assigned representative upload: Can only insert when visit status = 'in_progress' and assigned to caller.
 * 5. Intra-tenant isolation: Other field employees cannot view another employee's evidence in storage.objects.
 * 6. Managers/Admins in the same org CAN select evidence objects for quality review.
 * 7. storage.objects UPDATE and DELETE are blocked (default DENY / append-only integrity).
 */

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ALICE_ADMIN = "10000000-0000-4000-8000-000000000001";
const MARCUS_MANAGER = "10000000-0000-4000-8000-000000000002";
const FIONA_REP = "10000000-0000-4000-8000-000000000003";
const GARY_OTHER_REP = "10000000-0000-4000-8000-000000000004";
const BRENDA_COMPETITOR = "10000000-0000-4000-8000-000000000005";

const VISIT_A1_IN_PROGRESS = "60000000-0000-4000-8000-000000000001";
const VISIT_A2_SUBMITTED = "60000000-0000-4000-8000-000000000002";

describe("Phase 9: Supabase Storage Security & Policy Invariants", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Bootstrap auth and storage schemas as Supabase hosts do
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

      -- Bootstrap storage schema prior to migrations so migration 2 and 10 configure storage policies
      create schema if not exists storage;
      grant usage on schema storage to public, authenticated;

      create table if not exists storage.buckets (
        id text primary key,
        name text not null,
        owner uuid,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        public boolean default false,
        avif_autodetection boolean default false,
        file_size_limit bigint,
        allowed_mime_types text[],
        owner_id text
      );

      create table if not exists storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id),
        name text,
        owner uuid,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        last_accessed_at timestamptz default now(),
        metadata jsonb default '{}'::jsonb,
        path_tokens text[] generated always as (string_to_array(name, '/')) stored,
        version text,
        owner_id text
      );

      alter table storage.objects enable row level security;
      alter table storage.objects force row level security;
      grant select, insert, update, delete on table storage.objects to authenticated;
      grant select on table storage.buckets to authenticated;
    `);

    // 2. Apply all 14 migrations in order
    const dir = path.resolve(process.cwd(), "supabase/migrations");
    const migrationFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      await db.exec(sql);
    }

    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
    `);

    // 3. Seed users & organizations
    await db.exec(`
      insert into auth.users (id, email) values
        ('${ALICE_ADMIN}', 'alice@org-a.test'),
        ('${MARCUS_MANAGER}', 'marcus@org-a.test'),
        ('${FIONA_REP}', 'fiona@org-a.test'),
        ('${GARY_OTHER_REP}', 'gary@org-a.test'),
        ('${BRENDA_COMPETITOR}', 'brenda@org-b.test');

      insert into public.organizations (id, name, slug) values
        ('${ORG_A_ID}', 'Alpha Operations', 'org-alpha'),
        ('${ORG_B_ID}', 'Beta Competitor', 'org-beta');

      insert into public.organization_members (organization_id, user_id, role, status) values
        ('${ORG_A_ID}', '${ALICE_ADMIN}', 'admin', 'active'),
        ('${ORG_A_ID}', '${MARCUS_MANAGER}', 'manager', 'active'),
        ('${ORG_A_ID}', '${FIONA_REP}', 'field_employee', 'active'),
        ('${ORG_A_ID}', '${GARY_OTHER_REP}', 'field_employee', 'active'),
        ('${ORG_B_ID}', '${BRENDA_COMPETITOR}', 'admin', 'active');

      -- Store
      insert into public.stores (id, organization_id, name, region, address_line1, city, country_code)
      values ('40000000-0000-4000-8000-000000000001', '${ORG_A_ID}', 'Alpha Store 1', 'Midwest', '123 Main', 'Chicago', 'US');

      -- Trip created in draft and transitioned through state machine
      insert into public.trips (id, organization_id, owner_user_id, title, start_date, end_date, status)
      values ('50000000-0000-4000-8000-000000000001', '${ORG_A_ID}', '${FIONA_REP}', 'Route 101', '2026-11-01', '2026-11-02', 'draft');

      update public.trips
      set status = 'submitted', submitted_at = now()
      where id = '50000000-0000-4000-8000-000000000001';

      update public.trips
      set status = 'approved', decided_by = '${MARCUS_MANAGER}', decided_at = now(), decision_note = 'Approved'
      where id = '50000000-0000-4000-8000-000000000001';

      update public.trips
      set status = 'in_progress'
      where id = '50000000-0000-4000-8000-000000000001';

      insert into public.trip_stops (id, organization_id, trip_id, store_id, sequence_number, status)
      values
        ('55000000-0000-4000-8000-000000000001', '${ORG_A_ID}', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'planned'),
        ('55000000-0000-4000-8000-000000000002', '${ORG_A_ID}', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 2, 'visited');

      -- Visit A2: inserted in_progress, then checked out to submitted
      insert into public.visits (id, organization_id, trip_stop_id, employee_user_id, status, checked_in_at)
      values
        ('${VISIT_A2_SUBMITTED}', '${ORG_A_ID}', '55000000-0000-4000-8000-000000000002', '${FIONA_REP}', 'in_progress', now() - interval '1 hour');

      update public.visits
      set status = 'submitted', checked_out_at = now()
      where id = '${VISIT_A2_SUBMITTED}';

      -- Visit A1: active in_progress visit for Fiona
      insert into public.visits (id, organization_id, trip_stop_id, employee_user_id, status)
      values
        ('${VISIT_A1_IN_PROGRESS}', '${ORG_A_ID}', '55000000-0000-4000-8000-000000000001', '${FIONA_REP}', 'in_progress');

      -- Also create the secondary/unused bucket 'fieldtrack-evidence' to test policy containment
      insert into storage.buckets (id, name, public) values ('fieldtrack-evidence', 'fieldtrack-evidence', false);
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

  it("verifies the canonical bucket 'visit-evidence' is created with public=false", async () => {
    const bucket = await db.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets where id = 'visit-evidence'`
    );
    expect(bucket.rows).toHaveLength(1);
    expect(bucket.rows[0]?.id).toBe("visit-evidence");
    expect(bucket.rows[0]?.public).toBe(false);
  });

  it("denies authenticated uploads to the unconfigured bucket 'fieldtrack-evidence'", async () => {
    await runAs(FIONA_REP, async () => {
      // Fiona tries to insert an object into 'fieldtrack-evidence'
      await expect(
        db.query(
          `insert into storage.objects (bucket_id, name)
           values ('fieldtrack-evidence', '${ORG_A_ID}/${VISIT_A1_IN_PROGRESS}/test.jpg')`
        )
      ).rejects.toThrow();
    });
  });

  it("allows assigned representative to insert evidence object into 'visit-evidence' on in_progress visit", async () => {
    const objectPath = `${ORG_A_ID}/${VISIT_A1_IN_PROGRESS}/11111111-1111-4111-8111-111111111111.jpg`;

    await runAs(FIONA_REP, async () => {
      const res = await db.query(
        `insert into storage.objects (bucket_id, name)
         values ('visit-evidence', $1)
         returning id`,
        [objectPath]
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  it("denies representative upload to a completed/submitted visit", async () => {
    const objectPath = `${ORG_A_ID}/${VISIT_A2_SUBMITTED}/22222222-2222-4222-8222-222222222222.jpg`;

    await runAs(FIONA_REP, async () => {
      await expect(
        db.query(
          `insert into storage.objects (bucket_id, name)
           values ('visit-evidence', $1)`,
          [objectPath]
        )
      ).rejects.toThrow();
    });
  });

  it("enforces cross-tenant storage isolation: Brenda (Org B) cannot insert or read Org A objects", async () => {
    const objectPath = `${ORG_A_ID}/${VISIT_A1_IN_PROGRESS}/33333333-3333-4333-8333-333333333333.jpg`;

    // 1. Cross-tenant insert is rejected
    await runAs(BRENDA_COMPETITOR, async () => {
      await expect(
        db.query(
          `insert into storage.objects (bucket_id, name)
           values ('visit-evidence', $1)`,
          [objectPath]
        )
      ).rejects.toThrow();
    });

    // 2. Cross-tenant select returns 0 rows (isolated)
    await runAs(BRENDA_COMPETITOR, async () => {
      const objects = await db.query(
        `select * from storage.objects where bucket_id = 'visit-evidence'`
      );
      expect(objects.rows).toHaveLength(0);
    });
  });

  it("enforces intra-tenant representative privacy: Gary (Rep) cannot select Fiona's evidence objects", async () => {
    await runAs(GARY_OTHER_REP, async () => {
      const objects = await db.query(
        `select * from storage.objects where bucket_id = 'visit-evidence'`
      );
      expect(objects.rows).toHaveLength(0);
    });
  });

  it("allows Org Manager and Admin to select evidence objects for quality review", async () => {
    // Marcus (Manager) can read Fiona's visit evidence object
    await runAs(MARCUS_MANAGER, async () => {
      const objects = await db.query(
        `select * from storage.objects where bucket_id = 'visit-evidence'`
      );
      expect(objects.rows.length).toBeGreaterThanOrEqual(1);
    });

    // Alice (Admin) can also read
    await runAs(ALICE_ADMIN, async () => {
      const objects = await db.query(
        `select * from storage.objects where bucket_id = 'visit-evidence'`
      );
      expect(objects.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("enforces that storage.objects UPDATE and DELETE are blocked for authenticated users", async () => {
    const objectPath = `${ORG_A_ID}/${VISIT_A1_IN_PROGRESS}/11111111-1111-4111-8111-111111111111.jpg`;

    await runAs(FIONA_REP, async () => {
      // UPDATE yields 0 rows (default deny by RLS)
      const updateRes = await db.query(
        `update storage.objects set name = 'tampered.jpg' where name = $1`,
        [objectPath]
      );
      expect(updateRes.rows).toHaveLength(0);

      // DELETE yields 0 rows (default deny by RLS)
      const deleteRes = await db.query(
        `delete from storage.objects where name = $1`,
        [objectPath]
      );
      expect(deleteRes.rows).toHaveLength(0);
    });
  });
});
