-- Use the admin role to modify auth.users
SET LOCAL ROLE postgres;

-- Set defaults for auth.users table
ALTER TABLE auth.users ALTER COLUMN confirmed_at SET DEFAULT NOW();
ALTER TABLE auth.users ALTER COLUMN email_confirmed_at SET DEFAULT NOW();

-- Verify the changes
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'auth'
  AND column_name IN ('confirmed_at', 'email_confirmed_at');
