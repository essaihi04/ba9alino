-- Source of current_org_id()
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'current_org_id';

-- Source of is_super_admin()
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'is_super_admin';

-- Test what current_org_id() returns for ba9alino_anon role
SET ROLE ba9alino_anon;
SELECT current_org_id(), is_super_admin(), current_setting('request.jwt.claims', true);
RESET ROLE;

-- How does PostgREST set the JWT claims?
SELECT rolname FROM pg_roles WHERE rolname LIKE 'ba9alino%';
