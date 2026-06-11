-- 1) Quick fix for current test org: backfill virtual_accounts entry
INSERT INTO virtual_accounts (name, password_hash, role, is_active, organization_id)
VALUES ('test04', crypt('test123', gen_salt('bf', 12)), 'admin', TRUE,
        '91ab31fb-5bc3-4491-8d74-4c53b8dec17b')
ON CONFLICT (name) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      organization_id = EXCLUDED.organization_id,
      is_active = TRUE,
      role = 'admin';

-- 2) Verify
SELECT name, role, organization_id FROM virtual_accounts WHERE name = 'test04';
SELECT * FROM virtual_login('test04', 'test123');

-- 3) Show current source of superadmin_create_organization (to confirm it creates virtual_accounts)
SELECT pg_get_functiondef(p.oid) ~ 'virtual_accounts' AS handles_virtual_accounts,
       pg_get_functiondef(p.oid) ~ 'crypt\(' AS uses_bcrypt
FROM pg_proc p WHERE proname = 'superadmin_create_organization';
