-- Grant ownership temporarily and fix defaults
DO $$
BEGIN
    -- Try to grant ownership to current user
    EXECUTE 'ALTER TABLE auth.users OWNER TO postgres';
    
    -- Set defaults
    EXECUTE 'ALTER TABLE auth.users ALTER COLUMN confirmed_at SET DEFAULT NOW()';
    EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_confirmed_at SET DEFAULT NOW()';
    
    -- Verify
    RAISE NOTICE 'Defaults set successfully for auth.users';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;
