-- Robust login RPC that authenticates a user_accounts row by checking
-- the password directly against auth.users.encrypted_password via pgcrypto.
-- Useful when Supabase Auth (GoTrue) refuses signInWithPassword for users
-- whose auth.users row was inserted directly via SQL (e.g. via
-- create_user_account_fallback). Avoids "Invalid login credentials" errors.

CREATE OR REPLACE FUNCTION public.user_accounts_login(
    p_name TEXT,
    p_password TEXT
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    name TEXT,
    employee_id UUID,
    email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
    v_pwd TEXT := COALESCE(p_password, '');
BEGIN
    IF v_name = '' OR v_pwd = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ua.id,
        ua.role::TEXT AS role,
        COALESCE(ua.full_name, ua.username, v_name) AS name,
        ua.employee_id,
        ua.email
    FROM public.user_accounts ua
    JOIN auth.users au
      ON au.id = ua.auth_user_id
      OR LOWER(au.email) = LOWER(ua.email)
    WHERE LOWER(TRIM(ua.username)) = v_name
      AND COALESCE(ua.is_active, true) = true
      AND au.encrypted_password = crypt(v_pwd, au.encrypted_password)
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_accounts_login(TEXT, TEXT) TO anon, authenticated;
