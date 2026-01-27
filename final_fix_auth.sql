-- Use Supabase internal admin function to modify auth.users
SELECT auth.admin.run_sql(
  $sql$
    ALTER TABLE auth.users 
    ALTER COLUMN confirmed_at SET DEFAULT NOW(),
    ALTER COLUMN email_confirmed_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW();
  $sql$
);

-- Verify the changes
SELECT 
    column_name, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'auth'
  AND column_name IN ('confirmed_at', 'email_confirmed_at', 'created_at', 'updated_at');
