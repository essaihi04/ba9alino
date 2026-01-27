-- Create accounts using Supabase Admin API equivalent
-- This bypasses triggers and creates users directly

-- First, let's check what triggers exist on auth.users
SELECT 
    tgname,
    tgrelid::regclass as table_name,
    tgenabled as is_enabled
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass;

-- Create users using raw SQL (bypassing triggers)
DO $$
DECLARE
    v_instance_id UUID;
    admin_user_id UUID;
    employee_user_id UUID;
    client_user_id UUID;
BEGIN
    -- Get instance_id
    SELECT id INTO v_instance_id
    FROM auth.instances
    LIMIT 1;
    
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    -- Disable constraints temporarily (if possible)
    SET session_replication_role = replica;

    -- Create Admin User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'admin@ba9alino.app',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('username', 'admin', 'full_name', 'مدير النظام', 'role', 'admin')
    ) RETURNING id INTO admin_user_id;

    -- Create Employee User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'employee@ba9alino.app',
        crypt('emp123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('username', 'employee', 'full_name', 'موظف تجريبي', 'role', 'employee')
    ) RETURNING id INTO employee_user_id;

    -- Create Client User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'client@ba9alino.app',
        crypt('client123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('username', 'client', 'full_name', 'عميل تجريبي', 'role', 'client')
    ) RETURNING id INTO client_user_id;

    -- Reset session role
    SET session_replication_role = DEFAULT;

    -- Create roles and identities
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES 
        (admin_user_id, 'admin', true),
        (employee_user_id, 'employee', true),
        (client_user_id, 'client', true);

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), admin_user_id, jsonb_build_object('sub', admin_user_id, 'email', 'admin@ba9alino.app', 'email_verified', true), 'email', 'admin@ba9alino.app', NOW(), NOW(), NOW()),
        (gen_random_uuid(), employee_user_id, jsonb_build_object('sub', employee_user_id, 'email', 'employee@ba9alino.app', 'email_verified', true), 'email', 'employee@ba9alino.app', NOW(), NOW(), NOW()),
        (gen_random_uuid(), client_user_id, jsonb_build_object('sub', client_user_id, 'email', 'client@ba9alino.app', 'email_verified', true), 'email', 'client@ba9alino.app', NOW(), NOW(), NOW());

    RAISE NOTICE 'Base accounts created successfully';
END $$;

-- Verify created accounts
SELECT 
    au.email,
    au.created_at,
    ur.role,
    ur.is_active
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
ORDER BY ur.role;
