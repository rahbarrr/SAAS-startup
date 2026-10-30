-- Evaluate stable JWT helper calls once per statement instead of once per row.
-- This preserves existing RLS predicates while avoiding repeated auth lookups.
DO $migration$
DECLARE
  policy_row record;
  using_clause text;
  check_clause text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~* 'auth\.(uid|jwt|role|email)\(\)'
        OR coalesce(with_check, '') ~* 'auth\.(uid|jwt|role|email)\(\)'
      )
  LOOP
    using_clause := CASE
      WHEN policy_row.qual IS NULL THEN ''
      ELSE format(
        ' USING (%s)',
        regexp_replace(
          policy_row.qual,
          'auth\.(uid|jwt|role|email)\(\)',
          '(select auth.\1())',
          'gi'
        )
      )
    END;

    check_clause := CASE
      WHEN policy_row.with_check IS NULL THEN ''
      ELSE format(
        ' WITH CHECK (%s)',
        regexp_replace(
          policy_row.with_check,
          'auth\.(uid|jwt|role|email)\(\)',
          '(select auth.\1())',
          'gi'
        )
      )
    END;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      using_clause,
      check_clause
    );
  END LOOP;
END;
$migration$;
