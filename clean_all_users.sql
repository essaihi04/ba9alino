-- Clean all pipo users completely
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%pipo%'
);
DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%pipo%'
);
DELETE FROM public.user_accounts WHERE username LIKE 'pipo' OR email LIKE '%pipo%';
DELETE FROM auth.users WHERE email LIKE '%pipo%';

-- Verify deletion
SELECT 'All pipo users deleted' as status;
