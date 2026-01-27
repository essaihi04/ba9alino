-- Check actual users in auth.users and user_accounts
SELECT 
    au.email,
    au.created_at,
    ua.username,
    ua.full_name,
    ua.role
FROM auth.users au
JOIN public.user_accounts ua ON au.id = ua.auth_user_id
ORDER BY au.created_at DESC;

-- Also check if there are any .local emails left
SELECT email FROM auth.users WHERE email LIKE '%@ba9alino.local';

-- Check if pipo@example.com exists
SELECT 
    au.email,
    au.created_at,
    ua.username,
    ua.role
FROM auth.users au
JOIN public.user_accounts ua ON au.id = ua.auth_user_id
WHERE au.email = 'pipo@example.com' OR ua.username = 'pipo';
