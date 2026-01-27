-- Reset passwords by creating new users and replacing old ones
-- This uses Supabase Auth's native password hashing

-- First, let's check the current users
SELECT 
    au.email,
    au.created_at,
    ur.role,
    ai.provider_id
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN auth.identities ai ON au.id = ai.user_id
ORDER BY ur.role;

-- Delete all current users and recreate them with proper setup
DELETE FROM auth.identities;
DELETE FROM public.user_roles;
DELETE FROM auth.users;

-- Now create users with minimal setup (let Supabase handle the rest)
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

    -- Create Admin User with minimal fields
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'admin@ba9alino.app',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    ) RETURNING id INTO admin_user_id;

    -- Create Employee User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'employee@ba9alino.app',
        crypt('emp123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    ) RETURNING id INTO employee_user_id;

    -- Create Client User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at
    ) VALUES (
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'client@ba9alino.app',
        crypt('client123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    ) RETURNING id INTO client_user_id;

    -- Create roles
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES 
        (admin_user_id, 'admin', true),
        (employee_user_id, 'employee', true),
        (client_user_id, 'client', true);

    -- Create identities with minimal required fields
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), admin_user_id, jsonb_build_object('sub', admin_user_id, 'email', 'admin@ba9alino.app'), 'email', 'admin@ba9alino.app', NOW(), NOW()),
        (gen_random_uuid(), employee_user_id, jsonb_build_object('sub', employee_user_id, 'email', 'employee@ba9alino.app'), 'email', 'employee@ba9alino.app', NOW(), NOW()),
        (gen_random_uuid(), client_user_id, jsonb_build_object('sub', client_user_id, 'email', 'client@ba9alino.app'), 'email', 'client@ba9alino.app', NOW(), NOW());

    RAISE NOTICE 'Users recreated with minimal setup';
END $$;

-- Verify the setup
SELECT 
    au.email,
    au.created_at,
    ur.role,
    ai.provider_id,
    ai.identity_data
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN auth.identities ai ON au.id = ai.user_id
ORDER BY ur.role;
