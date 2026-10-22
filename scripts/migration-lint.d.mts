export function lintMigration(
  name: string,
  sql: string,
  allSql?: string
): { errors: string[]; warnings: string[] };
export function lintDirectory(dir: string): {
  files: string[];
  errors: string[];
  warnings: string[];
};
