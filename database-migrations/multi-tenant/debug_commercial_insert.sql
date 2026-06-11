-- Check owner of current_org_id() and if it can see virtual_accounts with RLS
SELECT proname, proowner::regrole AS owner FROM pg_proc WHERE proname = 'current_org_id';

-- Simulate commercial "best" (employee_id = 2127ef88-a86e-4c9b-92b8-4fe59abaf7e3)
-- Their JWT has sub = employee_id (no organization_id since it was null before fix)
BEGIN;
  SET LOCAL "request.jwt.claims" = '{"sub":"2127ef88-a86e-4c9b-92b8-4fe59abaf7e3","role":"ba9alino_anon"}';
  SET LOCAL ROLE ba9alino_anon;

  SELECT current_org_id() AS org_from_sub;

  INSERT INTO clients (company_name_ar) VALUES ('test_commercial_insert')
  RETURNING id, company_name_ar, organization_id;
ROLLBACK;

-- Also check: does current_org_id() lookup virtual_accounts work even with RLS?
-- Run as superuser to verify
SELECT va.organization_id
FROM virtual_accounts va
WHERE va.id::TEXT = '2127ef88-a86e-4c9b-92b8-4fe59abaf7e3'
   OR va.employee_id::TEXT = '2127ef88-a86e-4c9b-92b8-4fe59abaf7e3';
