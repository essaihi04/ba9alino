-- Reset password for pipo user
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'pipo@example.com';

-- Verify the update
SELECT email, created_at FROM auth.users WHERE email = 'pipo@example.com';
