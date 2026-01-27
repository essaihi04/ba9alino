-- Check what roles are actually allowed in user_roles
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.user_roles'::regclass 
  AND contype = 'c'
  AND conname = 'user_roles_role_check';

-- Also check existing roles
SELECT DISTINCT role FROM public.user_roles;
