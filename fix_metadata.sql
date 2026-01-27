-- Fix metadata to use English only (avoiding RTL issues)
UPDATE auth.users 
SET 
    raw_user_meta_data = jsonb_build_object(
        'username', CASE 
            WHEN email = 'admin@ba9alino.app' THEN 'admin'
            WHEN email = 'employee@ba9alino.app' THEN 'employee'
            WHEN email = 'client@ba9alino.app' THEN 'client'
            ELSE COALESCE(raw_user_meta_data->>'username', 'user')
        END,
        'full_name', CASE 
            WHEN email = 'admin@ba9alino.app' THEN 'System Admin'
            WHEN email = 'employee@ba9alino.app' THEN 'Test Employee'
            WHEN email = 'client@ba9alino.app' THEN 'Test Client'
            ELSE COALESCE(raw_user_meta_data->>'full_name', 'User')
        END,
        'role', CASE 
            WHEN email = 'admin@ba9alino.app' THEN 'admin'
            WHEN email = 'employee@ba9alino.app' THEN 'employee'
            WHEN email = 'client@ba9alino.app' THEN 'client'
            ELSE COALESCE(raw_user_meta_data->>'role', 'employee')
        END
    )
WHERE email IN ('admin@ba9alino.app', 'employee@ba9alino.app', 'client@ba9alino.app');

-- Verify the fix
SELECT 
    email,
    raw_user_meta_data
FROM auth.users 
WHERE email IN ('admin@ba9alino.app', 'employee@ba9alino.app', 'client@ba9alino.app');
