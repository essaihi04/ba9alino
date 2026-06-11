-- All user_accounts and virtual_accounts for the test org
SELECT 'user_accounts' AS source, id::text, username AS name, role, is_active, organization_id::text
FROM user_accounts WHERE organization_id = '91ab31fb-5bc3-4491-8d74-4c53b8dec17b'
UNION ALL
SELECT 'virtual_accounts' AS source, id::text, name, role, is_active, organization_id::text
FROM virtual_accounts WHERE organization_id = '91ab31fb-5bc3-4491-8d74-4c53b8dec17b';

-- All user_accounts (no org filter)
SELECT id, username, role, is_active, organization_id FROM user_accounts;

-- Check test04 (the previously seen admin in user_accounts)
SELECT username, role, is_active, organization_id, password_hash IS NOT NULL AS has_hash
FROM user_accounts WHERE username = 'test04';
