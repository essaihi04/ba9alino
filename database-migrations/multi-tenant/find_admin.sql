-- All virtual_accounts
SELECT id, name, role, is_active, employee_id, organization_id FROM virtual_accounts ORDER BY name LIMIT 20;

-- All user_accounts
SELECT id, username, role, is_active FROM user_accounts ORDER BY username LIMIT 20;

-- Source of virtual_login
SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE proname = 'virtual_login' LIMIT 1;
