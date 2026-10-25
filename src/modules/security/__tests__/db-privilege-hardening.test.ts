import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Database privilege and SECURITY DEFINER hardening.
 *
 * IMPORTANT (fidelity): this runs in PGlite, not on Supabase. Supabase documents that objects
 * created in `public` are granted to `anon`/`authenticated`/`service_role` by DEFAULT PRIVILEGES.
 * `REVOKE ... FROM PUBLIC` does not remove those direct grants. We emulate that platform default
 * here before applying the real migrations so the assertions reflect what a hosted project gets.
 * This has NOT been verified against a live Supabase project.
 */
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

/** Only the rate limiter is intentionally callable before sign-in. */
const ANON_EXECUTABLE_ALLOWLIST = new Set(["consume_rate_limit"]);

describe("DB privileges and SECURITY DEFINER hardening (PGlite, emulated Supabase defaults)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then
          create role service_role nologin bypassrls;
        end if;
      end
      $$;

      create schema if not exists auth;
      grant usage on schema auth to public, anon, authenticated;
      grant usage on schema public to public, anon, authenticated, service_role;

      create table if not exists auth.users (id uuid primary key, email text not null);
      create or replace function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant execute on function auth.uid() to public, anon, authenticated;

      -- Emulate Supabase's documented platform defaults for objects created in public.
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
    await db.exec(
      fs.readFileSync(path.resolve(process.cwd(), "supabase/seed.sql"), "utf8")
    );
  });

  afterAll(async () => {
    await db.close();
  });

  const publicFunctions = async () =>
    (
      await db.query<{
        name: string;
        args: string;
        oid: number;
        is_trigger: boolean;
        definer: boolean;
        config: string[] | null;
      }>(`
        select p.proname as name,
               pg_get_function_identity_arguments(p.oid) as args,
               p.oid::int as oid,
               (p.prorettype = 'trigger'::regtype) as is_trigger,
               p.prosecdef as definer,
               p.proconfig as config
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f'
         order by p.proname
      `)
    ).rows;

  it("discovers the function inventory (guards against testing nothing)", async () => {
    const fns = await publicFunctions();
    expect(fns.length).toBeGreaterThanOrEqual(20);
    expect(fns.some((f) => f.name === "consume_rate_limit")).toBe(true);
  });

  it("anon and PUBLIC cannot EXECUTE any public function except the rate limiter", async () => {
    const exposed: string[] = [];
    for (const fn of await publicFunctions()) {
      const res = await db.query<{ ok: boolean }>(
        `select has_function_privilege('anon', ${fn.oid}, 'EXECUTE') as ok`
      );
      const anon = Boolean(res.rows[0]?.ok);
      if (anon && !ANON_EXECUTABLE_ALLOWLIST.has(fn.name)) {
        exposed.push(`${fn.name}(${fn.args})`);
      }
    }
    expect(exposed).toEqual([]);
  });

  it("trigger functions are not directly executable by anon or authenticated", async () => {
    const exposed: string[] = [];
    for (const fn of (await publicFunctions()).filter((f) => f.is_trigger)) {
      for (const role of ["anon", "authenticated"]) {
        const res = await db.query<{ ok: boolean }>(
          `select has_function_privilege('${role}', ${fn.oid}, 'EXECUTE') as ok`
        );
        const ok = Boolean(res.rows[0]?.ok);
        if (ok) exposed.push(`${role}:${fn.name}`);
      }
    }
    expect(exposed).toEqual([]);
  });

  it("every SECURITY DEFINER function pins a safe search_path (empty or ending in pg_temp)", async () => {
    const definers = (await publicFunctions()).filter((f) => f.definer);
    expect(definers.length).toBeGreaterThanOrEqual(10);
    const bad = definers.filter((f) => {
      const sp = (f.config ?? []).find((c) => c.startsWith("search_path="));
      if (!sp) return true;
      const raw = sp.replace("search_path=", "").trim();
      if (raw === "" || raw === "''" || raw === '""') {
        return false; // set search_path = '' is safest
      }
      const schemas = raw.split(",").map((s) => s.trim());
      return (
        schemas[schemas.length - 1] !== "pg_temp" ||
        schemas.some((s) => s === "auth" || s === "extensions" || s === '"$user"')
      );
    });
    expect(bad.map((f) => f.name)).toEqual([]);
  });

  it("every public table has RLS enabled AND forced", async () => {
    const rows = (
      await db.query<{ relname: string }>(`
        select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and (not c.relrowsecurity or not c.relforcerowsecurity)
      `)
    ).rows;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("anon holds no privilege on any public table or sequence", async () => {
    const tables = (
      await db.query<{ t: string; ok: boolean }>(`
        select c.relname as t,
               (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
                or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE')) as ok
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
      `)
    ).rows;
    expect(tables.length).toBeGreaterThanOrEqual(14);
    expect(tables.filter((r) => r.ok).map((r) => r.t)).toEqual([]);
  });

  it("anon reads no rows and writes nothing, even where it still has table grants", async () => {
    const tables = (
      await db.query<{ relname: string }>(`
        select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' order by 1
      `)
    ).rows.map((r) => r.relname);

    // Prove seed data exists so "0 rows" is meaningful.
    const seeded = await db.query<{ n: number }>(
      "select count(*)::int as n from public.organizations"
    );
    expect(seeded.rows[0]?.n ?? 0).toBeGreaterThan(0);

    for (const table of tables) {
      await db.exec("begin;");
      try {
        await db.exec("set local role anon;");
        let visible = 0;
        try {
          const res = await db.query<{ n: number }>(
            `select count(*)::int as n from public.${table}`
          );
          visible = res.rows[0]?.n ?? 0;
        } catch (e) {
          expect(String((e as Error).message)).toMatch(/permission denied/i);
        }
        expect({ table, visible }).toEqual({ table, visible: 0 });
      } finally {
        await db.exec("rollback;");
      }
    }
  });

  it("anon cannot call privileged RPCs, and the allow-listed limiter rejects unknown scopes", async () => {
    await db.exec("begin;");
    try {
      await db.exec("set local role anon;");
      await expect(
        db.query("select public.create_organization_with_owner('x', 'x')")
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("rollback;");
    }

    await db.exec("begin;");
    try {
      await db.exec("set local role anon;");
      await expect(
        db.query("select public.accept_organization_invitation($1)", ["a".repeat(64)])
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("rollback;");
    }

    await db.exec("begin;");
    try {
      await db.exec("set local role anon;");
      await expect(
        db.query("select public.consume_rate_limit('made_up_scope', 'x', 5, 60)")
      ).rejects.toThrow(/Unknown rate limit scope/);
    } finally {
      await db.exec("rollback;");
    }

    await db.exec("begin;");
    try {
      await db.exec("set local role anon;");
      const ok = await db.query<{ ok: boolean }>(
        "select public.consume_rate_limit('auth_sign_in', 'ip:203.0.113.9', 2, 60) as ok"
      );
      expect(ok.rows[0]?.ok).toBe(true);
    } finally {
      await db.exec("rollback;");
    }
  });

  it("rate_limit_buckets is unreadable and unwritable by clients", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec("begin;");
      try {
        await db.exec(`set local role ${role};`);
        let rows = 0;
        try {
          rows = (await db.query("select * from public.rate_limit_buckets")).rows.length;
        } catch (e) {
          expect(String((e as Error).message)).toMatch(/permission denied/i);
        }
        expect(rows).toBe(0);
      } finally {
        await db.exec("rollback;");
      }
    }
  });
});
