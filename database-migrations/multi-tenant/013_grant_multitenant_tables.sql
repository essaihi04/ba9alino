-- ============================================================================
-- 013 — GRANT access on multi-tenant tables to ba9alino_anon
--
-- organizations, organization_members, super_admins were created by the
-- postgres superuser, so they never received the default privileges that
-- ba9alino_admin grants to ba9alino_anon on its own tables.
-- Without these grants, PostgREST returns 401 for any request that touches
-- these tables, even if the JWT is valid and RLS allows the row.
-- ============================================================================

-- organizations: anon can SELECT (own org only — filtered by RLS tenant_isolation)
GRANT SELECT ON TABLE public.organizations TO ba9alino_anon;

-- organization_members: anon can SELECT (own membership — filtered by RLS)
GRANT SELECT ON TABLE public.organization_members TO ba9alino_anon;

-- super_admins: NO grant to ba9alino_anon — only SECURITY DEFINER RPCs can read it

-- virtual_accounts: grant SELECT/INSERT/UPDATE so virtual_login + create_org work
GRANT SELECT, INSERT, UPDATE ON TABLE public.virtual_accounts TO ba9alino_anon;

SELECT 'Grants applied OK' AS status;
