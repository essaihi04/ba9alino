-- Simulate what PostgREST does: set JWT claims GUC, then INSERT without organization_id
-- Use test04's org (91ab31fb-5bc3-4491-8d74-4c53b8dec17b)

BEGIN;

SELECT set_config('request.jwt.claims',
  '{"sub":"0a8d7142-4008-4303-960c-a3dfa7fab696","organization_id":"91ab31fb-5bc3-4491-8d74-4c53b8dec17b","role":"ba9alino_anon"}',
  TRUE);

-- Verify current_org_id() returns the right org
SELECT public.current_org_id() AS should_be_testshop2_org;

-- INSERT without organization_id (trigger should fill it)
SET LOCAL ROLE ba9alino_anon;

INSERT INTO products (name_ar, sku, stock, is_active)
VALUES ('Test Product', 'TEST-SKU-99', 10, TRUE)
RETURNING id, name_ar, organization_id;

ROLLBACK;
