-- Find admin account
SELECT id, username, email, is_active, role, employee_id, 
  password_hash IS NOT NULL AS has_hash,
  LEFT(COALESCE(password_hash,''), 7) AS hash_prefix
FROM user_accounts WHERE LOWER(username) = 'admin';

-- Also check virtual_accounts if exists
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_accounts') AS has_virtual_accounts;

-- Check if functions exist
SELECT proname FROM pg_proc WHERE proname IN ('virtual_login', 'user_accounts_login');
