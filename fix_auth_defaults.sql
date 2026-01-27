-- Create a helper function with SECURITY DEFINER to modify auth.users
CREATE OR REPLACE FUNCTION fix_auth_users_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set defaults for auth.users table
    EXECUTE 'ALTER TABLE auth.users ALTER COLUMN confirmed_at SET DEFAULT NOW()';
    EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_confirmed_at SET DEFAULT NOW()';
END;
$$;

-- Execute the function
SELECT fix_auth_users_defaults();

-- Clean up the helper function
DROP FUNCTION IF EXISTS fix_auth_users_defaults();
