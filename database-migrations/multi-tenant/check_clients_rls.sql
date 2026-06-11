-- RLS policies on clients
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE tablename = 'clients';

-- Current setting function
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'current_organization_id';

-- How JWT org is extracted
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('get_org_id', 'jwt_org_id') LIMIT 1;
