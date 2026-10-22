import path from "node:path";
import { describe, expect, it } from "vitest";
import { lintDirectory, lintMigration } from "../migration-lint.mjs";

describe("migration lint", () => {
  it("passes all committed migrations", () => {
    const { errors } = lintDirectory(path.resolve(process.cwd(), "supabase/migrations"));
    expect(errors).toEqual([]);
  });

  it("flags destructive SQL, RLS-less tables, unsafe definer functions and bad names", () => {
    const bad = `
      create table public.leaky (id uuid primary key);
      drop table public.stores;
      create function f() returns void language sql security definer as $$ select 1 $$;
      delete from public.trips;
      grant execute on function f() to anon;
    `;
    const { errors } = lintMigration("bad_name.sql", bad);
    const joined = errors.join("\n");
    expect(joined).toContain("file name must match");
    expect(joined).toContain("destructive statement");
    expect(joined).toContain("without ENABLE ROW LEVEL SECURITY");
    expect(joined).toContain("SECURITY DEFINER");
    expect(joined).toContain("DELETE without WHERE");
    expect(joined).toContain("granting to anon");
  });

  it("allows destructive SQL only with an explicit review marker", () => {
    const sql = "-- migration-review: destructive-approved\ndrop table public.old_thing;";
    expect(lintMigration("20261101000000_drop_old.sql", sql).errors).toEqual([]);
  });

  it("ignores keywords inside comments", () => {
    expect(
      lintMigration("20261101000001_ok.sql", "-- drop table x\nselect 1;").errors
    ).toEqual([]);
  });
});
