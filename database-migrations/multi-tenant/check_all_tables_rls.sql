-- All public tables: RLS status + org isolation check
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  CASE WHEN c.column_name IS NOT NULL THEN true ELSE false END AS has_org_id,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN information_schema.columns c
  ON c.table_name = t.tablename AND c.column_name = 'organization_id' AND c.table_schema = 'public'
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT IN ('organizations', 'organization_members', 'schema_migrations')
GROUP BY t.tablename, t.rowsecurity, c.column_name
ORDER BY t.rowsecurity ASC, t.tablename;
