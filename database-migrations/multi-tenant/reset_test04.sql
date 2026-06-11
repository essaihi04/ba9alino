-- Show full test04 row
SELECT * FROM user_accounts WHERE username = 'test04';

-- Set a password hash directly on user_accounts using pgcrypto bcrypt
UPDATE user_accounts
SET password_hash = crypt('test123', gen_salt('bf')),
    is_active = true
WHERE username = 'test04';

-- Verify
SELECT username, role, is_active, password_hash IS NOT NULL AS has_hash, organization_id
FROM user_accounts WHERE username = 'test04';
