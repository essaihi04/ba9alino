-- Ultimate fix: modify RPC to include all required fields
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
    v_instance_id UUID;
    result JSON;
BEGIN
    SELECT id INTO v_instance_id
    FROM auth.instances
    LIMIT 1;

    -- Create/Update user account FIRST
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

    -- Create auth user with ALL required fields
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF new_user_id IS NULL THEN
      INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          confirmed_at,
          created_at,
          updated_at,
          last_sign_in_at,
          phone,
          phone_confirmed_at,
          banned_until,
          recovery_token,
          email_change,
          email_change_sent_at,
          invited_at,
          confirmation_token,
          reauthentication_token,
          reauthentication_sent_at,
          password_change_token,
          password_change_sent_at,
          new_email,
          is_super_admin,
          raw_app_meta_data,
          raw_user_meta_data
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
          NOW(),
          NOW(),
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          false,
          jsonb_build_object(
              'provider', 'email',
              'providers', jsonb_build_array('email')
          ),
          jsonb_build_object(
              'username', p_username,
              'full_name', p_full_name,
              'role', p_role
          )
      ) RETURNING id INTO new_user_id;
    ELSE
      UPDATE auth.users
      SET instance_id = COALESCE(instance_id, v_instance_id),
          aud = COALESCE(aud, 'authenticated'),
          role = COALESCE(role, 'authenticated'),
          encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = NOW(),
          confirmed_at = COALESCE(confirmed_at, NOW()),
          updated_at = NOW(),
          last_sign_in_at = COALESCE(last_sign_in_at, NOW()),
          raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
              'provider', 'email',
              'providers', jsonb_build_array('email')
          ),
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
              'username', p_username,
              'full_name', p_full_name,
              'role', p_role
          )
      WHERE id = new_user_id;
    END IF;

    DELETE FROM auth.identities
    WHERE user_id = new_user_id
      AND provider = 'email'
      AND provider_id = p_email;

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object(
        'sub', new_user_id,
        'email', p_email,
        'email_verified', true
      ),
      'email',
      p_email,
      NOW(),
      NOW(),
      NOW()
    );

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
