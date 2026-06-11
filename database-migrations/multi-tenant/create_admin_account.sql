-- (Re)create the default admin account with password admin123
-- Uses pgcrypto (already enabled - virtual_login uses crypt())

INSERT INTO virtual_accounts (name, password_hash, role, is_active)
VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin', true)
ON CONFLICT DO NOTHING;

-- If a row already exists with name='admin', update its password instead
UPDATE virtual_accounts
SET password_hash = crypt('admin123', gen_salt('bf')),
    is_active = true,
    role = 'admin'
WHERE name = 'admin';

-- Verify
SELECT id, name, role, is_active FROM virtual_accounts WHERE name = 'admin';

-- Test login
SELECT * FROM virtual_login('admin', 'admin123');
