-- Complete reset of authentication system
-- This will delete everything and start fresh

-- Disable all triggers first
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- Delete all data in correct order
DELETE FROM auth.identities;
DELETE FROM public.user_roles;
DELETE FROM public.user_accounts;
DELETE FROM auth.users;

-- Re-enable triggers
ALTER TABLE auth.users ENABLE TRIGGER ALL;

-- Verify complete cleanup
SELECT 
    'Complete reset done' as status,
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM public.user_roles) as user_roles_count,
    (SELECT COUNT(*) FROM public.user_accounts) as user_accounts_count;
