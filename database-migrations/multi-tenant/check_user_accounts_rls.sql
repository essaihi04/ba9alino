SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('user_accounts', 'virtual_accounts')
AND schemaname = 'public';

SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE tablename IN ('user_accounts', 'virtual_accounts');

-- Does user_accounts have organization_id?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_accounts' AND column_name = 'organization_id';

-- Count per org
SELECT organization_id, COUNT(*) FROM user_accounts GROUP BY organization_id LIMIT 5;
