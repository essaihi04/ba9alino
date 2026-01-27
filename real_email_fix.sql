-- Create user with real email format
CREATE OR REPLACE FUNCTION create_user_account_v2(
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
    v_email TEXT;
BEGIN
    -- Ensure email is valid format
    v_email := p_email;
    IF v_email LIKE '%@ba9alino.local' OR v_email LIKE '%@ba9alino.com' THEN
        v_email := REPLACE(v_email, '@ba9alino.local', '@test.com');
        v_email := REPLACE(v_email, '@ba9alino.com', '@test.com');
    END IF;

    -- Get instance_id
    SELECT COALESCE(id, '00000000-0000-0000-0000-000000000000'::UUID) 
    INTO v_instance_id
    FROM auth.instances
    LIMIT 1;

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
        v_email,
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

    -- Check if user exists
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF new_user_id IS NULL THEN
        -- Direct insert WITHOUT confirmed_at
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data
        ) VALUES (
            v_instance_id,
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            v_email,
            crypt(p_password, gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            jsonb_build_object('username', p_username, 'full_name', p_full_name, 'role', p_role)
        ) RETURNING id INTO new_user_id;
    ELSE
        -- Update WITHOUT confirmed_at
        UPDATE auth.users SET
            encrypted_password = crypt(p_password, gen_salt('bf')),
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = new_user_id;
    END IF;

    -- Create identity
    DELETE FROM auth.identities
    WHERE user_id = new_user_id AND provider = 'email';
    
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), new_user_id,
        jsonb_build_object('sub', new_user_id, 'email', v_email, 'email_verified', true),
        'email', v_email, NOW(), NOW(), NOW()
    );

    -- Link account
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
