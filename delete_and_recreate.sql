-- Delete old user completely
DELETE FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email = 'pipo@example.com');
DELETE FROM public.user_accounts WHERE email = 'pipo@example.com';
DELETE FROM auth.users WHERE email = 'pipo@example.com';

-- Verify deletion
SELECT 'Deleted successfully' as status;
