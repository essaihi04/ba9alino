-- Direct auth approach: use auth.signup instead of manual insert
CREATE OR REPLACE FUNCTION create_user_account_with_employee(
    p_email TEXT,
    p_password TEXT,
    p_username TEXT,
    p_full_name TEXT,
    p_role TEXT DEFAULT 'employee',
    p_employee_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
    account_id UUID;
    result JSON;
    signup_result JSON;
BEGIN
    -- Create user account FIRST
    INSERT INTO public.user_accounts (
        id,
        username,
        email,
        full_name,
        role,
        employee_id,
        is_active,
        auth_user_id
    ) VALUES (
        gen_random_uuid(),
        p_username,
        p_email,
        p_full_name,
        p_role,
        p_employee_id,
        p_is_active,
        NULL
    )
    ON CONFLICT (email) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        employee_id = EXCLUDED.employee_id,
        is_active = EXCLUDED.is_active
    RETURNING id INTO account_id;

    -- Use auth.signup to create user (this handles all auth fields automatically)
    SELECT * INTO signup_result FROM auth.signup(
        email := p_email,
        password := p_password,
        data := jsonb_build_object(
            'username', p_username,
            'full_name', p_full_name,
            'role', p_role
        )
    );

    -- Extract user_id from signup result
    new_user_id := (signup_result->>'id')::UUID;

    -- Link the account
    UPDATE public.user_accounts
    SET auth_user_id = new_user_id
    WHERE id = account_id;
    
    result := jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'account_id', account_id,
        'message', 'User created successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create user'
        );
        
        RETURN result;
END;
$$;
