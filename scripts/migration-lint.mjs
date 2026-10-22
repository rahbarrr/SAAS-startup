// Static safety lint for SQL migrations. It does NOT replace human review of SQL/RLS changes;
// it makes risky statements explicit so a reviewer must acknowledge them with a marker comment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

function stripComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** @returns {{errors: string[], warnings: string[]}} */
export function lintMigration(name, sql, allSql = sql) {
  const errors = [];
  const warnings = [];
  const code = stripComments(sql).toLowerCase();
  const allCode = stripComments(allSql).toLowerCase();

  if (!FILE_PATTERN.test(name)) {
    errors.push(`${name}: file name must match <14-digit timestamp>_<snake_case>.sql`);
  }

  const destructive =
    /\b(drop\s+table|drop\s+schema|drop\s+column|truncate\s+table|truncate\s)/.test(code);
  if (destructive && !sql.includes("migration-review: destructive-approved")) {
    errors.push(
      `${name}: destructive statement (DROP TABLE/SCHEMA/COLUMN or TRUNCATE) requires the marker "-- migration-review: destructive-approved" plus a backup/rollback note in the PR`
    );
  }

  if (
    /disable\s+row\s+level\s+security/.test(code) &&
    !sql.includes("migration-review: rls-disable-approved")
  ) {
    errors.push(
      `${name}: DISABLE ROW LEVEL SECURITY requires "-- migration-review: rls-disable-approved"`
    );
  }

  const bulkDelete = code
    .split(";")
    .some((stmt) => /^delete\s+from\s+[a-z_."]+$/.test(stmt.trim().replace(/\s+/g, " ")));
  if (bulkDelete && !sql.includes("migration-review: bulk-delete-approved")) {
    errors.push(
      `${name}: DELETE without WHERE requires "-- migration-review: bulk-delete-approved"`
    );
  }

  if (
    /grant\s+[^;]*\bto\s+[^;]*\banon\b/.test(code) &&
    !sql.includes("migration-review: anon-grant-approved")
  ) {
    errors.push(
      `${name}: granting to anon requires "-- migration-review: anon-grant-approved"`
    );
  }

  if (/security\s+definer/.test(code) && !/set\s+search_path/.test(code)) {
    errors.push(`${name}: SECURITY DEFINER functions must set search_path`);
  }

  for (const match of code.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g
  )) {
    const table = match[1];
    const rls = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`
    );
    if (!rls.test(allCode)) {
      errors.push(
        `${name}: public.${table} is created without ENABLE ROW LEVEL SECURITY`
      );
    }
  }

  if (/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/.test(code)) {
    warnings.push(
      `${name}: policy with USING/WITH CHECK (true) found; confirm it is intentional`
    );
  }

  return { errors, warnings };
}

export function lintDirectory(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sources = files.map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
  const everything = sources.map(([, sql]) => sql).join("\n");
  const errors = [];
  const warnings = [];
  for (const [name, sql] of sources) {
    const result = lintMigration(name, sql, everything);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  return { files, errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.cwd(), "supabase/migrations");
  const { files, errors, warnings } = lintDirectory(dir);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(
    `Checked ${files.length} migration(s): ${errors.length} error(s), ${warnings.length} warning(s).`
  );
  process.exit(errors.length > 0 ? 1 : 0);
}
