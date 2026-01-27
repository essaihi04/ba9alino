-- Check what roles are actually allowed
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.user_roles'::regclass 
  AND contype = 'c';

-- Also check existing roles in the table
SELECT DISTINCT role FROM public.user_roles;

-- Test inserting a role manually
INSERT INTO public.user_roles (user_id, role, is_active)
VALUES (gen_random_uuid(), 'employee', true);

-- If this works, the issue is in the RPC. If not, the constraint is different.
