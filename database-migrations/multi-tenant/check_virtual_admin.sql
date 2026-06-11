-- Schema of virtual_accounts
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'virtual_accounts' ORDER BY ordinal_position;

-- Find admin in virtual_accounts
SELECT * FROM virtual_accounts WHERE LOWER(username) = 'admin' OR username ILIKE '%admin%' LIMIT 5;

-- Test virtual_login function directly
SELECT * FROM virtual_login('admin', 'admin123');
