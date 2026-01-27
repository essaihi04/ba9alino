-- Check all existing usernames
SELECT username, email, created_at FROM public.user_accounts ORDER BY created_at DESC;

-- Check all auth users
SELECT email, created_at FROM auth.users ORDER BY created_at DESC;

-- Clean ALL users completely (more aggressive)
DELETE FROM auth.identities;
DELETE FROM public.user_roles;
DELETE FROM public.user_accounts;
DELETE FROM auth.users;

-- Verify complete cleanup
SELECT 'All users cleaned' as status,
       (SELECT COUNT(*) FROM public.user_accounts) as user_accounts_count,
       (SELECT COUNT(*) FROM auth.users) as auth_users_count;
