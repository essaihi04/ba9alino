-- Does ba9alino_anon have INSERT on clients?
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'clients' AND grantee IN ('ba9alino_anon', 'authenticator');

-- What roles does authenticator have?
SELECT rolname, pg_has_role('authenticator', rolname, 'member') AS is_member
FROM pg_roles WHERE rolname IN ('ba9alino_anon', 'ba9alino_admin');

-- Simulate the exact PostgREST transaction and check what happens
BEGIN;
  SET LOCAL "request.jwt.claims" = '{"sub":"12601d23-f355-4062-80ea-2dc23a0605e3","organization_id":"6db5963e-4412-4b07-bab5-80eb33bd1d7f","role":"ba9alino_anon","aud":"authenticated"}';
  SET LOCAL ROLE ba9alino_anon;
  SELECT current_user, current_org_id();
  -- Try insert
  INSERT INTO clients (company_name_ar) VALUES ('rls_test_2')
  RETURNING id, company_name_ar, organization_id;
ROLLBACK;
