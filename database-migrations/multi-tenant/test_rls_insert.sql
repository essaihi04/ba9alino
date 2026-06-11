BEGIN;
SET LOCAL "request.jwt.claims" = '{"sub":"12601d23-f355-4062-80ea-2dc23a0605e3","organization_id":"6db5963e-4412-4b07-bab5-80eb33bd1d7f","role":"ba9alino_anon"}';
SET LOCAL ROLE ba9alino_anon;

SELECT current_org_id();

INSERT INTO clients (company_name_ar) VALUES ('test RLS trigger')
RETURNING id, company_name_ar, organization_id;

ROLLBACK;
