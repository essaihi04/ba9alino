-- 1) Virtual accounts for Ba9alino org + their login capability
SELECT va.name, va.role, va.is_active, va.organization_id,
  va.password_hash IS NOT NULL AS has_hash
FROM virtual_accounts va
WHERE va.organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
ORDER BY va.role, va.name;

-- 2) Employees without organization_id (causing data leakage across orgs)
SELECT COUNT(*) AS employees_no_org FROM employees WHERE organization_id IS NULL;
SELECT COUNT(*) AS employees_ba9alino FROM employees WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';

-- 3) RLS status on employees table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'employees';
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'employees';

-- 4) Virtual accounts without org
SELECT COUNT(*) AS va_no_org FROM virtual_accounts WHERE organization_id IS NULL;
SELECT COUNT(*) AS va_ba9alino FROM virtual_accounts WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';

-- 5) Check which tables have RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('employees', 'virtual_accounts', 'user_accounts', 'organization_members')
ORDER BY tablename;
