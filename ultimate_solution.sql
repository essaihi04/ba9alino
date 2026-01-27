-- Ultimate solution: Create accounts via frontend instead of SQL
-- Since we can't bypass triggers in SQL, we'll use the working RPC

-- First, let's check what roles are allowed in user_accounts
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.user_accounts'::regclass 
  AND contype = 'c'
  AND conname LIKE '%role%';

-- Update the RPC to handle client role properly
CREATE OR REPLACE FUNCTION create_user_account_fallback(
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
    v_instance_id UUID;
    result JSON;
    v_valid_role TEXT;
BEGIN
    -- Get instance_id
    SELECT COALESCE(id, '00000000-0000-0000-0000-000000000000'::UUID) 
    INTO v_instance_id
    FROM auth.instances
    LIMIT 1;

    -- Map role properly
    v_valid_role := LOWER(TRIM(p_role));
    IF v_valid_role NOT IN ('admin', 'employee') THEN
        v_valid_role := 'employee'; -- Default to employee for user_accounts
    END IF;

    -- Create auth user FIRST
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('username', p_username, 'full_name', p_full_name, 'role', p_role)
    ) RETURNING id INTO new_user_id;

    -- Create user_roles record with original role
    INSERT INTO public.user_roles (
        user_id, role, is_active
    ) VALUES (
        new_user_id,
        LOWER(TRIM(p_role)), -- Use original role here
        p_is_active
    ) RETURNING id INTO account_id;

    -- Create identity
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), new_user_id,
        jsonb_build_object('sub', new_user_id, 'email', p_email, 'email_verified', true),
        'email', p_email, NOW(), NOW(), NOW()
    );
    
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

-- Instructions:
-- 1. Run this SQL to update the RPC
-- 2. Go to UserAccountsPage in the browser
-- 3. Create 3 users manually:
--    - admin@ba9alino.app / admin123
--    - employee@ba9alino.app / emp123  
--    - client@ba9alino.app / client123
